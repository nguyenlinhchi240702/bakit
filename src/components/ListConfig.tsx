import { useState } from 'react';
import { useStore } from '../lib/store';
import type { ChecklistDef, Project, StatusDef } from '../lib/types';
import { COLOR_STYLE, COLORS, customList } from '../lib/templates';
import { Confirm, Modal } from './ui';
import { Icon } from './Icon';
import { uid } from '../lib/util';

export function ListConfigModal({ project, list, onClose }: { project: Project; list: ChecklistDef; onClose: () => void }) {
  const { updateList, deleteList, items, go, updateItem } = useStore();
  const [d, setD] = useState<ChecklistDef>(() => JSON.parse(JSON.stringify(list)));
  const [askDelete, setAskDelete] = useState(false);
  const used = (sid: string) => items.filter((i) => i.listId === list.id && i.statusId === sid).length;
  const setSt = (i: number, p: Partial<StatusDef>) => setD({ ...d, statuses: d.statuses.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const move = (i: number, dir: number) => {
    const arr = [...d.statuses];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setD({ ...d, statuses: arr });
  };
  const removeSt = (i: number) => {
    if (d.statuses.length <= 1) return;
    setD({ ...d, statuses: d.statuses.filter((_, k) => k !== i) });
  };
  const save = () => {
    // Items whose status was removed move to the first status.
    const ids = new Set(d.statuses.map((s) => s.id));
    items.filter((i) => i.listId === list.id && !ids.has(i.statusId)).forEach((i) => updateItem(i.id, { statusId: d.statuses[0].id }, 'Trạng thái cũ bị xóa → ' + d.statuses[0].name));
    updateList(project.id, list.id, { ...d, name: d.name.trim() || list.name, prefix: (d.prefix.trim() || list.prefix).toUpperCase() });
    onClose();
  };
  const toggle = (k: keyof ChecklistDef['cols']) => setD({ ...d, cols: { ...d.cols, [k]: !d.cols[k] } });

  return (
    <Modal title={'Cột & trạng thái · ' + list.name} onClose={onClose} width={640} footer={<>
      <button className="btn dngo" style={{ marginRight: 'auto' }} onClick={() => setAskDelete(true)}><Icon name="trash" size={14} />Xóa danh sách</button>
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className="btn pri" onClick={save}>Lưu</button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr 1.2fr', gap: 10 }}>
        <label className="field"><span className="lbl">Tên danh sách</span><input className="inp" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
        <label className="field"><span className="lbl">Tiền tố mã</span><input className="inp" value={d.prefix} maxLength={3} onChange={(e) => setD({ ...d, prefix: e.target.value })} /></label>
        <label className="field"><span className="lbl">Tên cột phân loại</span><input className="inp" value={d.catLabel} onChange={(e) => setD({ ...d, catLabel: e.target.value })} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
        <div className="field" style={{ gap: 8 }}>
          <span className="sec">Cột hiển thị</span>
          {([['cat', d.catLabel || 'Phân loại'], ['owner', 'Người'], ['due', 'Hạn (hiện ở Hôm nay & Lịch)'], ['note', 'Ghi chú'], ['attach', 'Ảnh · Work item']] as Array<[keyof ChecklistDef['cols'], string]>).map(([k, label]) => (
            <label key={k} className="row" style={{ gap: 8 }}><input type="checkbox" checked={d.cols[k]} onChange={() => toggle(k)} />{label}</label>
          ))}
          <span className="muted" style={{ fontSize: 12 }}>Ô tick, Mã, Tiêu đề và Trạng thái luôn hiện.</span>
        </div>
        <div className="field" style={{ gap: 6 }}>
          <span className="sec">Trạng thái · thứ tự = thứ tự khi bấm chuyển</span>
          {d.statuses.map((s, i) => (
            <div key={s.id} className="row" style={{ gap: 6 }}>
              <div className="row" style={{ gap: 0 }}>
                <button className="btn ghost sm sq" style={{ width: 22 }} aria-label="Lên" onClick={() => move(i, -1)}><Icon name="up" size={12} /></button>
                <button className="btn ghost sm sq" style={{ width: 22 }} aria-label="Xuống" onClick={() => move(i, 1)}><Icon name="down" size={12} /></button>
              </div>
              <input className="inp" style={{ height: 28, flex: 1, background: COLOR_STYLE[s.color].bg, color: COLOR_STYLE[s.color].fg, fontWeight: 600 }} value={s.name} onChange={(e) => setSt(i, { name: e.target.value })} aria-label="Tên trạng thái" />
              <select className="inp" style={{ height: 28, width: 92 }} value={s.color} onChange={(e) => setSt(i, { color: e.target.value as StatusDef['color'] })} aria-label="Màu">
                {COLORS.map((c) => <option key={c} value={c}>{{ gray: 'Xám', blue: 'Xanh', amber: 'Vàng', green: 'Lục', red: 'Đỏ', purple: 'Tím' }[c]}</option>)}
              </select>
              <label className="row" style={{ gap: 4, fontSize: 12, width: 84 }} title="Mục ở trạng thái này được tính là xong (gạch ngang, không hiện ở Hôm nay)"><input type="checkbox" checked={s.done} onChange={(e) => setSt(i, { done: e.target.checked })} />Là “xong”</label>
              <button className="btn ghost sm sq" aria-label="Xóa trạng thái" title={used(s.id) ? used(s.id) + ' mục đang dùng — sẽ chuyển về trạng thái đầu' : 'Xóa'} onClick={() => removeSt(i)}><Icon name="x" size={13} /></button>
            </div>
          ))}
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setD({ ...d, statuses: [...d.statuses, { id: uid('s'), name: 'Trạng thái mới', color: 'gray', done: false }] })}><Icon name="plus" size={13} />Thêm trạng thái</button>
          {!d.statuses.some((s) => s.done) ? <span className="banner warn" style={{ fontSize: 12 }}>Chưa có trạng thái nào là “xong” — ô tick sẽ không có tác dụng.</span> : null}
        </div>
      </div>
      {askDelete ? <Confirm title={'Xóa danh sách ' + list.name + '?'} danger okLabel="Xóa vĩnh viễn"
        body={items.filter((i) => i.listId === list.id).length + ' mục trong danh sách sẽ bị xóa vĩnh viễn. Ảnh vẫn giữ trong Ảnh chụp.'}
        onOk={() => { deleteList(project.id, list.id); onClose(); go({ name: 'project', projectId: project.id }); }} onClose={() => setAskDelete(false)} /> : null}
    </Modal>
  );
}

export function AddListModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { addList, go } = useStore();
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const save = () => {
    if (!name.trim()) return;
    const def = customList(name.trim(), prefix || name.trim()[0]);
    addList(project.id, def);
    go({ name: 'project', projectId: project.id, listId: def.id });
    onClose();
  };
  return (
    <Modal title="Thêm danh sách" onClose={onClose} width={420} footer={<>
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className="btn pri" disabled={!name.trim()} onClick={save}>Thêm</button>
    </>}>
      <label className="field"><span className="lbl">Tên danh sách</span><input className="inp" autoFocus value={name} placeholder="VD: Ý tưởng, Câu hỏi khách hàng, Bàn giao…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      <label className="field"><span className="lbl">Tiền tố mã (tối đa 3 ký tự)</span><input className="inp" value={prefix} maxLength={3} placeholder={name ? name[0].toUpperCase() : 'X'} onChange={(e) => setPrefix(e.target.value)} /></label>
      <span className="muted" style={{ fontSize: 12 }}>Có sẵn 3 trạng thái Chưa làm / Đang làm / Xong — sửa trong “Cột & trạng thái”.</span>
    </Modal>
  );
}
