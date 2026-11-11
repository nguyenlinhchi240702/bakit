import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { Project } from '../lib/types';
import { Modal } from './ui';
import { PROJECT_COLORS, cloneLists, startingLists } from '../lib/templates';
import { initials } from '../lib/util';

export function ProjectModal({ project, onClose, onCreated }: { project?: Project; onClose: () => void; onCreated?: (p: Project) => void }) {
  const { addProject, updateProject } = useStore();
  const listTemplate = useStore((s) => s.settings.listTemplate);
  const [short, setShort] = useState(project?.short || '');
  const [name, setName] = useState(project?.name || '');
  const [client, setClient] = useState(project?.client || '');
  const [phase, setPhase] = useState(project?.phase || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [pinned, setPinned] = useState(project ? project.pinned : true);
  const others = useStore((s) => s.projects);
  const [source, setSource] = useState('');
  const template = useMemo(() => {
    const src = others.find((p) => p.id === source);
    return src ? cloneLists(src.lists) : startingLists(listTemplate);
  }, [source, others, listTemplate]);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const picked = (name: string) => pick[name] !== false;

  const save = () => {
    if (!name.trim()) return;
    if (project) updateProject(project.id, { name: name.trim(), client, phase, color, pinned, short: short.trim() || undefined });
    else {
      const p = addProject({ name: name.trim(), client, phase, color, pinned, short: short.trim() || undefined, lists: template.filter((l) => picked(l.name)) });
      onCreated?.(p);
    }
    onClose();
  };

  return (
    <Modal title={project ? 'Sửa dự án' : 'Dự án mới'} onClose={onClose} width={480} footer={<>
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className="btn pri" disabled={!name.trim()} onClick={save}>{project ? 'Lưu' : 'Tạo dự án'}</button>
    </>}>
      <label className="field"><span className="lbl">Tên dự án<span className="req">*</span></span><input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
        <label className="field"><span className="lbl">Khách hàng</span><input className="inp" value={client} onChange={(e) => setClient(e.target.value)} /></label>
        <label className="field"><span className="lbl">Giai đoạn</span><input className="inp" value={phase} placeholder="VD: UAT vòng 3" onChange={(e) => setPhase(e.target.value)} /></label>
        <label className="field"><span className="lbl">Viết tắt</span><input className="inp" maxLength={3} value={short} placeholder={initials(name || 'Dự án')} onChange={(e) => setShort(e.target.value.toUpperCase())} /></label>
      </div>
      <div className="field"><span className="lbl">Màu</span>
        <div className="row" style={{ gap: 9 }}>{PROJECT_COLORS.map((c) => <button key={c} className={'sw' + (c === color ? ' on' : '')} style={{ background: c }} aria-label={'Màu ' + c} onClick={() => setColor(c)} />)}</div>
      </div>
      {!project ? (
        <div className="field"><span className="lbl">Checklist tạo sẵn</span>
          {others.length ? (
            <select className="inp" style={{ height: 32 }} value={source} onChange={(e) => { setSource(e.target.value); setPick({}); }} aria-label="Lấy checklist từ">
              <option value="">Mẫu chung (loại checklist & trạng thái đã nhập)</option>
              {others.map((p) => <option key={p.id} value={p.id}>Giống dự án {p.name}</option>)}
            </select>
          ) : null}
          <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
            {template.map((l) => (
              <label key={l.name} className="row" style={{ gap: 6 }}><input type="checkbox" checked={picked(l.name)} onChange={(e) => setPick({ ...pick, [l.name]: e.target.checked })} />{l.name}</label>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Thêm danh sách riêng sau trong dự án (nút “+ Danh sách”).</span>
        </div>
      ) : null}
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />Ghim ra menu trái</label>
    </Modal>
  );
}
