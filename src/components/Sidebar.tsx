import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { initials } from '../lib/util';
import { itemDone, itemLate, overdueCount } from '../lib/selectors';
import type { View } from '../lib/types';

export function Sidebar() {
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);
  const projects = useStore((s) => s.projects);
  const items = useStore((s) => s.items);
  const tasks = useStore((s) => s.tasks);
  const assets = useStore((s) => s.assets);
  const late = overdueCount(tasks, items, projects);

  const nav = (name: View['name'], label: string, icon: string, target: View, extra?: React.ReactNode) => (
    <button className={'nav' + (view.name === name ? ' on' : '')} onClick={() => go(target)}>
      <Icon name={icon} />{label}{extra}
    </button>
  );
  const pinned = projects.filter((p) => p.pinned && !p.archived);

  return (
    <nav className="side" aria-label="Điều hướng chính">
      {nav('today', 'Hôm nay', 'sun', { name: 'today' }, late ? <span className="chip red" style={{ marginLeft: 'auto', height: 18, padding: '0 6px' }}>{late}</span> : null)}
      {nav('calendar', 'Lịch', 'calendar', { name: 'calendar', mode: 'week' })}
      {nav('tasks', 'Việc', 'tasks', { name: 'tasks' })}
      {nav('projects', 'Tất cả dự án', 'folder', { name: 'projects' }, <span className="n">{projects.filter((p) => !p.archived).length}</span>)}
      {nav('images', 'Ảnh chụp', 'image', { name: 'images' }, <span className="n">{assets.length}</span>)}

      <div className="row" style={{ gap: 6, padding: '16px 10px 6px' }}><Icon name="pin" size={14} className="muted" /><span className="sec">Dự án đã ghim</span></div>
      {pinned.length === 0 ? <div className="muted" style={{ fontSize: 12, padding: '0 10px 6px' }}>Bấm biểu tượng ghim ở một dự án để đưa nó ra đây.</div> : null}
      {pinned.map((p) => {
        const active = view.name === 'project' && view.projectId === p.id;
        const pItems = items.filter((i) => i.projectId === p.id);
        const lateN = pItems.filter((i) => itemLate(projects, i)).length;
        return (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
            <button onClick={() => go({ name: 'project', projectId: p.id })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 8px', borderRadius: 8, border: 0, textAlign: 'left', background: active ? 'var(--surface-3)' : 'transparent' }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: p.color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(p.name)}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
                <b style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</b>
                <span className="muted" style={{ fontSize: 11 }}>{p.phase || p.client || 'Dự án'}</span>
              </span>
              {lateN ? <span className="chip red" style={{ marginLeft: 'auto', height: 18, padding: '0 6px' }}>{lateN}</span> : null}
            </button>
            {active ? p.lists.map((l) => {
              const li = pItems.filter((i) => i.listId === l.id);
              const open = li.filter((i) => !itemDone(projects, i)).length;
              const on = (view.listId || p.lists[0]?.id) === l.id;
              return (
                <button key={l.id} onClick={() => go({ name: 'project', projectId: p.id, listId: l.id })}
                  style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 8px 0 46px', border: 0, borderRadius: 6, fontSize: 12.5, textAlign: 'left', background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text-2)', fontWeight: on ? 650 : 500 }}>
                  {l.name}<span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{open}/{li.length}</span>
                </button>
              );
            }) : null}
          </div>
        );
      })}
      <div style={{ marginTop: 'auto', padding: '8px 10px', fontSize: 11.5, color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="row" style={{ gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />Offline · lưu trên máy này</span>
      </div>
    </nav>
  );
}
