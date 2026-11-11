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
}

// ---------- Clipboard ----------
export async function copyImage(blob: Blob): Promise<void> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return;
  } catch (err) {
    if (!isTauri) throw err;
  }
  const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
  await writeImage(new Uint8Array(await blob.arrayBuffer()));
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

/** Image + note as one clipboard item (HTML for rich editors like Azure DevOps, plus PNG and plain text). */
export async function copyImageAndText(blob: Blob, text: string): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const html = `<div><p>${esc}</p><img src="${dataUrl}"></div>`;
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'image/png': blob
    })
  ]);
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
