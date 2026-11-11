import { useEffect, useState } from 'react';
import { useStore, type BackupData } from '../lib/store';
import { Icon } from '../components/Icon';
import { Confirm } from '../components/ui';
import { blobToDataUrl, dataFolder, dataUrlToBlob, isTauri, openDataFolder, registerHotkey, saveBlobAs } from '../lib/platform';
import { getDb } from '../lib/db';
import { startCapture } from '../lib/capture';
import { fileStamp } from '../lib/dates';

export function SettingsView() {
  const s = useStore();
  const { settings, saveSettings, showToast } = s;
  const [hotkey, setHotkey] = useState(settings.captureHotkey);
  const [people, setPeople] = useState(settings.people.join(', '));
  const [folder, setFolder] = useState('');
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dataFolder().then(setFolder); }, []);

  const applyHotkey = async () => {
    const ok = await registerHotkey(hotkey, () => startCapture());
    if (!isTauri) { saveSettings({ captureHotkey: hotkey }); showToast('Bản web dùng Ctrl+Shift+S trong cửa sổ BAKit', 'info'); return; }
    if (ok) { saveSettings({ captureHotkey: hotkey }); showToast('Đã đổi phím chụp thành ' + hotkey); }
    else { showToast('Không đăng ký được ' + hotkey + ' — có thể đang bị ứng dụng khác dùng', 'err'); registerHotkey(settings.captureHotkey, () => startCapture()); }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const st = useStore.getState();
      const db = await getDb();
      const images: Record<string, string> = {};
      for (const a of st.assets) {
        for (const key of [a.originalKey, a.renderedKey]) {
          if (!key) continue;
          const b = await db.getBlob(key);
          if (b) images[key] = await blobToDataUrl(b);
        }
      }
      const data: BackupData & { images: Record<string, string> } = {
        version: 1, exportedAt: new Date().toISOString(), settings: st.settings, assets: st.assets, notes: Object.values(st.notes),
        tasks: st.tasks, projects: st.projects, items: st.items, images
      };
      const ok = await saveBlobAs(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'BAKit_backup_' + fileStamp() + '.json');
      if (ok) showToast('Đã xuất bản sao lưu');
    } catch (e) {
      showToast('Không xuất được: ' + String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const data = JSON.parse(await f.text()) as BackupData & { images?: Record<string, string> };
        if (data.version !== 1 || !Array.isArray(data.projects)) throw new Error('File không đúng định dạng sao lưu BAKit');
        const blobs: Record<string, Blob> = {};
        for (const [k, v] of Object.entries(data.images || {})) blobs[k] = await dataUrlToBlob(v);
        await useStore.getState().importData(data, blobs);
        showToast('Đã khôi phục dữ liệu từ ' + f.name);
      } catch (e) {
        showToast('Không khôi phục được: ' + String(e), 'err');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="hd">Cài đặt</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontSize: 15 }}>Giao diện</b>
          <div className="between"><span>Theme</span>
            <div className="seg">
              {([['system', 'Theo hệ điều hành'], ['light', 'Light'], ['dark', 'Dark']] as const).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? 'on' : ''} onClick={() => saveSettings({ theme: k })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="between"><span>Định dạng xuất ảnh mặc định</span>
            <div className="seg">
              {(['png', 'jpg', 'webp'] as const).map((k) => <button key={k} className={settings.exportFormat === k ? 'on' : ''} onClick={() => saveSettings({ exportFormat: k })}>{k.toUpperCase()}</button>)}
            </div>
          </div>
          <label className="field"><span className="lbl">Danh sách người (gợi ý khi chọn người phụ trách)</span>
            <input className="inp" value={people} onChange={(e) => setPeople(e.target.value)} onBlur={() => saveSettings({ people: people.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Linh Chi, Khoa, Bình…" />
          </label>
        </section>

        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontSize: 15 }}>Phím tắt chụp màn hình</b>
          <label className="field"><span className="lbl">Phím toàn cục (dùng được khi BAKit chạy nền)</span>
            <div className="row"><input className="inp" value={hotkey} onChange={(e) => setHotkey(e.target.value)} /><button className="btn" onClick={applyHotkey}>Áp dụng</button></div>
          </label>
          <span className="muted" style={{ fontSize: 12 }}>Ví dụ: CommandOrControl+Shift+S, Alt+Shift+A, F9. {isTauri ? '' : 'Bản web chỉ nhận Ctrl+Shift+S khi đang ở trong trang.'}</span>
          <div style={{ fontSize: 12.5, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6 }}>
            <span>Dán ảnh / gắn ảnh vào mục đang mở</span><span className="kbd">Ctrl+V</span>
            <span>Việc mới</span><span className="kbd">Ctrl+N</span>
            <span>Undo / Redo trong trình sửa ảnh</span><span className="kbd">Ctrl+Z / Ctrl+Y</span>
            <span>Copy ảnh đã sửa</span><span className="kbd">Ctrl+Shift+C</span>
          </div>
        </section>

        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, gridColumn: 'span 2' }}>
          <b style={{ fontSize: 15 }}>Dữ liệu</b>
          <div className="row"><span className="inp ro" style={{ flex: 1 }}>{folder}</span>{isTauri ? <button className="btn" onClick={openDataFolder}><Icon name="folder" />Mở thư mục</button> : null}</div>
          <span className="muted" style={{ fontSize: 12 }}>Mọi dữ liệu nằm trên máy này: ảnh gốc PNG không bao giờ bị ghi đè; danh sách, ghi chú, việc lưu trong SQLite. BAKit không upload gì ra Internet.</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy} onClick={exportBackup}><Icon name="download" />Xuất bản sao lưu (.json)</button>
            <button className="btn" disabled={busy} onClick={importBackup}>Khôi phục từ bản sao lưu…</button>
            <button className="btn dngo" style={{ marginLeft: 'auto' }} onClick={() => setAskReset(true)}><Icon name="trash" />Xóa toàn bộ dữ liệu (kể cả dữ liệu mẫu)</button>
          </div>
        </section>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>BAKit 0.1.0 · {isTauri ? 'Ứng dụng Windows' : 'Bản chạy thử trên trình duyệt'}</span>
      {askReset ? <Confirm title="Xóa toàn bộ dữ liệu?" danger okLabel="Xóa hết" body="Tất cả dự án, checklist, việc, ghi chú và ảnh chụp trên máy này sẽ bị xóa vĩnh viễn. Nên xuất bản sao lưu trước." onOk={async () => { await s.resetAll(); showToast('Đã xóa toàn bộ dữ liệu'); }} onClose={() => setAskReset(false)} /> : null}
    </div>
  );
}
