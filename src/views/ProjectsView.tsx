import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Icon } from '../components/Icon';
import { Confirm, Popover } from '../components/ui';
import { ProjectModal } from '../components/ProjectModal';
import { addDays, relDay, todayKey } from '../lib/dates';
import { dueItems } from '../lib/selectors';
import type { Project } from '../lib/types';

export function ProjectsView() {
  const { projects, items, go, togglePin, updateProject, deleteProject } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [del, setDel] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const T = todayKey();
  const visible = projects.filter((p) => !!p.archived === showArchived);
  const week = useMemo(() => dueItems(projects, items).filter((e) => !e.done && e.item.due! <= addDays(T, 6)).sort((a, b) => a.item.due!.localeCompare(b.item.due!)), [projects, items, T]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div className="page">
        <div className="between">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="hd" style={{ fontSize: 24 }}>{showArchived ? 'Dự án đã lưu trữ' : 'Dự án'}</div>
            <span className="muted">{visible.length} dự án · mỗi dự án có checklist riêng</span>
          </div>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setShowArchived(!showArchived)}>{showArchived ? '← Đang theo dõi' : 'Đã lưu trữ'}</button>
            <button className="btn pri" onClick={() => setCreating(true)}><Icon name="plus" />Dự án mới</button>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="card empty" style={{ padding: 48 }}>
            <Icon name="folder" size={28} />
            <b style={{ color: 'var(--text)' }}>{showArchived ? 'Chưa có dự án lưu trữ' : 'Chưa có dự án'}</b>
            {!showArchived ? <><span>Mỗi dự án có sẵn checklist Tính năng, Issue, Vấn đề, Bug, Tài liệu.</span><button className="btn pri" onClick={() => setCreating(true)}>Tạo dự án đầu tiên</button></> : null}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {visible.map((p) => {
            const pItems = items.filter((i) => i.projectId === p.id);
            const late = pItems.filter((i) => i.due && i.due < T && !p.lists.find((l) => l.id === i.listId)?.statuses.find((s) => s.id === i.statusId)?.done).length;
            const next = dueItems([p], pItems).filter((e) => !e.done && e.item.due! >= T).sort((a, b) => a.item.due!.localeCompare(b.item.due!))[0];
            return (
              <div key={p.id} className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', position: 'relative' }}
                onClick={() => go({ name: 'project', projectId: p.id })}>
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span style={{ width: 10, height: 34, borderRadius: 4, background: p.color, flex: 'none' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <b style={{ fontSize: 17 }}>{p.name}</b>
                      <span className="muted" style={{ fontSize: 12.5 }}>{p.client ? 'Khách: ' + p.client : 'Chưa nhập khách hàng'}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {late ? <span className="chip red">{late} quá hạn</span> : null}
                    {p.phase ? <span className="chip blue">{p.phase}</span> : null}
                    <button className="btn ghost sm sq" title={p.pinned ? 'Bỏ ghim' : 'Ghim ra menu trái'} aria-label={p.pinned ? 'Bỏ ghim' : 'Ghim ra menu trái'} onClick={() => togglePin(p.id)} style={{ color: p.pinned ? 'var(--accent-text)' : 'var(--text-3)' }}>
                      <Icon name="pin" style={{ fill: p.pinned ? 'currentColor' : 'none' }} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button className="btn ghost sm sq" aria-label="Thêm thao tác" onClick={() => setMenu(menu === p.id ? null : p.id)}><Icon name="more" /></button>
                      <Popover open={menu === p.id} onClose={() => setMenu(null)} style={{ right: 0, top: 32, width: 180 }}>
                        <button className="mi" onClick={() => { setEditing(p); setMenu(null); }}>Sửa thông tin</button>
                        <button className="mi" onClick={() => { updateProject(p.id, { archived: !p.archived, pinned: false }); setMenu(null); }}>{p.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</button>
                        <div className="msep" />
                        <button className="mi dng" onClick={() => { setDel(p); setMenu(null); }}>Xóa dự án…</button>
                      </Popover>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 70px', rowGap: 8, alignItems: 'center', fontSize: 12.5 }}>
                  {p.lists.map((l) => {
                    const li = pItems.filter((i) => i.listId === l.id);
                    const doneN = li.filter((i) => l.statuses.find((s) => s.id === i.statusId)?.done).length;
                    return [
                      <span key={l.id + 'a'}>{l.name}</span>,
                      <div key={l.id + 'b'} style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: li.length ? (doneN * 100) / li.length + '%' : 0, height: 6, background: 'var(--success)' }} /></div>,
                      <span key={l.id + 'c'} className="muted" style={{ textAlign: 'right' }}>{doneN}/{li.length} xong</span>
                    ];
                  })}
                </div>
                <div className="between" style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
                  <span className="muted">{next ? <>Mốc tới: <b style={{ color: 'var(--text)' }}>{relDay(next.item.due)} · {next.item.code} {next.item.title}</b></> : 'Không có mốc gần'}</span>
                  <span style={{ color: 'var(--accent-text)', fontWeight: 600, flex: 'none' }}>Mở →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="panel" style={{ padding: 20, gap: 10 }}>
        <b>Đến hạn tuần này · mọi dự án</b>
        <span className="muted" style={{ fontSize: 12 }}>Mục có hạn trong checklist tự hiện ở Hôm nay và Lịch.</span>
        {week.length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>Không có mục nào đến hạn.</span> : null}
        {week.map((e) => {
          const late = e.item.due! < T;
          return (
            <button key={e.item.id} onClick={() => go({ name: 'project', projectId: e.project.id, listId: e.list.id, itemId: e.item.id })}
              style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 8, textAlign: 'left', background: late ? 'var(--danger-soft)' : 'transparent', border: late ? 0 : '1px solid var(--border)' }}>
              <span className="row" style={{ gap: 6, fontSize: 11.5 }}><span className="chip" style={{ height: 18, background: e.project.color, color: '#fff' }}>{e.project.name}</span><span style={{ color: late ? 'var(--danger)' : 'var(--text-3)', fontWeight: late ? 600 : 400 }}>{late ? 'Quá hạn ' : ''}{relDay(e.item.due)}</span></span>
              <span style={{ fontSize: 13 }}>{e.item.code} {e.item.title}</span>
            </button>
          );
        })}
      </aside>
      {creating ? <ProjectModal onClose={() => setCreating(false)} onCreated={(p) => go({ name: 'project', projectId: p.id })} /> : null}
      {editing ? <ProjectModal project={editing} onClose={() => setEditing(null)} /> : null}
      {del ? <Confirm title={'Xóa dự án ' + del.name + '?'} danger okLabel="Xóa vĩnh viễn"
        body={<>Toàn bộ checklist và {items.filter((i) => i.projectId === del.id).length} mục sẽ bị xóa vĩnh viễn. Ảnh chụp vẫn giữ trong mục Ảnh chụp. Muốn giữ lại để tra cứu, hãy chọn “Lưu trữ”.</>}
        onOk={() => deleteProject(del.id)} onClose={() => setDel(null)} /> : null}
    </div>
  );
}
