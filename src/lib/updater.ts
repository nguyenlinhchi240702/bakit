// In-app updates (desktop only): checks GitHub Releases for a newer signed build,
// downloads it, installs it and restarts BAKit. Data in AppData is never touched.
import { isTauri } from './platform';
import { useStore } from './store';

export interface UpdateInfo { version: string; current: string; notes?: string; date?: string }
type Pending = { info: UpdateInfo; install: (onProgress: (pct: number | null) => void) => Promise<void> };
let pending: Pending | null = null;

export async function appVersion(): Promise<string> {
  if (!isTauri) return __APP_VERSION__;
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

/** Returns the update if one exists. `manual` shows "already latest" / errors as toasts. */
export async function checkForUpdate(manual = false): Promise<UpdateInfo | null> {
  const s = useStore.getState();
  if (!isTauri) {
    if (manual) s.showToast('Bản chạy thử trên trình duyệt luôn là bản mới nhất', 'info');
    return null;
  }
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const u = await check();
    if (!u) {
      if (manual) s.showToast('Bạn đang dùng bản mới nhất (' + (await appVersion()) + ')');
      return null;
    }
    const info: UpdateInfo = { version: u.version, current: u.currentVersion, notes: u.body || undefined, date: u.date || undefined };
    pending = {
      info,
      install: async (onProgress) => {
        let total = 0, got = 0;
        await u.downloadAndInstall((e) => {
          if (e.event === 'Started') { total = e.data.contentLength || 0; onProgress(total ? 0 : null); }
          else if (e.event === 'Progress') { got += e.data.chunkLength; onProgress(total ? Math.min(100, Math.round((got / total) * 100)) : null); }
          else if (e.event === 'Finished') onProgress(100);
        });
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }
    };
    useStore.setState({ update: info });
    if (!manual) s.showToast('Có bản BAKit ' + info.version + ' mới', 'info', { label: 'Cập nhật', run: () => window.dispatchEvent(new Event('bakit:show-update')) });
    else window.dispatchEvent(new Event('bakit:show-update'));
    return info;
  } catch (e) {
    if (manual) s.showToast('Không kiểm tra được cập nhật (cần mạng): ' + String(e), 'err');
    return null;
  }
}

export async function installUpdate(onProgress: (pct: number | null) => void): Promise<void> {
  if (!pending) throw new Error('Chưa có bản cập nhật');
  await pending.install(onProgress);
}
