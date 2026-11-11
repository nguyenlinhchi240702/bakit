import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { installUpdate } from '../lib/updater';
import { isMac } from '../lib/platform';
import { Modal } from './ui';

/** "Có bản mới" dialog: release notes, progress bar, then BAKit restarts on the new version. */
export function UpdateDialog() {
  const update = useStore((s) => s.update);
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState<number | null | undefined>(undefined); // undefined = not started
  const [err, setErr] = useState('');
  useEffect(() => {
    const f = () => setOpen(true);
    window.addEventListener('bakit:show-update', f);
    return () => window.removeEventListener('bakit:show-update', f);
  }, []);
  if (!open || !update) return null;
  const busy = pct !== undefined && !err;
  const run = async () => {
    setErr(''); setPct(null);
    try { await installUpdate(setPct); }
    catch (e) { setErr(String(e)); setPct(undefined); }
  };
  return (
    <Modal title={'Cập nhật BAKit ' + update.version} onClose={() => !busy && setOpen(false)} width={480} footer={<>
      <button className="btn" disabled={busy} onClick={() => setOpen(false)}>Để sau</button>
      <button className="btn pri" disabled={busy} onClick={run}>{busy ? 'Đang cập nhật…' : 'Cập nhật ngay'}</button>
    </>}>
      <span>Bạn đang dùng bản <b>{update.current}</b>. Bản mới: <b>{update.version}</b>.</span>
      {update.notes ? <div className="card" style={{ padding: '10px 12px', fontSize: 12.5, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{update.notes}</div> : null}
      <span className="muted" style={{ fontSize: 12.5 }}>Dữ liệu (dự án, ảnh, ghi chú, cuộc họp) được giữ nguyên. BAKit sẽ tự mở lại sau khi cài.
        {isMac ? ' Nếu sau đó chụp màn hình chỉ ra hình nền, bật lại quyền Ghi màn hình cho BAKit trong System Settings.' : ''}</span>
      {pct !== undefined ? (
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (pct ?? 30) + '%', background: 'var(--accent)', transition: 'width .2s' }} />
        </div>
      ) : null}
      {err ? <div className="banner err">Không cập nhật được: {err}</div> : null}
    </Modal>
  );
}
