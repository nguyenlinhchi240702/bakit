import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Icon } from '../components/Icon';
import { AssetThumb, Check, Confirm, Popover } from '../components/ui';
import { ddmm, ddmmyyyy, longDate, todayKey, toIso } from '../lib/dates';
import { matches, uid } from '../lib/util';
import { copyText, kb, pickImageFiles } from '../lib/platform';
import { pushImageHandler } from '../lib/paste';
import { startCapture } from '../lib/capture';
import type { Meeting, MeetingAction, MeetingCat, Project } from '../lib/types';

const NONE = 'none';

function groupOf(m: Meeting): string {
  return m.projectId ? 'p:' + m.projectId : m.catId ? 'c:' + m.catId : NONE;
}
function groupName(g: string, projects: Project[], cats: MeetingCat[]): string {
  if (g === 'all') return 'Tất cả cuộc họp';
  if (g === NONE) return 'Chưa phân loại';
  if (g.startsWith('p:')) return projects.find((p) => p.id === g.slice(2))?.name || 'Dự án đã xóa';
  return cats.find((c) => c.id === g.slice(2))?.name || 'Mục đã xóa';
}
const openActions = (m: Meeting) => m.actions.filter((a) => !a.done).length;

export function MeetingsView({ group = 'all', meetingId }: { group?: string; meetingId?: string }) {
  const s = useStore();
  const { meetings, projects, go } = s;
  const cats = s.settings.meetingCats || [];
  const [q, setQ] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catMenu, setCatMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [askDelCat, setAskDelCat] = useState<MeetingCat | null>(null);

  const activeProjects = projects.filter((p) => !p.archived);
  const count = (g: string) => meetings.filter((m) => g === 'all' || groupOf(m) === g).length;

  const list = useMemo(() => meetings
    .filter((m) => group === 'all' || groupOf(m) === group)
    .filter((m) => !q.trim() || [m.title, m.content, m.decisions, m.attendees, m.workItem || '', ...m.actions.map((a) => a.text + ' ' + a.owner)].some((f) => f && matches(f, q)))
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))), [meetings, group, q]);

  const current = meetings.find((m) => m.id === meetingId);

  const create = () => {
    const base: Partial<Meeting> = { date: todayKey() };
    if (group.startsWith('p:')) base.projectId = group.slice(2);
    if (group.startsWith('c:')) {
      base.catId = group.slice(2);
      const c = cats.find((x) => x.id === base.catId);
      if (c?.people) base.attendees = c.people;
    }
    const gName = group === 'all' || group === NONE ? '' : groupName(group, projects, cats);
    base.title = 'Họp ' + (gName ? gName + ' ' : '') + ddmm(todayKey());
    const m = s.addMeeting(base);
    go({ name: 'meetings', group, meetingId: m.id });
  };

  const saveCats = (next: MeetingCat[]) => s.saveSettings({ meetingCats: next });
  const addCat = () => {
    const name = catName.trim();
    if (!name) { setAddingCat(false); return; }
    const c: MeetingCat = { id: uid('c'), name };
    saveCats([...cats, c]);
    setCatName(''); setAddingCat(false);
    go({ name: 'meetings', group: 'c:' + c.id });
  };

  const groupBtn = (g: string, label: string, badge?: React.ReactNode, menu?: React.ReactNode) => (
    <div key={g} style={{ position: 'relative' }}>
      <button className={'nav' + (group === g ? ' on' : '')} onClick={() => go({ name: 'meetings', group: g })} style={{ paddingRight: menu ? 30 : 10 }}>
        {badge}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span><span className="n">{count(g)}</span>
      </button>
      {menu}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Groups */}
      <div style={{ width: 220, flex: 'none', borderRight: '1px solid var(--border)', background: 'var(--surface-2)', padding: 10, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        {groupBtn('all', 'Tất cả cuộc họp', <Icon name="meeting" />)}
        <span className="sec" style={{ padding: '14px 10px 4px' }}>Theo dự án</span>
        {activeProjects.length === 0 ? <span className="muted" style={{ fontSize: 12, padding: '0 10px' }}>Chưa có dự án.</span> : null}
        {activeProjects.map((p) => groupBtn('p:' + p.id, p.name, <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flex: 'none' }} />))}
        <span className="sec" style={{ padding: '14px 10px 4px' }}>Mục riêng</span>
        {cats.map((c) => renaming?.id === c.id ? (
          <input key={c.id} className="inp" autoFocus style={{ height: 32 }} value={renaming.name}
            onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
            onBlur={() => { if (renaming.name.trim()) saveCats(cats.map((x) => (x.id === c.id ? { ...x, name: renaming.name.trim() } : x))); setRenaming(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
        ) : groupBtn('c:' + c.id, c.name, <Icon name="folder" size={14} />, (
          <>
            <button className="btn ghost sm sq" aria-label={'Tùy chọn ' + c.name} style={{ position: 'absolute', right: 4, top: 6, width: 24, height: 24 }} onClick={() => setCatMenu(catMenu === c.id ? null : c.id)}><Icon name="more" size={14} /></button>
            <Popover open={catMenu === c.id} onClose={() => setCatMenu(null)} style={{ right: 0, top: 32, minWidth: 150 }}>
              <button className="mi" onClick={() => { setRenaming({ id: c.id, name: c.name }); setCatMenu(null); }}>Đổi tên</button>
              <button className="mi dng" onClick={() => { setAskDelCat(c); setCatMenu(null); }}>Xóa mục</button>
            </Popover>
          </>
        )))}
        {addingCat ? (
          <input className="inp" autoFocus style={{ height: 32 }} placeholder="Tên mục, vd Họp nội bộ" value={catName}
            onChange={(e) => setCatName(e.target.value)} onBlur={addCat}
            onKeyDown={(e) => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setCatName(''); setAddingCat(false); } }} />
        ) : (
          <button className="nav" style={{ color: 'var(--accent-text)' }} onClick={() => setAddingCat(true)}><Icon name="plus" />Thêm mục</button>
        )}
        {count(NONE) ? <>
          <span className="sec" style={{ padding: '14px 10px 4px' }}>Khác</span>
          {groupBtn(NONE, 'Chưa phân loại', <Icon name="note" size={14} />)}
        </> : null}
      </div>

      {/* List */}
      <div style={{ width: 300, flex: 'none', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <div className="between"><b style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName(group, projects, cats)}</b>
            <button className="btn pri sm" onClick={create}><Icon name="plus" size={14} />Họp mới</button></div>
          <label className="inp" style={{ height: 32 }}><Icon name="search" className="muted" size={14} />
            <input className="ghost-input" placeholder="Tìm trong ghi chú họp…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm cuộc họp" /></label>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.length === 0 ? (
            <div className="empty" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <span className="muted">{q ? 'Không tìm thấy cuộc họp nào.' : 'Chưa có ghi chú họp nào ở đây.'}</span>
              {!q ? <button className="btn sm" onClick={create}><Icon name="plus" size={14} />Ghi chú cuộc họp đầu tiên</button> : null}
            </div>
          ) : null}
          {list.map((m) => {
            const on = m.id === meetingId;
            const g = groupOf(m);
            const proj = m.projectId ? projects.find((p) => p.id === m.projectId) : undefined;
            const left = openActions(m);
            return (
              <button key={m.id} onClick={() => go({ name: 'meetings', group, meetingId: m.id })}
                style={{ textAlign: 'left', border: '1px solid ' + (on ? 'var(--accent)' : 'transparent'), background: on ? 'var(--accent-soft)' : 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <b style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title || 'Cuộc họp không tên'}</b>
                <span className="row" style={{ gap: 6, fontSize: 11.5, flexWrap: 'wrap' }}>
                  <span className="muted">{ddmmyyyy(m.date)}{m.time ? ' · ' + m.time : ''}</span>
                  {group === 'all' && g !== NONE ? <span className="chip" style={{ height: 18, fontSize: 11, ...(proj ? { background: proj.color, color: '#fff' } : {}) }}>{groupName(g, projects, cats)}</span> : null}
                  {left ? <span className="chip amber" style={{ height: 18, fontSize: 11 }}>{left} việc chưa xong</span> : null}
                  {m.assetIds.length ? <span className="chip" style={{ height: 18, fontSize: 11 }}><Icon name="image" size={11} />{m.assetIds.length}</span> : null}
                </span>
                {m.content ? <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.content.split('\n').find((l) => l.trim())}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {current ? <MeetingEditor key={current.id} meeting={current} group={group} /> : (
          <div className="empty" style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', maxWidth: 360 }}>
              <Icon name="meeting" size={36} className="muted" />
              <b>Ghi chú cuộc họp</b>
              <span className="muted" style={{ fontSize: 13 }}>Ghi nội dung, kết luận và việc cần làm theo từng dự án hoặc mục riêng. Việc cần làm có thể chuyển thành việc có nhắc giờ.</span>
              <button className="btn pri" onClick={create}><Icon name="plus" />Họp mới</button>
            </div>
          </div>
        )}
      </div>

      {askDelCat ? <Confirm title={'Xóa mục “' + askDelCat.name + '”?'} danger okLabel="Xóa mục"
        body="Các cuộc họp trong mục này vẫn được giữ, chuyển sang “Chưa phân loại”."
        onOk={() => {
          const id = askDelCat.id;
          saveCats(cats.filter((c) => c.id !== id));
          meetings.filter((m) => m.catId === id).forEach((m) => s.updateMeeting(m.id, { catId: undefined }));
          if (group === 'c:' + id) go({ name: 'meetings', group: 'all' });
        }} onClose={() => setAskDelCat(null)} /> : null}
    </div>
  );
}

function MeetingEditor({ meeting, group }: { meeting: Meeting; group: string }) {
  const s = useStore();
  const { projects, assets, go } = s;
  const cats = s.settings.meetingCats || [];
  const people = s.settings.people;
  const [draft, setDraft] = useState({ title: meeting.title, content: meeting.content, decisions: meeting.decisions, workItem: meeting.workItem || '' });
  const [askDel, setAskDel] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [personQ, setPersonQ] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Partial<Meeting> | null>(null);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) { s.updateMeeting(meeting.id, pending.current); pending.current = null; }
  };
  const edit = (p: Partial<typeof draft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    pending.current = { ...pending.current, ...p };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  };
  // Save whatever is still pending when switching meetings.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => pushImageHandler((blobs) => {
    Promise.all(blobs.map((b) => useStore.getState().addImage(b, 'paste'))).then((as) => {
      as.forEach((a) => useStore.getState().attachAssetToMeeting(meeting.id, a.id));
      useStore.getState().showToast('Đã dán ' + as.length + ' ảnh vào ghi chú họp');
    });
    return true;
  }), [meeting.id]);

  const attendees = meeting.attendees.split(',').map((x) => x.trim()).filter(Boolean);
  const setAttendees = (list: string[]) => s.updateMeeting(meeting.id, { attendees: Array.from(new Set(list)).join(', ') });
  const addPerson = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setAttendees([...attendees, n]);
    setPersonQ('');
  };

  const setActions = (actions: MeetingAction[]) => s.updateMeeting(meeting.id, { actions });
  const patchAction = (id: string, p: Partial<MeetingAction>) => setActions(meeting.actions.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const addAction = () => {
    const t = newAction.trim();
    if (!t) return;
    setActions([...meeting.actions, { id: uid('ma'), text: t, owner: '', done: false }]);
    setNewAction('');
  };
  const toTask = (a: MeetingAction) => {
    const date = a.due || todayKey();
    const task = s.addTask({
      kind: 'task', title: a.text + (a.owner ? ' (' + a.owner + ')' : ''), date, remindAt: toIso(date, '09:00'),
      note: 'Từ cuộc họp: ' + (meeting.title || ddmm(meeting.date)), workItem: meeting.workItem || undefined
    });
    patchAction(a.id, { taskId: task.id });
    s.showToast('Đã tạo việc ' + (date === todayKey() ? 'hôm nay' : ddmm(date)) + ', nhắc 09:00');
  };

  const groupValue = groupOf(meeting);
  const setGroup = (g: string) => {
    s.updateMeeting(meeting.id, { projectId: g.startsWith('p:') ? g.slice(2) : undefined, catId: g.startsWith('c:') ? g.slice(2) : undefined });
  };

  const minutes = () => {
    const lines = [
      'BIÊN BẢN HỌP: ' + (draft.title || '—'),
      'Thời gian: ' + ddmmyyyy(meeting.date) + (meeting.time ? ' ' + meeting.time + (meeting.end ? '–' + meeting.end : '') : ''),
      groupValue !== NONE ? (meeting.projectId ? 'Dự án: ' : 'Mục: ') + groupName(groupValue, projects, cats) : '',
      attendees.length ? 'Thành phần: ' + attendees.join(', ') : '',
      draft.workItem ? 'Work item: ' + draft.workItem : '',
      '',
      draft.content.trim() ? 'NỘI DUNG\n' + draft.content.trim() + '\n' : '',
      draft.decisions.trim() ? 'KẾT LUẬN\n' + draft.decisions.trim() + '\n' : '',
      meeting.actions.length ? 'VIỆC CẦN LÀM\n' + meeting.actions.map((a, i) => `${i + 1}. ${a.done ? '[x] ' : ''}${a.text}${a.owner ? ' – ' + a.owner : ''}${a.due ? ' – hạn ' + ddmm(a.due) : ''}`).join('\n') : ''
    ];
    return lines.filter((l, i) => l !== '' || i === 5).join('\n').trim();
  };

  const addFiles = async () => {
    const files = await pickImageFiles();
    for (const f of files) {
      const a = await useStore.getState().addImage(f, 'file', f.name.replace(/\.[^.]+$/, ''));
      useStore.getState().attachAssetToMeeting(meeting.id, a.id);
    }
  };

  const labelCol = { width: 96, flex: 'none' as const, fontSize: 12.5 };

  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="inp" style={{ height: 42, fontSize: 18, fontWeight: 700 }} value={draft.title} placeholder="Tên cuộc họp" aria-label="Tên cuộc họp"
          onChange={(e) => edit({ title: e.target.value })} onBlur={flush} />

        <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={labelCol}>Thời gian</span>
            <input type="date" className="inp" style={{ height: 32, width: 150 }} value={meeting.date} onChange={(e) => e.target.value && s.updateMeeting(meeting.id, { date: e.target.value })} aria-label="Ngày họp" />
            <input type="time" className="inp" style={{ height: 32, width: 110 }} value={meeting.time || ''} onChange={(e) => s.updateMeeting(meeting.id, { time: e.target.value || undefined })} aria-label="Giờ bắt đầu" />
            <span className="muted">–</span>
            <input type="time" className="inp" style={{ height: 32, width: 110 }} value={meeting.end || ''} onChange={(e) => s.updateMeeting(meeting.id, { end: e.target.value || undefined })} aria-label="Giờ kết thúc" />
            <span className="muted" style={{ fontSize: 12 }}>{longDate(meeting.date)}</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="muted" style={labelCol}>Thuộc</span>
            <select className="inp" style={{ height: 32, width: 300 }} value={groupValue} onChange={(e) => setGroup(e.target.value)} aria-label="Dự án hoặc mục">
              <option value={NONE}>Chưa phân loại</option>
              {projects.filter((p) => !p.archived || p.id === meeting.projectId).length ? <optgroup label="Dự án">{projects.filter((p) => !p.archived || p.id === meeting.projectId).map((p) => <option key={p.id} value={'p:' + p.id}>{p.name}</option>)}</optgroup> : null}
              {cats.length ? <optgroup label="Mục riêng">{cats.map((c) => <option key={c.id} value={'c:' + c.id}>{c.name}</option>)}</optgroup> : null}
            </select>
            <input className="inp" style={{ height: 32, width: 140 }} placeholder="Work item #" value={draft.workItem} onChange={(e) => edit({ workItem: e.target.value })} onBlur={flush} aria-label="Work item Azure" />
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span className="muted" style={{ ...labelCol, paddingTop: 7 }}>Thành phần</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {attendees.map((p) => (
                <span key={p} className="chip" style={{ height: 26, paddingRight: 4 }}>{p}
                  <button className="btn ghost sm sq" style={{ width: 18, height: 18 }} aria-label={'Bỏ ' + p} onClick={() => setAttendees(attendees.filter((x) => x !== p))}><Icon name="x" size={11} /></button>
                </span>
              ))}
              <input className="inp" list="meeting-people" style={{ height: 30, width: 200 }} placeholder="+ Thêm người (Enter)" value={personQ}
                onChange={(e) => {
                  const v = e.target.value;
                  // Picking from the suggestion list adds immediately.
                  if (people.includes(v)) addPerson(v); else setPersonQ(v);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPerson(personQ); } }}
                onBlur={() => addPerson(personQ)} aria-label="Thêm người dự họp" />
              <datalist id="meeting-people">{people.filter((p) => !attendees.includes(p)).map((p) => <option key={p} value={p} />)}</datalist>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="lbl">Nội dung trao đổi</span>
          <textarea className="inp" style={{ minHeight: 200, padding: '10px 12px', lineHeight: 1.55, resize: 'vertical' }} value={draft.content}
            placeholder={'Ghi theo từng ý, ví dụ:\n- Khách muốn bổ sung bộ lọc theo phòng ban\n- Màn hình phê duyệt: đổi thứ tự cột…'}
            onChange={(e) => edit({ content: e.target.value })} onBlur={flush} aria-label="Nội dung trao đổi" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="lbl">Kết luận / quyết định</span>
          <textarea className="inp" style={{ minHeight: 90, padding: '10px 12px', lineHeight: 1.55, resize: 'vertical' }} value={draft.decisions}
            placeholder="Những điểm đã chốt trong buổi họp" onChange={(e) => edit({ decisions: e.target.value })} onBlur={flush} aria-label="Kết luận" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="between"><span className="lbl">Việc cần làm sau họp · {meeting.actions.filter((a) => a.done).length}/{meeting.actions.length}</span></div>
          <div className="card" style={{ padding: 4 }}>
            {meeting.actions.map((a) => (
              <div key={a.id} className="row" style={{ gap: 8, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                <Check on={a.done} onClick={() => patchAction(a.id, { done: !a.done })} />
                <input className="ghost-input" style={{ flex: 1, minWidth: 0, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : undefined }}
                  defaultValue={a.text} onBlur={(e) => e.target.value.trim() && e.target.value !== a.text && patchAction(a.id, { text: e.target.value.trim() })} aria-label="Nội dung việc" />
                <input className="inp" list="meeting-people" style={{ height: 28, width: 130 }} placeholder="Ai làm" defaultValue={a.owner}
                  onBlur={(e) => e.target.value !== a.owner && patchAction(a.id, { owner: e.target.value.trim() })} aria-label="Người làm" />
                <input type="date" className="inp" style={{ height: 28, width: 140 }} value={a.due || ''} onChange={(e) => patchAction(a.id, { due: e.target.value || undefined })} aria-label="Hạn" />
                {a.taskId ? <span className="chip green" style={{ height: 22 }} title="Đã có trong danh sách Việc"><Icon name="check" size={12} />Đã thành việc</span>
                  : <button className="btn sm" title="Tạo việc có nhắc giờ trong Hôm nay / Việc" onClick={() => toTask(a)}><Icon name="bell" size={13} />Thành việc</button>}
                <button className="btn ghost sm sq" aria-label="Xóa việc này" onClick={() => setActions(meeting.actions.filter((x) => x.id !== a.id))}><Icon name="x" size={13} /></button>
              </div>
            ))}
            <div className="row" style={{ gap: 8, padding: '4px 8px' }}>
              <Icon name="plus" className="muted" />
              <input className="ghost-input" style={{ flex: 1 }} placeholder="Thêm việc cần làm… (Enter)" value={newAction}
                onChange={(e) => setNewAction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAction(); }} aria-label="Thêm việc cần làm" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="between"><span className="lbl">Ảnh đính kèm · {meeting.assetIds.length}</span><span className="muted" style={{ fontSize: 11.5 }}>{kb('Ctrl+V')} để dán ảnh vào cuộc họp này</span></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {meeting.assetIds.map((id) => (
              <span key={id} style={{ position: 'relative' }}>
                <AssetThumb asset={assets.find((a) => a.id === id)} w={120} h={76} onClick={() => go({ name: 'images', assetId: id })} />
                <button className="btn sm sq" style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20 }} aria-label="Gỡ ảnh" title="Gỡ khỏi cuộc họp (ảnh vẫn trong Ảnh chụp)"
                  onClick={() => s.updateMeeting(meeting.id, { assetIds: meeting.assetIds.filter((x) => x !== id) })}><Icon name="x" size={12} /></button>
              </span>
            ))}
            <button className="btn sm" onClick={addFiles}>Chọn file</button>
            <button className="btn sm" onClick={() => startCapture({ kind: 'meeting', id: meeting.id })}><Icon name="capture" size={13} />Chụp mới</button>
          </div>
        </div>
      </div>

      <div className="row" style={{ padding: '10px 26px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', gap: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>Tự lưu</span>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={async () => { flush(); try { await copyText(minutes()); s.showToast('Đã copy biên bản họp, dán vào email / Teams'); } catch (e) { s.showToast('Không copy được: ' + String(e), 'err'); } }}><Icon name="copy" size={14} />Copy biên bản</button>
        <button className="btn sq dngo" aria-label="Xóa ghi chú họp" title="Xóa ghi chú họp" onClick={() => setAskDel(true)}><Icon name="trash" size={14} /></button>
      </div>
      {askDel ? <Confirm title="Xóa ghi chú họp này?" danger okLabel="Xóa" body="Có thể hoàn tác ngay sau khi xóa. Ảnh đính kèm vẫn giữ trong Ảnh chụp."
        onOk={() => { s.deleteMeeting(meeting.id); go({ name: 'meetings', group }); }} onClose={() => setAskDel(false)} /> : null}
    </>
  );
}
