// Platform layer: everything that differs between the Windows app (Tauri) and the browser demo.

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface ScreenShot {
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  primary: boolean;
  src: string;      // URL the overlay can load (asset:// in Tauri, data: in browser)
  path?: string;    // file path (Tauri)
  logical?: boolean; // macOS: x/y/lw/lh are points, not pixels
  lw?: number;
  lh?: number;
}

/** macOS uses ⌘ instead of Ctrl. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** Show a shortcut label in the platform's convention: "Ctrl+Shift+S" → "⌘⇧S" on Mac. */
export function kb(label: string): string {
  return isMac ? label.replace(/Ctrl\+Shift\+/g, '⌘⇧').replace(/Ctrl\+/g, '⌘').replace(/Shift\+(?=[A-Z0-9])/g, '⇧') : label;
}
/** Ctrl on Windows, ⌘ on Mac. */
export const modKey = (e: { ctrlKey: boolean; metaKey: boolean }) => (isMac ? e.metaKey || e.ctrlKey : e.ctrlKey);

// ---------- Clipboard ----------
// Safari / macOS WebView only allow clipboard writes while the click is still "active",
// so the ClipboardItem is created synchronously with *promises* for slow data (rendering).
// Chromium accepts the same; anything that still fails falls back to the desktop plugin.
type BlobLike = Blob | Promise<Blob>;

async function writeItem(make: () => Record<string, BlobLike>, settle: () => Promise<Record<string, Blob>>): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    await navigator.clipboard.write([new ClipboardItem(make())]);
    return true;
  } catch {
    // Some engines reject promise values: retry once with resolved blobs.
    try {
      await navigator.clipboard.write([new ClipboardItem(await settle())]);
      return true;
    } catch {
      return false;
    }
  }
}

export async function copyImage(blob: BlobLike): Promise<void> {
  const png = Promise.resolve(blob);
  const ok = await writeItem(() => ({ 'image/png': png }), async () => ({ 'image/png': await png }));
  if (ok) return;
  if (!isTauri) throw new Error('Trình duyệt không cho ghi ảnh vào clipboard');
  const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
  await writeImage(new Uint8Array(await (await png).arrayBuffer()));
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (err) {
    if (!isTauri) throw err;
  }
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
  await writeText(text);
}

function noteHtml(text: string, dataUrl: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<div>${esc ? `<p>${esc}</p>` : ''}<img src="${dataUrl}"></div>`;
}

/** Image + note as one clipboard item (HTML for rich editors like Azure DevOps / Teams / Word, plus PNG and plain text). */
export async function copyImageAndText(blob: BlobLike, text: string): Promise<void> {
  const png = Promise.resolve(blob);
  const html = png.then(async (b) => new Blob([noteHtml(text, await blobToDataUrl(b))], { type: 'text/html' }));
  const plain = new Blob([text], { type: 'text/plain' });
  const ok = await writeItem(
    () => ({ 'text/html': html, 'text/plain': plain, 'image/png': png }),
    async () => ({ 'text/html': await html, 'text/plain': plain, 'image/png': await png })
  );
  if (ok) return;
  if (!isTauri) throw new Error('Trình duyệt không cho ghi ảnh + chữ vào clipboard');
  // Desktop fallback: HTML (note + embedded image) with the note as plain-text alternative.
  const { writeHtml } = await import('@tauri-apps/plugin-clipboard-manager');
  await writeHtml(noteHtml(text, await blobToDataUrl(await png)), text);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
export async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

// ---------- Notifications ----------
export async function notify(title: string, body: string): Promise<void> {
  if (isTauri) {
    const n = await import('@tauri-apps/plugin-notification');
    let ok = await n.isPermissionGranted();
    if (!ok) ok = (await n.requestPermission()) === 'granted';
    if (ok) n.sendNotification({ title, body });
    return;
  }
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification(title, { body });
}

// ---------- Global hotkey ----------
export async function registerHotkey(accel: string, handler: () => void): Promise<boolean> {
  if (!isTauri) return false;
  const gs = await import('@tauri-apps/plugin-global-shortcut');
  try {
    await gs.unregisterAll();
    await gs.register(accel, (e) => {
      if (e.state === 'Pressed') handler();
    });
    return true;
  } catch {
    return false;
  }
}

// ---------- Screen capture ----------
/** Tauri: hide BAKit, grab every monitor (Rust/xcap). Browser: ask for a screen via getDisplayMedia. */
export async function grabScreens(): Promise<ScreenShot[]> {
  if (isTauri) {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const shots = await invoke<Array<Omit<ScreenShot, 'src'> & { path: string }>>('capture_monitors');
    return shots.map((s) => ({ ...s, src: convertFileSrc(s.path) }));
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return [{
      index: 0, name: 'Màn hình đã chia sẻ', x: 0, y: 0, width: canvas.width, height: canvas.height,
      scale: 1, primary: true, src: canvas.toDataURL('image/png')
    }];
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// ---------- Files ----------
export function pickImageFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/bmp,image/gif';
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

export async function saveBlobAs(blob: Blob, fileName: string): Promise<boolean> {
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const ext = fileName.split('.').pop() || 'png';
    const path = await save({ defaultPath: fileName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

export async function dataFolder(): Promise<string> {
  if (!isTauri) return 'Bộ nhớ trình duyệt (IndexedDB)';
  const { appDataDir } = await import('@tauri-apps/api/path');
  return appDataDir();
}

export async function openDataFolder(): Promise<void> {
  if (!isTauri) return;
  const { appDataDir } = await import('@tauri-apps/api/path');
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(await appDataDir());
}

export async function showMainWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  await w.show();
  await w.unminimize();
  await w.setFocus();
}
export async function hideMainWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().hide();
}

// ---------- Links ----------
export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl: open } = await import('@tauri-apps/plugin-opener');
    await open(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/** "#12345" / "AB#12345" → https://dev.azure.com/org/project/_workitems/edit/12345 (when an Azure link is set). */
export function workItemUrl(workItem: string | undefined, base: string | undefined): string | undefined {
  const m = workItem?.match(/(\d{2,})/);
  if (!m || !base?.trim()) return undefined;
  return base.trim().replace(/\/+$/, '') + '/_workitems/edit/' + m[1];
}
