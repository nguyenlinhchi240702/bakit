import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, addMonths, ddmm, DOW_SHORT, dow, longDate, monthGridStart, monthTitle, todayKey, weekStart } from '../lib/dates';
import { byTime, dueItems, taskLate } from '../lib/selectors';
import { Icon } from '../components/Icon';
import { Check } from '../components/ui';
import { ItemDueRow, MeetingRow, QuickAdd, TaskModal, TaskRow } from '../components/TaskBits';
import type { Task } from '../lib/types';

export function CalendarView({ mode }: { mode: 'week' | 'month' }) {
  const { tasks, items, projects, assets, notes, meetings, go, view, toggleTask, tickItem, updateTask, showToast } = useStore();
  const T = todayKey();
  const initial = view.name === 'calendar' && view.date ? view.date : T;
  const [anchor, setAnchor] = useState(initial);
  const [sel, setSel] = useState(initial);
  const [edit, setEdit] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (view.name === 'calendar' && view.date) { setAnchor(view.date); setSel(view.date); } }, [view]);
  const due = useMemo(() => dueItems(projects, items), [projects, items]);
  const shotsByDay = useMemo(() => {
    const m: Record<string, number> = {};
    assets.forEach((a) => {
      const d = new Date(a.createdAt);
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [assets]);

  const dayTasks = (d: string) => tasks.filter((t) => t.date === d).sort(byTime);
  const dayItems = (d: string) => due.filter((e) => e.item.due === d);
  const dayMeetings = (d: string) => meetings.filter((m) => m.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const lateTasks = tasks.filter((t) => taskLate(t, T));
  const lateItems = due.filter((e) => !e.done && e.item.due! < T);

  const step = (n: number) => {
    const a = mode === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n);
    setAnchor(a);
  };
  const title = mode === 'week'
    ? ddmm(weekStart(anchor)) + ' – ' + ddmm(addDays(weekStart(anchor), 6)) + '/' + addDays(weekStart(anchor), 6).slice(0, 4)
    : monthTitle(anchor);

  const moveAllLate = () => {
    lateTasks.forEach((t) => updateTask(t.id, { date: T }));
    showToast('Đã dời ' + lateTasks.length + ' việc sang hôm nay');
  };

  const chip = (d: string, compact: boolean) => (
    <>
      {dayMeetings(d).map((m) => {
        const pc = m.projectId ? projects.find((p) => p.id === m.projectId)?.color : undefined;
        return (
          <button key={m.id} onClick={(e) => { e.stopPropagation(); go({ name: 'meetings', group: 'all', meetingId: m.id }); }} className={compact ? 'mini-chip' : ''} title={'Cuộc họp: ' + m.title}
            style={compact ? { background: 'var(--purple-soft)', color: 'var(--purple)', border: 0, textAlign: 'left' } : { padding: '6px 8px', borderRadius: 6, background: 'var(--purple-soft)', color: 'var(--purple)', fontSize: 12, lineHeight: 1.3, border: 0, borderLeft: '3px solid ' + (pc || 'var(--purple)'), textAlign: 'left' }}>
            {compact ? (m.time ? m.time + ' ' : '') + m.title : <><b style={{ fontSize: 11.5 }}>Họp{m.time ? ' · ' + m.time + (m.end ? '–' + m.end : '') : ''}</b><br />{m.title}</>}
          </button>
        );
      })}
      {dayTasks(d).map((t) => t.kind === 'event' ? (
        <button key={t.id} onClick={(e) => { e.stopPropagation(); setEdit(t); }} className={compact ? 'mini-chip' : ''}
          style={compact ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', border: 0, textAlign: 'left' } : { padding: '6px 8px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent-text)', fontSize: 12, lineHeight: 1.3, border: 0, borderLeft: '3px solid var(--accent)', textAlign: 'left' }}>
          {compact ? (t.time ? t.time + ' ' : '') + t.title : <><b style={{ fontSize: 11.5 }}>{t.time}{t.end ? '–' + t.end : ''}</b><br />{t.title}</>}
        </button>
      ) : (
        <div key={t.id} onClick={(e) => { e.stopPropagation(); setEdit(t); }} className={compact ? 'mini-chip' : ''}
          style={compact ? { background: taskLate(t, T) ? 'var(--danger-soft)' : 'var(--surface-3)', color: taskLate(t, T) ? 'var(--danger)' : 'var(--text-2)', textDecoration: t.done ? 'line-through' : 'none', cursor: 'pointer' } : { display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.3, cursor: 'pointer' }}>
          {compact ? (t.time ? t.time + ' ' : '') + t.title : <><Check on={t.done} size={14} onClick={() => toggleTask(t.id)} /><span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-3)' : 'var(--text)' }}>{t.title}</span></>}
        </div>
      ))}
      {dayItems(d).map((e) => (
        <div key={e.item.id} className={compact ? 'mini-chip' : ''} onClick={(ev) => { ev.stopPropagation(); go({ name: 'project', projectId: e.project.id, listId: e.list.id, itemId: e.item.id }); }}
          style={compact ? { background: 'var(--surface-3)', color: 'var(--text-2)', borderLeft: '3px solid ' + e.project.color, textDecoration: e.done ? 'line-through' : 'none', cursor: 'pointer' } : { display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid ' + e.project.color, fontSize: 12, lineHeight: 1.3, cursor: 'pointer' }}>
          {compact ? e.item.code + ' ' + e.item.title : <><Check on={e.done} size={14} onClick={() => tickItem(e.item.id)} /><span style={{ textDecoration: e.done ? 'line-through' : 'none' }}><b>{e.item.code}</b> {e.item.title}</span></>}
        </div>
      ))}
    </>
  );

  // Day panel note (debounced)
  const [note, setNote] = useState(notes[sel]?.text || '');
  useEffect(() => { setNote(useStore.getState().notes[sel]?.text || ''); }, [sel]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onNote = (v: string) => { setNote(v); clearTimeout(timer.current); timer.current = setTimeout(() => useStore.getState().setDayNote(sel, v), 400); };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div className="page" style={{ gap: 12 }}>
        <div className="between">
          <div className="row" style={{ gap: 8 }}>
            <div className="hd" style={{ fontSize: 22, minWidth: 210 }}>{title}</div>
            <button className="btn ghost sm sq" aria-label="Trước" onClick={() => step(-1)}><Icon name="chevLeft" size={14} /></button>
            <button className="btn ghost sm sq" aria-label="Sau" onClick={() => step(1)}><Icon name="chevRight" size={14} /></button>
            <button className="btn sm" onClick={() => { setAnchor(T); setSel(T); }}>Hôm nay</button>
          </div>
          <div className="row">
            <div className="seg">
              <button className={mode === 'week' ? 'on' : ''} onClick={() => go({ name: 'calendar', mode: 'week', date: anchor })}>Tuần</button>
              <button className={mode === 'month' ? 'on' : ''} onClick={() => go({ name: 'calendar', mode: 'month', date: anchor })}>Tháng</button>
            </div>
            <button className="btn pri sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} />Thêm</button>
          </div>
        </div>

        {mode === 'week' && lateTasks.length + lateItems.length > 0 ? (
          <div className="banner err" style={{ flex: 'none' }}>
            <b style={{ flex: 'none', whiteSpace: 'nowrap' }}>Còn đọng {lateTasks.length + lateItems.length} mục</b>
            <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[...lateTasks.map((t) => t.title), ...lateItems.map((e) => e.item.code + ' ' + e.item.title)].join(' · ')}</span>
            {lateTasks.length ? <button className="btn sm" style={{ marginLeft: 'auto', flex: 'none' }} onClick={moveAllLate}>Dời việc sang hôm nay</button> : null}
          </div>
        ) : null}

        {mode === 'week' ? (
          <div style={{ flex: 1, minHeight: 420, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i)).map((d) => {
              const isT = d === T, isSel = d === sel;
              return (
                <div key={d} onClick={() => setSel(d)} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', minHeight: 0, overflow: 'auto',
                  background: isT ? 'var(--accent-soft)' : 'var(--surface)', border: '1px solid ' + (isSel ? 'var(--accent)' : isT ? 'var(--accent)' : 'var(--border)'), boxShadow: isSel ? '0 0 0 2px var(--accent-soft)' : 'none' }}>
                  <div className="row" style={{ gap: 6, padding: '0 2px 4px' }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{DOW_SHORT[dow(d)]}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: isT ? 'var(--accent-text)' : 'var(--text)' }}>{d.slice(8, 10)}</span>
                  </div>
                  {chip(d, false)}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {notes[d]?.text ? <span className="row muted" style={{ gap: 6, fontSize: 11.5 }}><Icon name="note" size={13} />Có ghi chú</span> : null}
                    {shotsByDay[d] ? <span className="row muted" style={{ gap: 6, fontSize: 11.5 }}><Icon name="image" size={13} />{shotsByDay[d]} ảnh chụp</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, flex: 'none' }}>
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((x) => <span key={x} className="sec" style={{ paddingLeft: 8 }}>{x}</span>)}
            </div>
            <div style={{ flex: 1, minHeight: 480, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
              {Array.from({ length: 42 }, (_, i) => addDays(monthGridStart(anchor), i)).map((d) => {
                const n = dayTasks(d).length + dayItems(d).length + dayMeetings(d).length;
                return (
                  <div key={d} onClick={() => setSel(d)} className={'cal-cell' + (d === T ? ' today' : '') + (d.slice(5, 7) !== anchor.slice(5, 7) ? ' other' : '')}
                    style={d === sel ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}>
                    <div className="between"><span style={{ fontSize: 12.5, fontWeight: d === T ? 700 : 500, color: d.slice(5, 7) !== anchor.slice(5, 7) ? 'var(--text-3)' : 'inherit' }}>{Number(d.slice(8, 10))}</span>
                      <span className="row" style={{ gap: 3 }}>{notes[d]?.text ? <Icon name="note" size={11} className="muted" /> : null}{shotsByDay[d] ? <Icon name="image" size={11} className="muted" /> : null}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>{chip(d, true)}</div>
                    {n > 3 ? <span className="muted" style={{ fontSize: 11 }}>{n} mục</span> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <aside className="panel" style={{ width: 320, padding: 16, gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="sec">{sel === T ? 'Hôm nay' : 'Ngày đã chọn'}</span><b style={{ fontSize: 15 }}>{longDate(sel)}</b></div>
        <QuickAdd key={sel} date={sel} autoFocusEvent={false} compact />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dayTasks(sel).length + dayItems(sel).length + dayMeetings(sel).length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>Chưa có việc hay lịch hẹn.</span> : null}
          {dayMeetings(sel).map((m) => <MeetingRow key={m.id} meeting={m} />)}
          {dayTasks(sel).map((t) => <TaskRow key={t.id} task={t} onOpen={setEdit} compact />)}
          {dayItems(sel).map((e) => <ItemDueRow key={e.item.id} entry={e} compact />)}
        </div>
        <div className="field" style={{ flex: 1, minHeight: 160 }}>
          <span className="lbl">Ghi chú ngày</span>
          <textarea className="inp" style={{ flex: 1, minHeight: 140 }} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ghi chú cho ngày này…" />
        </div>
      </aside>
      {edit ? <TaskModal task={edit} onClose={() => setEdit(null)} /> : null}
      {adding ? <TaskModal date={sel} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
