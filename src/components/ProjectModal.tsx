import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Project } from '../lib/types';
import { Modal } from './ui';
import { PROJECT_COLORS, defaultLists } from '../lib/templates';

export function ProjectModal({ project, onClose, onCreated }: { project?: Project; onClose: () => void; onCreated?: (p: Project) => void }) {
  const { addProject, updateProject } = useStore();
  const [name, setName] = useState(project?.name || '');
  const [client, setClient] = useState(project?.client || '');
  const [phase, setPhase] = useState(project?.phase || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [pinned, setPinned] = useState(project ? project.pinned : true);
  const template = defaultLists();
  const [pick, setPick] = useState<Record<string, boolean>>(() => Object.fromEntries(template.map((l) => [l.name, true])));

  const save = () => {
    if (!name.trim()) return;
    if (project) updateProject(project.id, { name: name.trim(), client, phase, color, pinned });
    else {
      const p = addProject({ name: name.trim(), client, phase, color, pinned, lists: template.filter((l) => pick[l.name]) });
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="field"><span className="lbl">Khách hàng</span><input className="inp" value={client} onChange={(e) => setClient(e.target.value)} /></label>
        <label className="field"><span className="lbl">Giai đoạn</span><input className="inp" value={phase} placeholder="VD: UAT vòng 3" onChange={(e) => setPhase(e.target.value)} /></label>
      </div>
      <div className="field"><span className="lbl">Màu</span>
        <div className="row" style={{ gap: 9 }}>{PROJECT_COLORS.map((c) => <button key={c} className={'sw' + (c === color ? ' on' : '')} style={{ background: c }} aria-label={'Màu ' + c} onClick={() => setColor(c)} />)}</div>
      </div>
      {!project ? (
        <div className="field"><span className="lbl">Checklist tạo sẵn</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
            {template.map((l) => (
              <label key={l.name} className="row" style={{ gap: 6 }}><input type="checkbox" checked={pick[l.name]} onChange={(e) => setPick({ ...pick, [l.name]: e.target.checked })} />{l.name}</label>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Thêm danh sách riêng sau trong dự án (nút “+ Danh sách”).</span>
        </div>
      ) : null}
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />Ghim ra menu trái</label>
    </Modal>
  );
}
