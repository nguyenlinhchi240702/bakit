import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Editor, type EditorApi } from '../editor/Editor';
import { AssetThumb, Confirm, Modal, WorkItemChip } from '../components/ui';
import { Icon } from '../components/Icon';
import { copyImage, copyImageAndText, copyText, kb, pickImageFiles, saveBlobAs } from '../lib/platform';
import { startCapture } from '../lib/capture';
import { routeImages } from '../lib/paste';
import { matches } from '../lib/util';
import { addDays, ddmmyyyy, toKey, todayKey } from '../lib/dates';
import type { Asset } from '../lib/types';

function dayLabel(iso: string) {
  const k = toKey(new Date(iso));
  const t = todayKey();
  if (k === t) return 'Hôm nay';
  if (k === addDays(t, -1)) return 'Hôm qua';
  return ddmmyyyy(k);
}
const timeOf = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export function ImagesView({ assetId }: { assetId?: string }) {
  const { assets, go } = useStore();
  const [q, setQ] = useState('');
  const current = assets.find((a) => a.id === assetId) || assets[0];
  const list = useMemo(() => assets.filter((a) => !q || [a.name, a.note, a.workItem].some((f) => f && matches(f, q))), [assets, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Asset[]>();
    list.forEach((a) => { const k = dayLabel(a.createdAt); m.set(k, [...(m.get(k) || []), a]); });
    return Array.from(m.entries());
  }, [list]);
  const apiRef = useRef<EditorApi | null>(null);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <aside style={{ width: 268, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="inp" style={{ height: 32 }}><Icon name="search" size={14} className="muted" /><input className="ghost-input" style={{ height: 28 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, ghi chú, #work item" /></label>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" style={{ flex: 1 }} onClick={async () => { const f = await pickImageFiles(); routeImages(f, 'file', f.map((x) => x.name.replace(/\.[^.]+$/, ''))); }}>Mở file…</button>
            <button className="btn sm pri" style={{ flex: 1 }} onClick={() => startCapture()}><Icon name="capture" size={13} />Chụp</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {groups.map(([label, arr]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="sec" style={{ padding: '8px 4px 4px' }}>{label}</div>
              {arr.map((a) => (
                <button key={a.id} className={'opt' + (a.id === current?.id ? ' on' : '')} onClick={() => go({ name: 'images', assetId: a.id })}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: 7, borderRadius: 8, borderColor: a.id === current?.id ? undefined : 'transparent' }}>
                  <AssetThumb asset={a} w={84} h={52} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.note.split('\n')[0] || a.name}</span>
                    <span className="row" style={{ gap: 6, fontSize: 11.5 }}><span className="muted">{timeOf(a.createdAt)}</span><WorkItemChip value={a.workItem} style={{ height: 18, fontSize: 11 }} /></span>
                  </span>
                </button>
              ))}
            </div>
          ))}
          {assets.length === 0 ? <div className="muted" style={{ fontSize: 12.5, padding: 8 }}>Chưa có ảnh nào.</div> : null}
          <div className="drop" style={{ marginTop: 'auto', padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Kéo file ảnh vào cửa sổ để thêm</div>
        </div>
      </aside>

      {current ? (
        <>
          <Editor key={current.id} asset={current} apiRef={apiRef} />
          <NotePanel key={'n' + current.id} asset={current} apiRef={apiRef} />
        </>
      ) : (
        <div className="editor-stage" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="drop on" style={{ width: 560, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <Icon name="image" size={34} />
            <b style={{ fontSize: 18 }}>Chưa có ảnh</b>
            <span className="muted">Chụp màn hình, dán ảnh bằng <span className="kbd">{kb('Ctrl+V')}</span> hoặc kéo file ảnh vào đây.</span>
            <div className="row">
              <button className="btn pri" onClick={() => startCapture()}><Icon name="capture" />Chụp vùng <span className="kbd-hint">{kb('Ctrl+Shift+S')}</span></button>
              <button className="btn" onClick={async () => { const f = await pickImageFiles(); routeImages(f, 'file', f.map((x) => x.name.replace(/\.[^.]+$/, ''))); }}>Mở file…</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotePanel({ asset, apiRef }: { asset: Asset; apiRef: React.MutableRefObject<EditorApi | null> }) {
  const { updateAsset, showToast, settings, deleteAsset, assetRefs, go } = useStore();
  const [note, setNote] = useState(asset.note);
  const [wi, setWi] = useState(asset.workItem);
  const [name, setName] = useState(asset.name);
  const [attach, setAttach] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = (p: Partial<Asset>) => { clearTimeout(timer.current); timer.current = setTimeout(() => updateAsset(asset.id, p), 400); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const render = async (fmt?: 'png' | 'jpg' | 'webp') => {
    if (!apiRef.current) throw new Error('Trình sửa ảnh chưa sẵn sàng');
    return apiRef.current.render(fmt);
  };
  const run = async (fn: () => Promise<void>, ok: string, failHint = '') => {
    try { await fn(); showToast(ok); }
    catch (e) { showToast('Không copy được' + (failHint ? ' — ' + failHint : '') + ': ' + String(e), 'err', { label: 'Lưu ra file', run: () => saveFile() }); }
  };
  const saveFile = async () => {
    try {
      const fmt = settings.exportFormat;
      const ok = await saveBlobAs(await render(fmt), asset.name + '.' + fmt);
      if (ok) showToast('Đã lưu ' + asset.name + '.' + fmt);
    } catch (e) { showToast('Không lưu được: ' + String(e), 'err'); }
  };
  const refs = assetRefs(asset.id);

  return (
    <aside className="panel" style={{ width: 320 }}>
      <div style={{ padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input className="inp" style={{ fontWeight: 650, border: '1px solid transparent', padding: '0 6px', height: 30 }} value={name} aria-label="Tên ảnh"
          onChange={(e) => { setName(e.target.value); save({ name: e.target.value || asset.name }); }} />
        <span className="muted" style={{ fontSize: 12, paddingLeft: 6 }}>{asset.width} × {asset.height} · {new Date(asset.createdAt).toLocaleString('vi-VN')} · ảnh gốc được giữ nguyên</span>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        <label className="field" style={{ flex: 1, minHeight: 160 }}><span className="lbl">Ghi chú</span>
          <textarea className="inp" style={{ flex: 1, minHeight: 140, fontSize: 13.5, lineHeight: 1.55 }} value={note} placeholder="Mô tả vấn đề, các bước, kết quả mong đợi…"
            onChange={(e) => { setNote(e.target.value); save({ note: e.target.value }); }} /></label>
        <label className="field"><span className="lbl">Work item Azure <span className="muted" style={{ fontWeight: 400 }}>(tùy chọn)</span></span>
          <input className="inp" value={wi} placeholder="#4521" onChange={(e) => { setWi(e.target.value); save({ workItem: e.target.value }); }} /></label>
        {refs.length ? <div className="row" style={{ gap: 6, flexWrap: 'wrap', fontSize: 12 }}><span className="muted">Đang gắn với:</span>{refs.map((r) => <span key={r} className="chip">{r}</span>)}</div> : null}
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAttach(true)}><Icon name="folder" size={13} />Gắn vào mục checklist…</button>
      </div>
      <div style={{ padding: '14px 16px', marginTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-2)' }}>
        <button className="btn pri lg" style={{ width: '100%' }} onClick={() => run(() => copyImage(render()), kb('Đã copy ảnh — Ctrl+V vào Azure / Teams / Word'))}><Icon name="copy" />Copy ảnh <span className="kbd-hint">{kb('Ctrl+Shift+C')}</span></button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <button className="btn" onClick={() => run(() => copyText([note, wi].filter(Boolean).join('\n')), 'Đã copy ghi chú')} disabled={!note && !wi}>Copy ghi chú</button>
          <button className="btn" onClick={() => run(() => copyImageAndText(render(), [note, wi].filter(Boolean).join('\n')), 'Đã copy ảnh + ghi chú', 'thử Copy ảnh và Copy ghi chú riêng')}>Copy ảnh + ghi chú</button>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn ghost sm" onClick={saveFile}><Icon name="download" size={13} />Lưu ra file {settings.exportFormat.toUpperCase()}</button>
          <button className="btn ghost sm dngo" onClick={() => (refs.length ? showToast('Ảnh đang gắn với ' + refs.join(', ') + ' — gỡ ra trước khi xóa', 'err') : setAskDel(true))}><Icon name="trash" size={13} />Xóa ảnh</button>
        </div>
        <span className="muted" style={{ fontSize: 11.5, textAlign: 'center' }}>Dán vào Repro Steps hoặc Discussion trên Azure bằng {kb('Ctrl+V')}</span>
      </div>
      {attach ? <AttachModal asset={asset} onClose={() => setAttach(false)} /> : null}
      {askDel ? <Confirm title="Xóa ảnh này?" danger okLabel="Xóa vĩnh viễn" body="Ảnh gốc, bản đã sửa và ghi chú sẽ bị xóa khỏi máy." onOk={async () => { await deleteAsset(asset.id); go({ name: 'images' }); showToast('Đã xóa ảnh'); }} onClose={() => setAskDel(false)} /> : null}
    </aside>
  );
}

function AttachModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const { projects, items, attachAssetToItem, showToast, go } = useStore();
  const active = projects.filter((p) => !p.archived);
  const [pid, setPid] = useState(active.find((p) => p.pinned)?.id || active[0]?.id || '');
  const proj = active.find((p) => p.id === pid);
  const [lid, setLid] = useState(proj?.lists[0]?.id || '');
  const list = proj?.lists.find((l) => l.id === lid) || proj?.lists[0];
  const its = items.filter((i) => i.listId === list?.id && !list?.statuses.find((s) => s.id === i.statusId)?.done);
  const [iid, setIid] = useState('');
  const [newTitle, setNewTitle] = useState(asset.note.split('\n')[0] || '');
  const done = (itemId: string, code: string) => {
    attachAssetToItem(itemId, asset.id);
    showToast('Đã gắn ảnh vào ' + code, 'ok', { label: 'Mở mục', run: () => go({ name: 'project', projectId: pid, listId: list!.id, itemId }) });
    onClose();
  };
  return (
    <Modal title="Gắn ảnh vào checklist" onClose={onClose} width={480}>
      {active.length === 0 ? <span className="muted">Chưa có dự án nào. Tạo dự án ở mục “Tất cả dự án”.</span> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="field"><span className="lbl">Dự án</span><select className="inp" value={pid} onChange={(e) => { setPid(e.target.value); setLid(''); setIid(''); }}>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field"><span className="lbl">Danh sách</span><select className="inp" value={list?.id || ''} onChange={(e) => { setLid(e.target.value); setIid(''); }}>{proj?.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          </div>
          <label className="field"><span className="lbl">Mục có sẵn (chưa xong)</span>
            <select className="inp" value={iid} onChange={(e) => setIid(e.target.value)}><option value="">— Chọn mục —</option>{its.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}</select></label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn pri" disabled={!iid} onClick={() => { const it = items.find((i) => i.id === iid)!; done(it.id, it.code); }}>Gắn vào mục đã chọn</button>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <label className="field"><span className="lbl">Hoặc tạo mục mới trong {list?.name}</span>
            <div className="row"><input className="inp" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Tiêu đề mục mới" />
              <button className="btn" disabled={!newTitle.trim() || !list} onClick={() => { const it = useStore.getState().addItem(pid, list!.id, newTitle.trim(), { workItem: asset.workItem, note: asset.note }); if (it) done(it.id, it.code); }}>Tạo &amp; gắn</button></div></label>
        </>
      )}
    </Modal>
  );
}
