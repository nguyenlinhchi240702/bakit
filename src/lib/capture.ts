// Capture orchestration. Windows: hide BAKit → grab all monitors in Rust → one frozen overlay window per monitor.
// Browser demo: getDisplayMedia frame → in-page overlay.
import { useStore } from './store';
import { grabScreens, hideMainWindow, isTauri, showMainWindow, type ScreenShot } from './platform';
import { sleep } from './util';

export interface Rect { x: number; y: number; w: number; h: number }
const SHOTS_KEY = 'bakit.captureShots';
let busy = false;

export async function startCapture(target?: { kind: 'item' | 'task' | 'meeting'; id: string }) {
  if (busy) return;
  busy = true;
  const store = useStore.getState();
  useStore.setState({ captureTarget: target || null });
  try {
    if (!isTauri) {
      const shots = await grabScreens();
      useStore.setState({ webShots: shots });
      return;
    }
    await hideMainWindow();
    await sleep(220); // let Windows finish hiding BAKit so it never appears in the shot
    const shots = await grabScreens();
    localStorage.setItem(SHOTS_KEY, JSON.stringify(shots));
    await openOverlays(shots);
  } catch (e) {
    await showMainWindow();
    const msg = String(e);
    store.showToast(msg.includes('NotAllowed') || msg.includes('Permission') ? 'Đã hủy chụp màn hình' : 'Không chụp được màn hình: ' + msg, 'err');
    busy = false;
  } finally {
    if (!isTauri) busy = false;
  }
}

async function openOverlays(shots: ScreenShot[]) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const { PhysicalPosition, PhysicalSize, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
  for (const s of shots) {
    const w = new WebviewWindow('overlay-' + s.index, {
      url: 'index.html?overlay=' + s.index,
      decorations: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, visible: false,
      focus: true, shadow: false, transparent: false, visibleOnAllWorkspaces: true,
      ...(s.logical
        ? { x: s.x, y: s.y, width: s.lw ?? s.width / s.scale, height: s.lh ?? s.height / s.scale }
        : { x: s.x / s.scale, y: s.y / s.scale, width: s.width / s.scale, height: s.height / s.scale })
    });
    w.once('tauri://created', async () => {
      if (s.logical) {
        // macOS reports monitor bounds in points.
        await w.setPosition(new LogicalPosition(s.x, s.y));
        await w.setSize(new LogicalSize(s.lw ?? s.width / s.scale, s.lh ?? s.height / s.scale));
      } else {
        await w.setPosition(new PhysicalPosition(s.x, s.y));
        await w.setSize(new PhysicalSize(s.width, s.height));
      }
      await w.show();
      if (s.primary) await w.setFocus();
    });
    w.once('tauri://error', (e) => useStore.getState().showToast('Không mở được lớp chụp: ' + JSON.stringify(e.payload), 'err'));
  }
}

export function readShots(): ScreenShot[] {
  try {
    return JSON.parse(localStorage.getItem(SHOTS_KEY) || '[]');
  } catch {
    return [];
  }
}

async function closeOverlays() {
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow');
  const wins = await getAllWebviewWindows();
  await Promise.all(wins.filter((w) => w.label.startsWith('overlay-')).map((w) => w.close().catch(() => undefined)));
}

/** Main window: wire up events coming from overlay windows (Tauri only). */
export async function listenOverlayEvents() {
  if (!isTauri) return;
  const { listen } = await import('@tauri-apps/api/event');
  const { invoke } = await import('@tauri-apps/api/core');
  await listen<{ index: number; rect: Rect }>('capture:done', async (ev) => {
    const shot = readShots().find((s) => s.index === ev.payload.index);
    await closeOverlays();
    await showMainWindow();
    busy = false;
    if (!shot?.path) return;
    try {
      const r = ev.payload.rect;
      const bytes = await invoke<ArrayBuffer>('read_capture', { path: shot.path, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) });
      await saveCapture(new Blob([bytes], { type: 'image/png' }));
    } catch (e) {
      useStore.getState().showToast('Không lưu được ảnh chụp: ' + String(e), 'err');
    } finally {
      invoke('clear_captures').catch(() => undefined);
    }
  });
  await listen('capture:cancel', async () => {
    await closeOverlays();
    await showMainWindow();
    busy = false;
    invoke('clear_captures').catch(() => undefined);
  });
}

/** Browser demo: crop the in-page shot. */
export async function finishWebCapture(shot: ScreenShot, rect: Rect) {
  useStore.setState({ webShots: null });
  const img = new Image();
  img.src = shot.src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rect.w));
  c.height = Math.max(1, Math.round(rect.h));
  c.getContext('2d')!.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  await saveCapture(blob);
}
export function cancelWebCapture() {
  useStore.setState({ webShots: null, captureTarget: null });
  busy = false;
}

/** Save the original immediately (immutable), attach if a target was set, then open it in the editor. */
export async function saveCapture(blob: Blob, source: 'capture' | 'paste' | 'file' = 'capture', name?: string) {
  const s = useStore.getState();
  const asset = await s.addImage(blob, source, name);
  const target = s.captureTarget;
  useStore.setState({ captureTarget: null });
  if (target?.kind === 'item') {
    s.attachAssetToItem(target.id, asset.id);
    s.showToast('Đã chụp và gắn ảnh vào mục');
    return asset;
  }
  if (target?.kind === 'meeting') {
    s.attachAssetToMeeting(target.id, asset.id);
    s.showToast('Đã chụp và gắn ảnh vào ghi chú họp');
    return asset;
  }
  if (target?.kind === 'task') {
    s.attachAssetToTask(target.id, asset.id);
    s.showToast('Đã chụp và gắn ảnh vào việc');
    return asset;
  }
  s.go({ name: 'images', assetId: asset.id });
  s.showToast(source === 'capture' ? 'Đã lưu ảnh gốc ' + asset.name : 'Đã thêm ảnh ' + asset.name);
  return asset;
}
