import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { Popover } from './ui';
import { startCapture } from '../lib/capture';
import { readClipboardImages, routeImages } from '../lib/paste';
import { isTauri, kb } from '../lib/platform';
import { matches } from '../lib/util';
import { ddmm } from '../lib/dates';
import type { View } from '../lib/types';

interface Hit { group: string; title: string; sub: string; view: View }

export function Topbar() {
  const go = useStore((s) => s.go);
  const { tasks, items, projects, assets, notes, meetings } = useStore();
  const collapsed = useStore((s) => !!s.settings.sidebarCollapsed);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const out: Hit[] = [];
    for (const it of items) {
      if (![it.code, it.title, it.note, it.workItem, it.cat, it.owner].some((f) => f && matches(f, q))) continue;
      const p = projects.find((x) => x.id === it.projectId);
      const l = p?.lists.find((x) => x.id === it.listId);
      out.push({ group: 'Checklist', title: it.code + ' · ' + it.title, sub: (p?.name || '') + ' › ' + (l?.name || ''), view: { name: 'project', projectId: it.projectId, listId: it.listId, itemId: it.id } });
    }
    for (const t of tasks) {
      if (![t.title, t.note || '', t.workItem || ''].some((f) => matches(f, q))) continue;
      out.push({ group: t.kind === 'event' ? 'Lịch hẹn' : 'Việc', title: t.title, sub: t.date ? ddmm(t.date) + (t.time ? ' ' + t.time : '') : 'Chưa có hạn', view: { name: 'tasks', taskId: t.id } });
    }
    for (const a of assets) {
      if (![a.name, a.note, a.workItem].some((f) => f && matches(f, q))) continue;
      out.push({ group: 'Ảnh', title: a.name, sub: (a.workItem ? a.workItem + ' · ' : '') + (a.note.split('\n')[0] || 'Chưa có ghi chú'), view: { name: 'images', assetId: a.id } });
    }
    for (const m of meetings) {
      if (![m.title, m.content, m.decisions, m.attendees, m.workItem || '', ...m.actions.map((a) => a.text)].some((f) => f && matches(f, q))) continue;
      const line = [m.content, m.decisions, ...m.actions.map((a) => a.text)].join('\n').split('\n').find((l) => matches(l, q)) || m.attendees;
      out.push({ group: 'Cuộc họp', title: m.title || 'Cuộc họp ' + ddmm(m.date), sub: ddmm(m.date) + ' · ' + line.trim(), view: { name: 'meetings', group: 'all', meetingId: m.id } });
    }
    for (const n of Object.values(notes)) {
      if (!n.text || !matches(n.text, q)) continue;
      const line = n.text.split('\n').find((l) => matches(l, q)) || '';
      out.push({ group: 'Ghi chú ngày', title: 'Ngày ' + ddmm(n.date) + '/' + n.date.slice(0, 4), sub: line.trim(), view: { name: 'calendar', mode: 'week', date: n.date } });
    }
    return out.slice(0, 40);
  }, [q, items, tasks, assets, notes, projects, meetings]);

  const paste = async () => {
    const imgs = await readClipboardImages();
    if (imgs === null) { useStore.getState().showToast(kb('Bấm Ctrl+V để dán ảnh (trình duyệt chặn đọc clipboard trực tiếp)'), 'info'); return; }
    if (!imgs.length) { useStore.getState().showToast('Clipboard chưa có hình ảnh', 'err'); return; }
    routeImages(imgs, 'paste');
  };

  return (
    <header className="topbar">
      <div className="row" style={{ gap: 10, width: collapsed ? 'auto' : 198, marginRight: collapsed ? 12 : 0 }}>
        <button className="btn ghost sq" style={{ marginLeft: -6 }} onClick={() => useStore.getState().saveSettings({ sidebarCollapsed: !collapsed })}
          title={(collapsed ? 'Mở rộng menu' : 'Thu gọn menu') + ' (' + kb('Ctrl+B') + ')'} aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}><Icon name="sidebar" /></button>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="logo" style={{ strokeWidth: 2.2 }} /></div>
        <b style={{ fontSize: 15 }}>BAKit</b>
      </div>
      <button className="btn pri" style={{ height: 36 }} onClick={() => startCapture()} title={isTauri ? 'Chụp vùng màn hình' : 'Trình duyệt sẽ hỏi bạn chọn màn hình để chụp'}>
        <Icon name="capture" />Chụp vùng <span className="kbd-hint">{kb('Ctrl+Shift+S')}</span>
      </button>
      <button className="btn" style={{ height: 36 }} onClick={paste}><Icon name="paste" />Dán ảnh <span className="muted kbd-hint">{kb('Ctrl+V')}</span></button>
      <button className="btn" style={{ height: 36 }} onClick={() => { go({ name: 'today' }); setTimeout(() => window.dispatchEvent(new Event('bakit:new-task')), 50); }}>
        <Icon name="plus" />Việc mới <span className="muted kbd-hint">{kb('Ctrl+N')}</span>
      </button>
      <div style={{ position: 'relative', marginLeft: 12 }}>
        <label className="inp" style={{ width: 380, height: 36 }}>
          <Icon name="search" className="muted" />
          <input className="ghost-input" value={q} placeholder="Tìm việc, checklist, cuộc họp, ảnh, #work item…" aria-label="Tìm kiếm"
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
          {q ? <button className="btn ghost sm sq" style={{ width: 22, height: 22 }} aria-label="Xóa tìm kiếm" onClick={() => setQ('')}><Icon name="x" size={13} /></button> : null}
        </label>
        <Popover open={open && q.trim().length >= 2} onClose={() => setOpen(false)} className="menu search-pop">
          {hits.length === 0 ? <div className="empty" style={{ padding: 20 }}>Không tìm thấy “{q}”</div> : null}
          {hits.map((h, i) => (
            <button key={i} className="mi" style={{ height: 'auto', padding: '7px 10px', alignItems: 'flex-start' }} onClick={() => { go(h.view); setOpen(false); }}>
              <span className="chip" style={{ flex: 'none', minWidth: 86, justifyContent: 'center' }}>{h.group}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</span>
                <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.sub}</span>
              </span>
            </button>
          ))}
        </Popover>
      </div>
      <button className="btn ghost sq" style={{ marginLeft: 'auto' }} aria-label="Cài đặt" title="Cài đặt" onClick={() => go({ name: 'settings' })}><Icon name="settings" /></button>
    </header>
  );
}
