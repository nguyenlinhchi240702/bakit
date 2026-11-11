import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, longDate, shortDay, todayKey } from '../lib/dates';
import { byTime, dueItems, taskLate } from '../lib/selectors';
import { ItemDueRow, QuickAdd, TaskModal, TaskRow } from '../components/TaskBits';
import { MiniCalendar } from '../components/MiniCalendar';
import { AssetThumb } from '../components/ui';
import type { Task } from '../lib/types';

export function TodayView() {
  const { tasks, items, projects, assets, notes, setDayNote, go } = useStore();
  const T = todayKey();
  const [edit, setEdit] = useState<Task | null>(null);
  const due = useMemo(() => dueItems(projects, items), [projects, items]);

  const lateTasks = tasks.filter((t) => taskLate(t, T));
  const lateItems = due.filter((e) => !e.done && e.item.due! < T);
  const todayTasks = tasks.filter((t) => t.date === T).sort(byTime);
  const todayItems = due.filter((e) => e.item.due === T);
  const todayShots = assets.filter((a) => new Date(a.createdAt).toDateString() === new Date().toDateString()).slice(0, 5);
  const noDate = tasks.filter((t) => !t.date && !t.done).length;

  // Day note with a short debounce so typing stays fast.
  const [note, setNote] = useState(notes[T]?.text || '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onNote = (v: string) => {
    setNote(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDayNote(T, v), 400);
  };

  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(T, i + 1)).map((d) => ({
    d,
    tasks: tasks.filter((t) => t.date === d && !t.done).sort(byTime),
    items: due.filter((e) => e.item.due === d && !e.done)
  })).filter((g) => g.tasks.length + g.items.length > 0);

  const marks = (d: string) => {
    const hasLate = d < T && (tasks.some((t) => t.date === d && taskLate(t, T)) || due.some((e) => e.item.due === d && !e.done));
    if (hasLate) return 'late' as const;
    return tasks.some((t) => t.date === d) || due.some((e) => e.item.due === d) || !!notes[d]?.text ? 'dot' as const : 'none' as const;
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div className="page">
        <div className="between">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="sec">{longDate(T)}</span><div className="hd" style={{ fontSize: 24 }}>Hôm nay</div></div>
          <div className="row">
            {lateTasks.length + lateItems.length ? <span className="chip red">{lateTasks.length + lateItems.length} còn đọng</span> : null}
            <span className="chip">{todayTasks.filter((t) => t.kind === 'task' && !t.done).length + todayItems.filter((e) => !e.done).length} việc</span>
            <span className="chip blue">{todayTasks.filter((t) => t.kind === 'event').length} lịch hẹn</span>
          </div>
        </div>
        <QuickAdd />

        {lateTasks.length + lateItems.length ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row" style={{ gap: 8 }}><b style={{ color: 'var(--danger)' }}>Còn đọng</b><span className="muted" style={{ fontSize: 12 }}>từ các ngày trước</span></div>
            {lateTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={setEdit} />)}
            {lateItems.map((e) => <ItemDueRow key={e.item.id} entry={e} />)}
          </section>
        ) : null}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Hôm nay</b>
          {todayTasks.length + todayItems.length === 0 ? <div className="muted" style={{ fontSize: 13, padding: '6px 2px' }}>Chưa có việc nào cho hôm nay. Gõ vào ô phía trên để thêm.</div> : null}
          {todayTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={setEdit} />)}
          {todayItems.map((e) => <ItemDueRow key={e.item.id} entry={e} />)}
        </section>

        <section className="card" style={{ minHeight: 220, flex: 'none', padding: '14px 16px', display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="between"><b>Ghi chú ngày {T.slice(8, 10)}/{T.slice(5, 7)}</b><span className="muted" style={{ fontSize: 12 }}>Tự lưu</span></div>
            <textarea value={note} onChange={(e) => onNote(e.target.value)} aria-label="Ghi chú hôm nay" placeholder="Ghi nhanh những gì diễn ra hôm nay…"
              style={{ flex: 1, minHeight: 160, border: 0, outline: 'none', resize: 'none', background: 'transparent', fontSize: 13.5, lineHeight: 1.6, padding: 0 }} />
          </div>
          <div style={{ width: 236, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="between"><span className="lbl">Ảnh chụp hôm nay · {todayShots.length}</span><button className="btn ghost sm" onClick={() => go({ name: 'images' })}>Mở</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
              {todayShots.map((a) => <AssetThumb key={a.id} asset={a} w="100%" h={70} onClick={() => go({ name: 'images', assetId: a.id })} />)}
              <div className="drop" style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>Ctrl+V để dán</div>
            </div>
          </div>
        </section>
      </div>

      <aside className="panel" style={{ width: 320, padding: 18, gap: 14 }}>
        <MiniCalendar marks={marks} onPick={(d) => go({ name: 'calendar', mode: 'week', date: d })} />
        <div style={{ height: 1, background: 'var(--border)' }} />
        <b>Sắp tới</b>
        {upcoming.length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>7 ngày tới chưa có gì.</span> : null}
        {upcoming.slice(0, 5).map((g) => (
          <div key={g.d} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="sec">{shortDay(g.d)}</span>
            {g.tasks.map((t) => (
              <button key={t.id} className="row" onClick={() => setEdit(t)} style={{ gap: 8, fontSize: 12.5, minHeight: 22, border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: t.kind === 'event' ? 'var(--accent)' : 'transparent', border: t.kind === 'event' ? 0 : '1.5px solid var(--text-3)' }} />
                <span className="muted" style={{ width: 38, flex: 'none' }}>{t.time || ''}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              </button>
            ))}
            {g.items.map((e) => (
              <button key={e.item.id} className="row" onClick={() => go({ name: 'project', projectId: e.project.id, listId: e.list.id, itemId: e.item.id })} style={{ gap: 8, fontSize: 12.5, minHeight: 22, border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: e.project.color }} />
                <span className="muted" style={{ width: 38, flex: 'none' }}>{e.item.code}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.item.title}</span>
              </button>
            ))}
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 'auto', justifyContent: 'flex-start' }} onClick={() => go({ name: 'tasks' })}>{noDate} việc chưa có hạn · xem tab Việc →</button>
      </aside>
      {edit ? <TaskModal task={edit} onClose={() => setEdit(null)} /> : null}
    </div>
  );
}
