import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, todayKey } from '../lib/dates';
import { byTime, dueItems, type DueEntry } from '../lib/selectors';
import { ItemDueRow, QuickAdd, TaskModal, TaskRow } from '../components/TaskBits';
import type { Task } from '../lib/types';

type Filter = 'all' | 'img' | 'wi';

export function TasksView() {
  const { tasks, items, projects, view } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [withItems, setWithItems] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [edit, setEdit] = useState<Task | null>(null);
  useEffect(() => {
    if (view.name === 'tasks' && view.taskId) setEdit(useStore.getState().tasks.find((t) => t.id === view.taskId) || null);
  }, [view]);

  const T = todayKey();
  const end = addDays(T, 6);
  const own = tasks.filter((t) => t.kind === 'task').filter((t) => filter === 'all' || (filter === 'img' ? t.assetIds.length > 0 : !!t.workItem));
  const due = useMemo(() => (withItems ? dueItems(projects, items) : []), [withItems, projects, items])
    .filter((e) => filter === 'all' || (filter === 'img' ? e.item.assetIds.length > 0 : !!e.item.workItem));

  const groups: Array<{ name: string; color: string; tasks: Task[]; items: DueEntry[] }> = [
    { name: 'Còn đọng', color: 'var(--danger)', tasks: own.filter((t) => !t.done && t.date && t.date < T), items: due.filter((e) => !e.done && e.item.due! < T) },
    { name: 'Hôm nay', color: 'var(--text)', tasks: own.filter((t) => !t.done && t.date === T), items: due.filter((e) => !e.done && e.item.due === T) },
    { name: 'Tuần này', color: 'var(--text)', tasks: own.filter((t) => !t.done && t.date && t.date > T && t.date <= end), items: due.filter((e) => !e.done && e.item.due! > T && e.item.due! <= end) },
    { name: 'Sau này', color: 'var(--text)', tasks: own.filter((t) => !t.done && t.date && t.date > end), items: due.filter((e) => !e.done && e.item.due! > end) },
    { name: 'Chưa có hạn', color: 'var(--text-2)', tasks: own.filter((t) => !t.done && !t.date), items: [] }
  ];
  const done = own.filter((t) => t.done);

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="between">
        <div className="hd" style={{ fontSize: 22 }}>Việc</div>
        <div className="row">
          <label className="row" style={{ gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={withItems} onChange={(e) => setWithItems(e.target.checked)} />Gồm checklist dự án có hạn</label>
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả</button>
            <button className={filter === 'img' ? 'on' : ''} onClick={() => setFilter('img')}>Có ảnh</button>
            <button className={filter === 'wi' ? 'on' : ''} onClick={() => setFilter('wi')}>Có work item</button>
          </div>
        </div>
      </div>
      <QuickAdd />
      {groups.map((g) => g.tasks.length + g.items.length === 0 ? null : (
        <section key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row" style={{ gap: 8 }}><b style={{ color: g.color }}>{g.name}</b><span className="chip">{g.tasks.length + g.items.length}</span></div>
          {[...g.tasks].sort((a, b) => (a.date || '').localeCompare(b.date || '') || byTime(a, b)).map((t) => <TaskRow key={t.id} task={t} showDue onOpen={setEdit} />)}
          {g.items.map((e) => <ItemDueRow key={e.item.id} entry={e} showDue />)}
        </section>
      ))}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button className="row" style={{ gap: 8, border: 0, background: 'transparent', padding: 0 }} onClick={() => setShowDone(!showDone)}>
          <b style={{ color: 'var(--text-3)' }}>Đã xong</b><span className="chip">{done.length}</span><span className="muted" style={{ fontSize: 12 }}>{showDone ? 'Ẩn' : 'Hiện'}</span>
        </button>
        {showDone ? done.map((t) => <TaskRow key={t.id} task={t} showDue onOpen={setEdit} />) : null}
      </section>
      {edit ? <TaskModal task={edit} onClose={() => setEdit(null)} /> : null}
    </div>
  );
}
