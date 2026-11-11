import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import type { Meeting, Task } from '../lib/types';
import { Icon } from './Icon';
import { AssetThumb, Check, Modal, WorkItemChip } from './ui';
import { ddmm, hhmm, relDay, toIso, todayKey } from '../lib/dates';
import type { DueEntry } from '../lib/selectors';
import { taskLate } from '../lib/selectors';
import { kb, pickImageFiles } from '../lib/platform';
import { startCapture } from '../lib/capture';
import { pushImageHandler } from '../lib/paste';

/** In narrow panels the chips drop to a second line instead of squeezing the title. */
function Meta({ compact, children }: { compact?: boolean; children: ReactNode }) {
  return compact ? <div className="meta">{children}</div> : <>{children}</>;
}

export function TaskRow({ task, showDue, onOpen, compact }: { task: Task; showDue?: boolean; onOpen: (t: Task) => void; compact?: boolean }) {
  const { toggleTask, updateTask, deleteTask } = useStore();
  const late = taskLate(task);
  const timeTxt = task.time ? (task.end ? task.time + '–' + task.end : task.time) : task.kind === 'task' ? 'Trong ngày' : '';
  return (
    <div className={'trow' + (late ? ' late' : '') + (compact ? ' compact' : '')} onDoubleClick={() => onOpen(task)}>
      {task.kind === 'task'
        ? <Check on={task.done} onClick={() => toggleTask(task.id)} />
        : <span style={{ width: 18, display: 'flex', justifyContent: 'center' }}><span style={{ width: 4, height: 22, borderRadius: 2, background: 'var(--accent)' }} /></span>}
      <span className="muted" style={{ width: compact ? 'auto' : 82, fontSize: 12, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{showDue ? relDay(task.date) : timeTxt}</span>
      <button onClick={() => onOpen(task)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', padding: 0, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text-3)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</button>
      <Meta compact={compact}>
        {task.kind === 'event' ? <span className="chip blue">Lịch hẹn</span> : null}
        {late ? <span className="chip red">{ddmm(task.date)}</span> : null}
        {task.repeat && task.repeat !== 'none' ? <span className="chip" title="Lặp lại"><Icon name="refresh" size={12} />{task.repeat === 'daily' ? 'Hằng ngày' : task.repeat === 'weekly' ? 'Hằng tuần' : 'Hằng tháng'}</span> : null}
        <WorkItemChip value={task.workItem} />
        {task.assetIds.length ? <span className="chip"><Icon name="image" size={12} />{task.assetIds.length}</span> : null}
        {task.remindAt && !task.done && !task.reminded ? <span className="chip amber"><Icon name="bell" size={12} />{hhmm(task.remindAt)}</span> : null}
      </Meta>
      <span className="acts">
        {late ? <button className="btn ghost sm" onClick={() => updateTask(task.id, { date: todayKey() }, 'Đã dời sang hôm nay')}>Dời sang hôm nay</button> : null}
        <button className="btn ghost sm sq" aria-label="Xóa" title="Xóa" onClick={() => deleteTask(task.id)}><Icon name="trash" size={14} /></button>
      </span>
    </div>
  );
}

export function ItemDueRow({ entry, showDue, compact }: { entry: DueEntry; showDue?: boolean; compact?: boolean }) {
  const { tickItem, go } = useStore();
  const late = !entry.done && !!entry.item.due && entry.item.due < todayKey();
  return (
    <div className={'trow' + (late ? ' late' : '') + (compact ? ' compact' : '')}>
      <Check on={entry.done} onClick={() => tickItem(entry.item.id)} />
      <span className="muted" style={{ width: compact ? 'auto' : 82, fontSize: 12, flex: 'none' }}>{showDue ? relDay(entry.item.due) : entry.item.code}</span>
      <button onClick={() => go({ name: 'project', projectId: entry.project.id, listId: entry.list.id, itemId: entry.item.id })}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', padding: 0, textDecoration: entry.done ? 'line-through' : 'none', color: entry.done ? 'var(--text-3)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {showDue ? entry.item.code + ' · ' : ''}{entry.item.title}
      </button>
      <Meta compact={compact}>
        {late ? <span className="chip red">{ddmm(entry.item.due)}</span> : null}
        <span className="chip" style={{ background: entry.project.color, color: '#fff' }}>{entry.project.name}</span>
        <span className="chip">{entry.list.name}</span>
      </Meta>
    </div>
  );
}

export function QuickAdd({ date, autoFocusEvent = true, compact = false }: { date?: string; autoFocusEvent?: boolean; compact?: boolean }) {
  const addTask = useStore((s) => s.addTask);
  const showToast = useStore((s) => s.showToast);
  const [title, setTitle] = useState('');
  const [d, setD] = useState(date || todayKey());
  const [time, setTime] = useState('');
  const [remind, setRemind] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocusEvent) return;
    const f = () => ref.current?.focus();
    window.addEventListener('bakit:new-task', f);
    return () => window.removeEventListener('bakit:new-task', f);
  }, [autoFocusEvent]);
  const add = () => {
    const t = title.trim();
    if (!t) return;
    addTask({ kind: 'task', title: t, date: d || undefined, time: time || undefined, remindAt: remind && d ? toIso(d, time || '09:00') : undefined });
    showToast('Đã thêm việc' + (d ? ' · ' + relDay(d) : ''));
    setTitle('');
    setTime('');
    setRemind(false);
  };
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px' }}>
      <Icon name="plus" className="muted" />
      <input ref={ref} className="ghost-input" value={title} placeholder="Thêm việc… (Enter)" aria-label="Thêm việc mới"
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      {compact ? null : <input type="date" className="inp" style={{ width: 140, height: 30 }} value={d} onChange={(e) => setD(e.target.value)} aria-label="Hạn" title="Hạn (để trống = chưa có hạn)" />}
      {compact ? null : <input type="time" className="inp" style={{ width: 104, height: 30 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Giờ" />}
      <button className={'btn sm' + (remind ? ' pri' : ' ghost') + (compact ? ' sq' : '')} onClick={() => setRemind(!remind)} title="Nhắc bằng thông báo Windows (đúng giờ, mặc định 09:00)" aria-label="Nhắc" aria-pressed={remind}><Icon name="bell" size={14} />{compact ? null : 'Nhắc'}</button>
      <button className="btn pri sm" onClick={add}>Thêm</button>
    </div>
  );
}

const REMIND_OPTS: Array<[string, string]> = [['', 'Không nhắc'], ['0', 'Đúng giờ'], ['15', 'Trước 15 phút'], ['60', 'Trước 1 giờ'], ['day', 'Sáng 08:30 cùng ngày'], ['custom', 'Tùy chọn…']];

export function TaskModal({ task, date, onClose }: { task?: Task; date?: string; onClose: () => void }) {
  const { addTask, updateTask, deleteTask, assets, go, showToast } = useStore();
  const [f, setF] = useState<Task>(() => task || { id: '', kind: 'task', title: '', date: date || todayKey(), done: false, assetIds: [], createdAt: '', repeat: 'none' });
  const [remind, setRemind] = useState<string>(task?.remindAt ? 'custom' : '');
  const [custom, setCustom] = useState<string>(task?.remindAt ? toLocalInput(task.remindAt) : '');
  const set = (p: Partial<Task>) => setF({ ...f, ...p });

  useEffect(() => {
    if (!task) return;
    return pushImageHandler((blobs) => {
      const s = useStore.getState();
      Promise.all(blobs.map((b) => s.addImage(b, 'paste'))).then((as) => {
        const ids = as.map((a) => a.id);
        setF((cur) => ({ ...cur, assetIds: [...cur.assetIds, ...ids] }));
        s.showToast('Đã dán ' + ids.length + ' ảnh vào việc');
      });
      return true;
    });
  }, [task]);

  const remindIso = (): string | undefined => {
    if (!remind) return undefined;
    if (remind === 'custom') return custom ? new Date(custom).toISOString() : undefined;
    if (!f.date) return undefined;
    if (remind === 'day') return toIso(f.date, '08:30');
    const base = new Date(toIso(f.date, f.time || '09:00'));
    return new Date(base.getTime() - Number(remind) * 60000).toISOString();
  };
  const save = () => {
    if (!f.title.trim()) return;
    const patch: Partial<Task> = { ...f, title: f.title.trim(), remindAt: remindIso(), reminded: false, date: f.date || undefined, time: f.time || undefined, end: f.end || undefined };
    if (task) updateTask(task.id, patch);
    else addTask({ ...patch, title: patch.title! });
    showToast(task ? 'Đã lưu' : 'Đã thêm ' + (f.kind === 'event' ? 'lịch hẹn' : 'việc'));
    onClose();
  };
  const addFiles = async () => {
    const files = await pickImageFiles();
    const s = useStore.getState();
    const as = await Promise.all(files.map((x) => s.addImage(x, 'file', x.name.replace(/\.[^.]+$/, ''))));
    setF((cur) => ({ ...cur, assetIds: [...cur.assetIds, ...as.map((a) => a.id)] }));
  };

  return (
    <Modal title={task ? 'Sửa ' + (f.kind === 'event' ? 'lịch hẹn' : 'việc') : 'Thêm mới'} onClose={onClose} width={520} footer={<>
      {task ? <button className="btn dngo" style={{ marginRight: 'auto' }} onClick={() => { deleteTask(task.id); onClose(); }}><Icon name="trash" size={14} />Xóa</button> : null}
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className="btn pri" onClick={save} disabled={!f.title.trim()}>Lưu</button>
    </>}>
      <div className="seg" style={{ width: 220 }}>
        <button className={f.kind === 'task' ? 'on' : ''} onClick={() => set({ kind: 'task' })}>Việc</button>
        <button className={f.kind === 'event' ? 'on' : ''} onClick={() => set({ kind: 'event' })}>Lịch hẹn</button>
      </div>
      <label className="field"><span className="lbl">Tiêu đề<span className="req">*</span></span>
        <input className="inp" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: f.kind === 'event' ? '1.4fr 1fr 1fr' : '1.4fr 1fr', gap: 10 }}>
        <label className="field"><span className="lbl">Ngày</span><input type="date" className="inp" value={f.date || ''} onChange={(e) => set({ date: e.target.value })} /></label>
        <label className="field"><span className="lbl">{f.kind === 'event' ? 'Bắt đầu' : 'Giờ'}</span><input type="time" className="inp" value={f.time || ''} onChange={(e) => set({ time: e.target.value })} /></label>
        {f.kind === 'event' ? <label className="field"><span className="lbl">Kết thúc</span><input type="time" className="inp" value={f.end || ''} onChange={(e) => set({ end: e.target.value })} /></label> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="field"><span className="lbl">Nhắc việc</span>
          <select className="inp" value={remind} onChange={(e) => setRemind(e.target.value)}>{REMIND_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="field"><span className="lbl">Lặp lại</span>
          <select className="inp" value={f.repeat || 'none'} onChange={(e) => set({ repeat: e.target.value as Task['repeat'] })}>
            <option value="none">Không</option><option value="daily">Hằng ngày</option><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option>
          </select></label>
      </div>
      {remind === 'custom' ? <label className="field"><span className="lbl">Thời điểm nhắc</span><input type="datetime-local" className="inp" value={custom} onChange={(e) => setCustom(e.target.value)} /></label> : null}
      <label className="field"><span className="lbl">Work item Azure (tùy chọn)</span><input className="inp" value={f.workItem || ''} placeholder="#4521" onChange={(e) => set({ workItem: e.target.value })} /></label>
      <label className="field"><span className="lbl">Ghi chú</span><textarea className="inp" rows={3} value={f.note || ''} onChange={(e) => set({ note: e.target.value })} /></label>
      <div className="field">
        <span className="lbl">Ảnh · {f.assetIds.length}</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {f.assetIds.map((id) => {
            const a = assets.find((x) => x.id === id);
            return (
              <span key={id} style={{ position: 'relative' }}>
                <AssetThumb asset={a} w={96} h={60} onClick={() => { onClose(); go({ name: 'images', assetId: id }); }} />
                <button className="btn sm sq" style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20 }} aria-label="Gỡ ảnh" title="Gỡ khỏi việc (ảnh vẫn trong Ảnh chụp)"
                  onClick={() => set({ assetIds: f.assetIds.filter((x) => x !== id) })}><Icon name="x" size={12} /></button>
              </span>
            );
          })}
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: 12 }}>{task ? kb('Ctrl+V để dán ảnh vào việc này') : 'Lưu việc trước, sau đó dán ảnh'}</span>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={addFiles}>Chọn file</button>
          {task ? <button className="btn sm" onClick={() => { onClose(); startCapture({ kind: 'task', id: task.id }); }}>Chụp mới</button> : null}
        </div>
      </div>
    </Modal>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/** A meeting on a day list (Today, Calendar). Opens the meeting notes. */
