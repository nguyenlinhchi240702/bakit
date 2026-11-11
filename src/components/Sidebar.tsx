import type { ReactNode } from 'react';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { initials } from '../lib/util';
import { itemDone, itemLate, overdueCount } from '../lib/selectors';
import { kb } from '../lib/platform';
import type { Project, View } from '../lib/types';

export const projectBadge = (p: Project) => (p.short?.trim() || initials(p.name)).slice(0, 3).toUpperCase();

export function Sidebar() {
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);
  const projects = useStore((s) => s.projects);
  const items = useStore((s) => s.items);
  const tasks = useStore((s) => s.tasks);
  const assets = useStore((s) => s.assets);
  const meetings = useStore((s) => s.meetings);
  const collapsed = useStore((s) => !!s.settings.sidebarCollapsed);
  const saveSettings = useStore((s) => s.saveSettings);
  const late = overdueCount(tasks, items, projects);
  const toggle = () => saveSettings({ sidebarCollapsed: !collapsed });

  const nav = (name: View['name'], label: string, icon: string, target: View, extra?: ReactNode, dot?: number) => (
    <button className={'nav' + (view.name === name ? ' on' : '')} onClick={() => go(target)} title={collapsed ? label : undefined} aria-label={label}
      style={collapsed ? { justifyContent: 'center', padding: 0, position: 'relative' } : undefined}>
      <Icon name={icon} />{collapsed ? null : <>{label}{extra}</>}
      {collapsed && dot ? <span style={{ position: 'absolute', top: 4, right: 6, minWidth: 14, height: 14, borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{dot}</span> : null}
    </button>
  );
  const pinned = projects.filter((p) => p.pinned && !p.archived);

  return (
    <nav className="side" aria-label="Điều hướng chính" style={collapsed ? { width: 60, padding: '10px 8px' } : undefined}>
      {nav('today', 'Hôm nay', 'sun', { name: 'today' }, late ? <span className="chip red" style={{ marginLeft: 'auto', height: 18, padding: '0 6px' }}>{late}</span> : null, late)}
      {nav('calendar', 'Lịch', 'calendar', { name: 'calendar', mode: 'week' })}
      {nav('tasks', 'Việc', 'tasks', { name: 'tasks' })}
      {nav('meetings', 'Ghi chú họp', 'meeting', { name: 'meetings', group: 'all' }, <span className="n">{meetings.length}</span>)}
      {nav('projects', 'Tất cả dự án', 'folder', { name: 'projects' }, <span className="n">{projects.filter((p) => !p.archived).length}</span>)}
      {nav('images', 'Ảnh chụp', 'image', { name: 'images' }, <span className="n">{assets.length}</span>)}

      {collapsed ? <div style={{ height: 1, background: 'var(--border)', margin: '10px 4px' }} /> : (
        <div className="row" style={{ gap: 6, padding: '16px 10px 6px' }}><Icon name="pin" size={14} className="muted" /><span className="sec">Dự án đã ghim</span></div>
      )}
      {!collapsed && pinned.length === 0 ? <div className="muted" style={{ fontSize: 12, padding: '0 10px 6px' }}>Bấm biểu tượng ghim ở một dự án để đưa nó ra đây.</div> : null}
      {pinned.map((p) => {
        const active = view.name === 'project' && view.projectId === p.id;
        const pItems = items.filter((i) => i.projectId === p.id);
        const lateN = pItems.filter((i) => itemLate(projects, i)).length;
        const badge = (
          <span style={{ width: 28, height: 28, borderRadius: 7, background: p.color, color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', position: 'relative', boxShadow: active && collapsed ? '0 0 0 2px var(--surface), 0 0 0 4px ' + p.color : undefined }}>
            {projectBadge(p)}
            {collapsed && lateN ? <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9.5, display: 'grid', placeItems: 'center', padding: '0 3px', border: '1.5px solid var(--surface)' }}>{lateN}</span> : null}
          </span>
        );
        if (collapsed) {
          return (
            <button key={p.id} onClick={() => go({ name: 'project', projectId: p.id })} title={p.name + (lateN ? ' · ' + lateN + ' quá hạn' : '')} aria-label={p.name}
              style={{ height: 40, border: 0, borderRadius: 8, background: 'transparent', display: 'grid', placeItems: 'center' }}>{badge}</button>
          );
        }
        return (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
            <button onClick={() => go({ name: 'project', projectId: p.id })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 8px', borderRadius: 8, border: 0, textAlign: 'left', background: active ? 'var(--surface-3)' : 'transparent' }}>
              {badge}
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
            {active ? (
              <button onClick={() => go({ name: 'meetings', group: 'p:' + p.id })}
                style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 8px 0 46px', border: 0, borderRadius: 6, fontSize: 12.5, textAlign: 'left', background: 'transparent', color: 'var(--text-2)' }}>
                Cuộc họp<span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>{meetings.filter((m) => m.projectId === p.id).length}</span>
              </button>
            ) : null}
          </div>
        );
      })}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', gap: 6, padding: collapsed ? '8px 0' : '8px 4px 4px 10px' }}>
        {collapsed ? null : <span className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />Offline · lưu trên máy này</span>}
        <button className="btn ghost sm sq" style={{ marginLeft: collapsed ? 0 : 'auto' }} onClick={toggle}
          title={(collapsed ? 'Mở rộng menu' : 'Thu gọn menu') + ' (' + kb('Ctrl+B') + ')'} aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
          <Icon name={collapsed ? 'chevRight' : 'chevLeft'} />
        </button>
      </div>
    </nav>
  );
}
