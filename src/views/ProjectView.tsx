import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Icon } from '../components/Icon';
import { AssetThumb, Avatar, Check, Confirm, PeopleInput, Popover, StatusPill } from '../components/ui';
import { ProjectModal } from '../components/ProjectModal';
import { AddListModal, ListConfigModal } from '../components/ListConfig';
import { COLOR_STYLE } from '../lib/templates';
import { ddmm, toIso, todayKey } from '../lib/dates';
import { initials, matches } from '../lib/util';
import { copyText, kb, pickImageFiles } from '../lib/platform';
import { startCapture } from '../lib/capture';
import { pushImageHandler } from '../lib/paste';
import type { Item } from '../lib/types';

type Filter = 'all' | 'late' | 'open' | 'img';

export function ProjectView({ projectId, listId }: { projectId: string; listId?: string }) {
  const s = useStore();
  const { projects, items, go, view } = s;
  const project = projects.find((p) => p.id === projectId);
  const list = project?.lists.find((l) => l.id === listId) || project?.lists[0];
  const [selId, setSelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [owner, setOwner] = useState('');
  const [q, setQ] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [projMenu, setProjMenu] = useState(false);
  const [cfg, setCfg] = useState(false);
  const [addList, setAddList] = useState(false);
  const [editProj, setEditProj] = useState(false);
  const [statusMenu, setStatusMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const T = todayKey();

  useEffect(() => {
    if (view.name === 'project' && view.itemId) setSelId(view.itemId);
  }, [view]);

  const rows = useMemo(() => {
    if (!list) return [];
    return items.filter((i) => i.listId === list.id).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)).filter((i) => {
      const st = list.statuses.find((x) => x.id === i.statusId);
      if (filter === 'late' && !(i.due && i.due < T && !st?.done)) return false;
      if (filter === 'open' && st?.done) return false;
      if (filter === 'img' && !i.assetIds.length) return false;
      if (owner && i.owner !== owner) return false;
      if (q && ![i.code, i.title, i.note, i.cat, i.workItem].some((f) => f && matches(f, q))) return false;
      return true;
    });
  }, [items, list, filter, owner, q, T]);

  if (!project || !list) {
    return <div className="page"><div className="empty card"><b>Không tìm thấy dự án</b><button className="btn" onClick={() => go({ name: 'projects' })}>Về danh sách dự án</button></div></div>;
  }
  const all = items.filter((i) => i.listId === list.id);
  const doneN = all.filter((i) => list.statuses.find((x) => x.id === i.statusId)?.done).length;
  const owners = Array.from(new Set(all.map((i) => i.owner).filter(Boolean)));
  const sel = items.find((i) => i.id === selId && i.listId === list.id) || rows[0];
  const c = list.cols;

  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    const it = s.addItem(project.id, list.id, t);
    if (it) { setSelId(it.id); s.showToast('Đã thêm ' + it.code); }
    setNewTitle('');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '16px 22px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <div className="between">
          <div className="row" style={{ gap: 8, position: 'relative' }}>
            <button className="btn ghost" style={{ fontSize: 20, fontWeight: 700, height: 38, padding: '0 8px' }} onClick={() => setProjMenu(!projMenu)}>
              <span style={{ width: 10, height: 22, borderRadius: 3, background: project.color }} />{project.name}<Icon name="chevDown" />
            </button>
            {project.phase ? <span className="chip blue">{project.phase}</span> : null}
            <button className={'btn sm' + (project.pinned ? ' pri' : '')} onClick={() => s.togglePin(project.id)} title="Ghim dự án ra menu trái">
              <Icon name="pin" size={14} style={{ fill: project.pinned ? 'currentColor' : 'none' }} />{project.pinned ? 'Đã ghim' : 'Ghim ra menu'}
            </button>
            <button className="btn ghost sm sq" aria-label="Sửa thông tin dự án" title="Sửa thông tin dự án" onClick={() => setEditProj(true)}><Icon name="settings" size={14} /></button>
            <Popover open={projMenu} onClose={() => setProjMenu(false)} style={{ left: 0, top: 44, width: 360 }}>
              <div className="mhd">Chuyển dự án · ghim để hiện ở menu trái</div>
              {projects.filter((p) => !p.archived).map((p) => (
                <div key={p.id} className={'mi' + (p.id === project.id ? ' hl' : '')} style={{ height: 44, cursor: 'pointer' }} onClick={() => { go({ name: 'project', projectId: p.id }); setProjMenu(false); }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: p.color, color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(p.name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}><b>{p.name}</b><span className="muted" style={{ fontSize: 11.5 }}>{p.phase || p.client || '—'}</span></span>
                  <button className="btn ghost sm sq" style={{ marginLeft: 'auto', color: p.pinned ? 'var(--accent-text)' : 'var(--text-3)' }} aria-label={p.pinned ? 'Bỏ ghim' : 'Ghim'} title={p.pinned ? 'Bỏ ghim' : 'Ghim ra menu trái'}
                    onClick={(e) => { e.stopPropagation(); s.togglePin(p.id); }}><Icon name="pin" size={14} style={{ fill: p.pinned ? 'currentColor' : 'none' }} /></button>
                </div>
              ))}
              <div className="msep" />
              <button className="mi" onClick={() => { go({ name: 'projects' }); setProjMenu(false); }}>Tất cả dự án →</button>
            </Popover>
          </div>
          <button className="btn sm" onClick={() => setCfg(true)}><Icon name="columns" size={14} />Cột &amp; trạng thái</button>
        </div>

        <div className="row" style={{ gap: 2, borderBottom: '1px solid var(--border)', flex: 'none', overflowX: 'auto' }}>
          {project.lists.map((l) => {
            const li = items.filter((i) => i.listId === l.id);
            const open = li.filter((i) => !l.statuses.find((x) => x.id === i.statusId)?.done);
            const late = open.some((i) => i.due && i.due < T);
            const on = l.id === list.id;
            return (
              <button key={l.id} onClick={() => { go({ name: 'project', projectId: project.id, listId: l.id }); setSelId(null); }}
                style={{ height: 40, padding: '0 12px', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: on ? 650 : 500, color: on ? 'var(--text)' : 'var(--text-2)', borderBottom: '2px solid ' + (on ? 'var(--accent)' : 'transparent'), marginBottom: -1, whiteSpace: 'nowrap' }}>
                {l.name}<span className={'chip' + (late ? ' red' : '')}>{open.length}/{li.length}</span>
              </button>
            );
          })}
          <button className="btn ghost sm" style={{ marginLeft: 4, flex: 'none' }} onClick={() => setAddList(true)}><Icon name="plus" size={13} />Danh sách</button>
        </div>

        <div className="between" style={{ flex: 'none' }}>
          <div className="row" style={{ gap: 6 }}>
            <label className="inp" style={{ width: 220, height: 30 }}><Icon name="search" size={14} className="muted" /><input className="ghost-input" style={{ height: 26, fontSize: 12.5 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={'Tìm trong ' + list.name + '…'} /></label>
            {([['all', 'Tất cả'], ['open', 'Chưa xong'], ['late', 'Quá hạn'], ['img', 'Có ảnh']] as Array<[Filter, string]>).map(([k, l]) => (
              <button key={k} className={'btn sm' + (filter === k ? ' pri' : '')} onClick={() => setFilter(k)}>{l}</button>
            ))}
            {owners.length ? (
              <select className="inp" style={{ height: 28, width: 140 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Lọc theo người">
                <option value="">Mọi người</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : null}
          </div>
          <div className="row" style={{ gap: 10, fontSize: 12.5 }}>
            <span className="muted">{doneN}/{all.length} đã thực hiện</span>
            <div style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ height: 6, width: all.length ? (doneN * 100) / all.length + '%' : 0, background: 'var(--success)' }} /></div>
          </div>
        </div>

        <div className="card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', flex: 'none' }}>
            <span style={{ width: 40 }} /><span style={{ width: 62 }}>Mã</span><span style={{ flex: 1, padding: '0 8px' }}>{list.name}</span>
            {c.cat ? <span style={{ width: 130, padding: '0 8px' }}>{list.catLabel}</span> : null}
            <span style={{ width: 136, padding: '0 8px' }}>Trạng thái</span>
            {c.owner ? <span style={{ width: 120, padding: '0 8px' }}>Người</span> : null}
            {c.due ? <span style={{ width: 64 }}>Hạn</span> : null}
            {c.note ? <span style={{ width: 170, padding: '0 8px' }}>Ghi chú</span> : null}
            {c.attach ? <span style={{ width: 70 }}>Đính kèm</span> : null}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {rows.map((it) => {
              const st = list.statuses.find((x) => x.id === it.statusId);
              const late = !!it.due && it.due < T && !st?.done;
              const isSel = sel?.id === it.id;
              return (
                <div key={it.id} className={'grid-row' + (isSel ? ' sel' : '')} onClick={() => setSelId(it.id)} style={{ boxShadow: late ? 'inset 3px 0 0 var(--danger)' : isSel ? 'inset 3px 0 0 var(--accent)' : 'none' }}>
                  <span style={{ width: 40, paddingLeft: 14, display: 'flex' }}><Check on={!!st?.done} onClick={() => s.tickItem(it.id)} /></span>
                  <span className="muted" style={{ width: 62, fontSize: 12.5 }}>{it.code}</span>
                  <span style={{ flex: 1, minWidth: 0, padding: '0 8px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: st?.done ? 'line-through' : 'none', color: st?.done ? 'var(--text-3)' : 'var(--text)' }}>{it.title}</span>
                  {c.cat ? <span className="muted" style={{ width: 130, padding: '0 8px', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.cat || '—'}</span> : null}
                  <span style={{ width: 136, padding: '0 8px' }}><StatusPill status={st} title="Chọn trạng thái" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStatusMenu({ id: it.id, x: r.left, y: r.bottom + 4 }); }} /></span>
                  {c.owner ? <span style={{ width: 120, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>{it.owner ? <><Avatar name={it.owner} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.owner}</span></> : <span className="muted">—</span>}</span> : null}
                  {c.due ? <span style={{ width: 64, fontSize: 12.5, color: late ? 'var(--danger)' : 'var(--text-2)', fontWeight: late ? 700 : 400 }}>{ddmm(it.due)}{late ? ' !' : ''}</span> : null}
                  {c.note ? <span className="muted" style={{ width: 170, padding: '0 8px', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.note || '—'}</span> : null}
                  {c.attach ? <span style={{ width: 70, display: 'flex', gap: 4 }}>
                    {it.assetIds.length ? <span className="chip" style={{ height: 20, padding: '0 6px' }}><Icon name="image" size={12} />{it.assetIds.length}</span> : null}
                    {it.workItem ? <span className="chip blue" style={{ height: 20, padding: '0 5px' }} title={'Azure ' + it.workItem}>AZ</span> : null}
                  </span> : null}
                </div>
              );
            })}
            {rows.length === 0 && all.length > 0 ? <div className="empty">Không có mục nào khớp bộ lọc.</div> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 10px 0 14px' }}>
              <Icon name="plus" className="muted" />
              <input className="ghost-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={'Thêm ' + list.name.toLowerCase() + ' mới… (Enter)'} aria-label="Thêm mục mới" />
              <button className="btn sm pri" onClick={add}>Thêm</button>
            </div>
          </div>
        </div>
      </div>

      {sel ? <ItemPanel key={sel.id} item={sel} /> : (
        <aside className="panel"><div className="empty" style={{ marginTop: 60 }}><Icon name="tasks" size={28} />Chọn một mục để xem chi tiết, hoặc gõ vào dòng cuối bảng để thêm mới.</div></aside>
      )}

      {statusMenu ? (
        <StatusMenu x={statusMenu.x} y={statusMenu.y} itemId={statusMenu.id} onClose={() => setStatusMenu(null)} />
      ) : null}
      {cfg ? <ListConfigModal project={project} list={list} onClose={() => setCfg(false)} /> : null}
      {addList ? <AddListModal project={project} onClose={() => setAddList(false)} /> : null}
      {editProj ? <ProjectModal project={project} onClose={() => setEditProj(false)} /> : null}
    </div>
  );
}

function StatusMenu({ x, y, itemId, onClose }: { x: number; y: number; itemId: string; onClose: () => void }) {
  const { items, projects, setItemStatus } = useStore();
  const it = items.find((i) => i.id === itemId);
  const list = it && projects.find((p) => p.id === it.projectId)?.lists.find((l) => l.id === it.listId);
  if (!it || !list) return null;
  return (
    <Popover open onClose={onClose} style={{ position: 'fixed', left: x, top: y, width: 200 }}>
      {list.statuses.map((st) => (
        <button key={st.id} className={'mi' + (st.id === it.statusId ? ' hl' : '')} onClick={() => { setItemStatus(it.id, st.id); onClose(); }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR_STYLE[st.color].fg }} />{st.name}{st.done ? <span className="k">xong</span> : null}
        </button>
      ))}
    </Popover>
  );
}

function ItemPanel({ item }: { item: Item }) {
  const s = useStore();
  const { projects, assets, go } = s;
  const project = projects.find((p) => p.id === item.projectId)!;
  const list = project.lists.find((l) => l.id === item.listId)!;
  const st = list.statuses.find((x) => x.id === item.statusId);
  const [askDel, setAskDel] = useState(false);
  const T = todayKey();
  const late = !!item.due && item.due < T && !st?.done;

  // Debounced text fields so typing does not write to disk on every key.
  const [draft, setDraft] = useState({ title: item.title, cat: item.cat, note: item.note, workItem: item.workItem });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const edit = (p: Partial<typeof draft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => s.updateItem(item.id, next), 400);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Ctrl+V while this item is open attaches the image to it.
  useEffect(() => pushImageHandler((blobs) => {
    Promise.all(blobs.map((b) => useStore.getState().addImage(b, 'paste'))).then((as) => {
      as.forEach((a) => useStore.getState().attachAssetToItem(item.id, a.id));
      useStore.getState().showToast('Đã dán ' + as.length + ' ảnh vào ' + item.code);
    });
    return true;
  }), [item.id, item.code]);

  const addFiles = async () => {
    const files = await pickImageFiles();
    for (const f of files) {
      const a = await useStore.getState().addImage(f, 'file', f.name.replace(/\.[^.]+$/, ''));
      useStore.getState().attachAssetToItem(item.id, a.id);
    }
  };
  const remind = () => {
    const date = item.due && item.due >= T ? item.due : T;
    s.addTask({ kind: 'task', title: item.code + ' · ' + item.title, date, remindAt: toIso(date, '09:00'), workItem: item.workItem || undefined });
    s.showToast('Đã tạo nhắc việc ' + (date === T ? 'hôm nay' : ddmm(date)) + ' 09:00 · xem ở Hôm nay');
  };
  const copy = async () => {
    const text = `${item.code} · ${item.title}\nDự án: ${project.name} › ${list.name}\nTrạng thái: ${st?.name || '—'}${item.owner ? '\nNgười: ' + item.owner : ''}${item.due ? '\nHạn: ' + ddmm(item.due) : ''}${item.workItem ? '\nWork item: ' + item.workItem : ''}${item.note ? '\nGhi chú: ' + item.note : ''}`;
    await copyText(text);
    s.showToast('Đã copy ' + item.code);
  };

  return (
    <aside className="panel">
      <div style={{ padding: '16px 18px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 8 }}><Check on={!!st?.done} size={20} onClick={() => s.tickItem(item.id)} /><span className="muted" style={{ fontSize: 12 }}>{item.code} · {list.name}</span></div>
        <textarea className="inp" rows={2} style={{ fontSize: 15, fontWeight: 650, border: '1px solid transparent', padding: '4px 6px', textDecoration: st?.done ? 'line-through' : 'none' }} value={draft.title} onChange={(e) => edit({ title: e.target.value })} aria-label="Tiêu đề" />
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {list.statuses.map((x) => {
            const on = x.id === item.statusId;
            const col = COLOR_STYLE[x.color];
            return <button key={x.id} onClick={() => s.setItemStatus(item.id, x.id)} style={{ height: 24, padding: '0 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600, border: '1px solid ' + (on ? col.fg : 'var(--border-strong)'), background: on ? col.bg : 'transparent', color: on ? col.fg : 'var(--text-2)' }}>{x.name}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '92px 1fr', rowGap: 8, fontSize: 13, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <span className="muted">{list.catLabel}</span><input className="inp" style={{ height: 30 }} value={draft.cat} onChange={(e) => edit({ cat: e.target.value })} />
        <span className="muted">Người</span><PeopleInput value={item.owner} onChange={(v) => s.updateItem(item.id, { owner: v })} />
        <span className="muted">Hạn</span>
        <span className="row"><input type="date" className={'inp' + (late ? ' err' : '')} style={{ height: 30 }} value={item.due || ''} onChange={(e) => s.updateItem(item.id, { due: e.target.value || undefined }, 'Đổi hạn → ' + (e.target.value ? ddmm(e.target.value) : 'không hạn'))} /></span>
        <span className="muted">Work item</span><input className="inp" style={{ height: 30 }} value={draft.workItem} placeholder="#4521" onChange={(e) => edit({ workItem: e.target.value })} />
      </div>
      <div style={{ padding: '12px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="lbl">Ghi chú</span>
        <textarea className="inp" rows={3} value={draft.note} onChange={(e) => edit({ note: e.target.value })} aria-label="Ghi chú" />
      </div>
      <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
        <div className="between"><span className="lbl">Ảnh &amp; file · {item.assetIds.length}</span><span className="muted" style={{ fontSize: 11 }}>bấm ảnh để sửa</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {item.assetIds.map((id) => (
            <span key={id} style={{ position: 'relative' }}>
              <AssetThumb asset={assets.find((a) => a.id === id)} w="100%" h={58} onClick={() => go({ name: 'images', assetId: id })} />
              <button className="btn sm sq" style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20 }} aria-label="Gỡ ảnh" title="Gỡ khỏi mục (ảnh vẫn trong Ảnh chụp)"
                onClick={() => {
                  const prev = item.assetIds;
                  s.updateItem(item.id, { assetIds: prev.filter((x) => x !== id) }, 'Gỡ 1 ảnh');
                  s.showToast('Đã gỡ ảnh · ảnh vẫn trong Ảnh chụp', 'ok', { label: 'Hoàn tác', run: () => s.updateItem(item.id, { assetIds: prev }) });
                }}><Icon name="x" size={12} /></button>
            </span>
          ))}
          <div className="drop" style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.3 }}>Kéo file<br />vào đây</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          <button className="btn sm" title={kb('Bấm Ctrl+V khi đang mở mục này')} onClick={() => s.showToast('Bấm Ctrl+V để dán ảnh vào ' + item.code, 'info')}>Dán <span className="muted" style={{ fontSize: 10.5 }}>{kb('Ctrl+V')}</span></button>
          <button className="btn sm" onClick={addFiles}>Chọn file</button>
          <button className="btn sm" title="Chụp vùng và gắn thẳng vào mục này" onClick={() => startCapture({ kind: 'item', id: item.id })}>Chụp mới</button>
        </div>
      </div>
      <div style={{ padding: '12px 18px 0', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 80 }}>
        <span className="lbl">Lịch sử</span>
        {item.history.slice(0, 12).map((h, i) => (
          <div key={i} className="row" style={{ gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-strong)', marginTop: 6, flex: 'none' }} />
            <span><span className="muted">{h.t}</span> · {h.txt}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', bottom: 0 }}>
        <button className="btn" style={{ flex: 1 }} onClick={remind}><Icon name="bell" size={14} />Nhắc tôi</button>
        <button className="btn" style={{ flex: 1 }} onClick={copy}><Icon name="copy" size={14} />Copy</button>
        <button className="btn sq dngo" aria-label="Xóa mục" title="Xóa mục" onClick={() => setAskDel(true)}><Icon name="trash" size={14} /></button>
      </div>
      {askDel ? <Confirm title={'Xóa ' + item.code + '?'} danger okLabel="Xóa" body="Mục và lịch sử của nó sẽ bị xóa. Ảnh đính kèm vẫn giữ trong Ảnh chụp. Có thể hoàn tác ngay sau khi xóa." onOk={() => s.deleteItem(item.id)} onClose={() => setAskDel(false)} /> : null}
    </aside>
  );
}