export function MeetingRow({ meeting }: { meeting: Meeting }) {
  const projects = useStore((st) => st.projects);
  const cats = useStore((st) => st.settings.meetingCats);
  const go = useStore((st) => st.go);
  const p = meeting.projectId ? projects.find((x) => x.id === meeting.projectId) : undefined;
  const c = meeting.catId ? cats?.find((x) => x.id === meeting.catId) : undefined;
  const left = meeting.actions.filter((a) => !a.done).length;
  return (
    <div className="trow compact" style={{ cursor: 'pointer', borderLeft: '3px solid ' + (p?.color || 'var(--purple)') }} onClick={() => go({ name: 'meetings', group: 'all', meetingId: meeting.id })}>
      <Icon name="meeting" size={15} style={{ color: 'var(--purple)', flex: 'none' }} />
      <span className="muted" style={{ fontSize: 12, flex: 'none' }}>{meeting.time ? meeting.time + (meeting.end ? '–' + meeting.end : '') : 'Họp'}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meeting.title || 'Cuộc họp'}</span>
      <div className="meta">
        {p ? <span className="chip" style={{ background: p.color, color: '#fff' }}>{p.name}</span> : c ? <span className="chip">{c.name}</span> : null}
        {left ? <span className="chip amber">{left} việc sau họp</span> : null}
      </div>
    </div>
  );
}
