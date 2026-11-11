import { Fragment, useEffect, useState } from 'react';
import { useStore, type BackupData } from '../lib/store';
import { Icon } from '../components/Icon';
import { Confirm, Modal } from '../components/ui';
import { applyImport, buildPlan, readWorkbook, type ImportPlan } from '../lib/excelImport';
import { appVersion, checkForUpdate } from '../lib/updater';
import templateUrl from '../assets/BAKit_du_lieu_ban_dau.xlsx?url';
import { blobToDataUrl, dataFolder, dataUrlToBlob, isMac, isTauri, kb, openDataFolder, registerHotkey, saveBlobAs } from '../lib/platform';
import { getDb } from '../lib/db';
import { startCapture } from '../lib/capture';
import { fileStamp } from '../lib/dates';

export function SettingsView() {
  const s = useStore();
  const { settings, saveSettings, showToast } = s;
  const [hotkey, setHotkey] = useState(settings.captureHotkey);
  const [folder, setFolder] = useState('');
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ plan: ImportPlan; file: string } | null>(null);
  const [azure, setAzure] = useState(settings.azureBase || '');
  const [askDemo, setAskDemo] = useState(false);
  const [version, setVersion] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => { appVersion().then(setVersion); }, []);

  const downloadTemplate = async () => {
    try {
      const blob = await (await fetch(templateUrl)).blob();
      const ok = await saveBlobAs(blob, 'BAKit_du_lieu_ban_dau.xlsx');
      if (ok) showToast('Đã lưu file Excel mẫu — điền xong bấm “Nhập từ Excel”');
    } catch (e) { showToast('Không lưu được file mẫu: ' + String(e), 'err'); }
  };
  const pickExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const p = buildPlan(await readWorkbook(f));
        if (!p.projects.length && !p.people.length && !p.tasks.length && !p.meetingCats.length) throw new Error('Không thấy dữ liệu — hãy dùng đúng file mẫu BAKit và điền vào ô vàng');
        setPlan({ plan: p, file: f.name });
      } catch (e) { showToast('Không đọc được file Excel: ' + (e instanceof Error ? e.message : String(e)), 'err'); }
      finally { setBusy(false); }
    };
    input.click();
  };
  const runImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await applyImport(plan.plan);
      showToast('Đã nhập ' + plan.plan.projects.length + ' dự án, ' + plan.plan.items.length + ' mục checklist từ ' + plan.file);
      setPlan(null);
      useStore.getState().go({ name: 'projects' });
    } catch (e) { showToast('Nhập thất bại: ' + String(e), 'err'); }
    finally { setBusy(false); }
  };
  useEffect(() => { dataFolder().then(setFolder); }, []);

  const applyHotkey = async () => {
    const ok = await registerHotkey(hotkey, () => startCapture());
    if (!isTauri) { saveSettings({ captureHotkey: hotkey }); showToast(kb('Bản web dùng Ctrl+Shift+S trong cửa sổ BAKit'), 'info'); return; }
    if (ok) { saveSettings({ captureHotkey: hotkey }); showToast('Đã đổi phím chụp thành ' + hotkey); }
    else { showToast('Không đăng ký được ' + hotkey + ' — có thể đang bị ứng dụng khác dùng', 'err'); registerHotkey(settings.captureHotkey, () => startCapture()); }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const st = useStore.getState();
      const db = await getDb();
      const images: Record<string, string> = {};
      for (const a of st.assets) {
        for (const key of [a.originalKey, a.renderedKey]) {
          if (!key) continue;
          const b = await db.getBlob(key);
          if (b) images[key] = await blobToDataUrl(b);
        }
      }
      const data: BackupData & { images: Record<string, string> } = {
        version: 1, exportedAt: new Date().toISOString(), settings: st.settings, assets: st.assets, notes: Object.values(st.notes),
        tasks: st.tasks, projects: st.projects, items: st.items, meetings: st.meetings, images
      };
      const ok = await saveBlobAs(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'BAKit_backup_' + fileStamp() + '.json');
      if (ok) showToast('Đã xuất bản sao lưu');
    } catch (e) {
      showToast('Không xuất được: ' + String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const data = JSON.parse(await f.text()) as BackupData & { images?: Record<string, string> };
        if (data.version !== 1 || !Array.isArray(data.projects)) throw new Error('File không đúng định dạng sao lưu BAKit');
        const blobs: Record<string, Blob> = {};
        for (const [k, v] of Object.entries(data.images || {})) blobs[k] = await dataUrlToBlob(v);
        await useStore.getState().importData(data, blobs);
        showToast('Đã khôi phục dữ liệu từ ' + f.name);
      } catch (e) {
        showToast('Không khôi phục được: ' + String(e), 'err');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="hd">Cài đặt</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, gridColumn: 'span 2', borderColor: 'var(--accent)' }}>
          <b style={{ fontSize: 15 }}>Nhập dữ liệu thật từ Excel</b>
          <span className="muted" style={{ fontSize: 12.5 }}>Điền file mẫu (dự án, loại checklist, trạng thái, người, mục họp, việc lặp lại, mục checklist có sẵn) rồi nhập một lần. Xem trước kết quả trước khi ghi.</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" onClick={downloadTemplate}><Icon name="download" />Tải file Excel mẫu</button>
            <button className="btn pri" disabled={busy} onClick={pickExcel}><Icon name="upload" />Nhập từ Excel…</button>
          </div>
        </section>
        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontSize: 15 }}>Giao diện</b>
          <div className="between"><span>Theme</span>
            <div className="seg">
              {([['system', 'Hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']] as const).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? 'on' : ''} onClick={() => saveSettings({ theme: k })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="between"><span>Định dạng xuất ảnh mặc định</span>
            <div className="seg">
              {(['png', 'jpg', 'webp'] as const).map((k) => <button key={k} className={settings.exportFormat === k ? 'on' : ''} onClick={() => saveSettings({ exportFormat: k })}>{k.toUpperCase()}</button>)}
            </div>
          </div>
          <label className="field"><span className="lbl">Link Azure DevOps (để bấm mã work item là mở thẳng)</span>
            <input className="inp" value={azure} placeholder="https://dev.azure.com/<tổ chức>/<project>" onChange={(e) => setAzure(e.target.value)}
              onBlur={() => { if ((settings.azureBase || '') !== azure.trim()) { saveSettings({ azureBase: azure.trim() || undefined }); showToast(azure.trim() ? 'Đã lưu link Azure DevOps' : 'Đã bỏ link Azure DevOps'); } }} />
          </label>
        </section>

        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontSize: 15 }}>Phím tắt chụp màn hình</b>
          <label className="field"><span className="lbl">Phím toàn cục (dùng được khi BAKit chạy nền)</span>
            <div className="row"><input className="inp" value={hotkey} onChange={(e) => setHotkey(e.target.value)} /><button className="btn" onClick={applyHotkey}>Áp dụng</button></div>
          </label>
          <span className="muted" style={{ fontSize: 12 }}>Ví dụ: CommandOrControl+Shift+S, Alt+Shift+A, F9. {isTauri ? '' : kb('Bản web chỉ nhận Ctrl+Shift+S khi đang ở trong trang.')}</span>
          <div style={{ fontSize: 12.5, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6 }}>
            <span>Dán ảnh / gắn ảnh vào mục đang mở</span><span className="kbd">{kb('Ctrl+V')}</span>
            <span>Việc mới</span><span className="kbd">{kb('Ctrl+N')}</span>
            <span>Undo / Redo trong trình sửa ảnh</span><span className="kbd">{kb('Ctrl+Z / Ctrl+Y')}</span>
            <span>Copy ảnh đã sửa</span><span className="kbd">{kb('Ctrl+Shift+C')}</span>
          </div>
        </section>

        <PeopleManager />
        <MeetingCatManager />

        <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, gridColumn: 'span 2' }}>
          <b style={{ fontSize: 15 }}>Dữ liệu</b>
          <div className="row"><span className="inp ro" style={{ flex: 1 }}>{folder}</span>{isTauri ? <button className="btn" onClick={openDataFolder}><Icon name="folder" />Mở thư mục</button> : null}</div>
          <span className="muted" style={{ fontSize: 12 }}>Mọi dữ liệu nằm trên máy này: ảnh gốc PNG không bao giờ bị ghi đè; danh sách, ghi chú, việc lưu trong SQLite. BAKit không upload gì ra Internet.</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy} onClick={exportBackup}><Icon name="download" />Xuất bản sao lưu (.json)</button>
            <button className="btn" disabled={busy} onClick={importBackup}>Khôi phục từ bản sao lưu…</button>
            <button className="btn" disabled={busy} onClick={() => setAskDemo(true)}>Nạp dữ liệu mẫu để xem thử</button>
            <button className="btn dngo" style={{ marginLeft: 'auto' }} onClick={() => setAskReset(true)}><Icon name="trash" />Xóa toàn bộ dữ liệu (kể cả dữ liệu mẫu)</button>
          </div>
        </section>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span className="muted" style={{ fontSize: 12 }}>BAKit {version} · {isTauri ? (isMac ? 'Ứng dụng macOS' : 'Ứng dụng Windows') : 'Bản chạy thử trên trình duyệt'}</span>
        {isTauri ? <button className="btn sm" disabled={checking} onClick={async () => { setChecking(true); await checkForUpdate(true); setChecking(false); }}><Icon name="refresh" size={13} />{checking ? 'Đang kiểm tra…' : 'Kiểm tra cập nhật'}</button> : null}
      </div>
      {askDemo ? <Confirm title="Nạp dữ liệu mẫu?" okLabel="Nạp dữ liệu mẫu" body="Thêm 3 dự án, việc và lịch hẹn mẫu vào dữ liệu hiện có để xem thử tính năng. Xóa sau bằng “Xóa toàn bộ dữ liệu”."
        onOk={async () => { const { seedDemo } = await import('../lib/seed'); seedDemo(); showToast('Đã nạp dữ liệu mẫu'); }} onClose={() => setAskDemo(false)} /> : null}
      {plan ? <ImportPreview plan={plan.plan} file={plan.file} busy={busy} onChange={(p) => setPlan({ ...plan, plan: p })} onOk={runImport} onClose={() => setPlan(null)} /> : null}
      {askReset ? <Confirm title="Xóa toàn bộ dữ liệu?" danger okLabel="Xóa hết" body="Tất cả dự án, checklist, việc, ghi chú và ảnh chụp trên máy này sẽ bị xóa vĩnh viễn. Nên xuất bản sao lưu trước." onOk={async () => { await s.resetAll(); showToast('Đã xóa toàn bộ dữ liệu'); }} onClose={() => setAskReset(false)} /> : null}
    </div>
  );
}

function ImportPreview({ plan, file, busy, onChange, onOk, onClose }: { plan: ImportPlan; file: string; busy: boolean; onChange: (p: ImportPlan) => void; onOk: () => void; onClose: () => void }) {
  const cur = useStore();
  const rows: Array<[string, number | string]> = [
    ['Dự án', plan.projects.length + (plan.projects.length ? ' · ' + plan.projects.map((p) => p.name).join(', ') : '')],
    ['Loại checklist', plan.listTemplate ? plan.listTemplate.map((l) => l.name + ' (' + l.statuses.length + ' trạng thái)').join(', ') : 'Giữ mặc định'],
    ['Mục checklist', plan.items.length],
    ['Người', plan.people.length ? plan.people.join(', ') : 0],
    ['Mục họp', plan.meetingCats.length ? plan.meetingCats.map((c) => c.name).join(', ') : 0],
    ['Việc lặp lại', plan.tasks.length],
  ];
  return (
    <Modal title={'Xem trước: ' + file} onClose={onClose} width={620} footer={<>
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className="btn pri" disabled={busy} onClick={onOk}>{busy ? 'Đang nhập…' : 'Nhập dữ liệu'}</button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 8, fontSize: 13 }}>
        {rows.map(([k, v]) => <Fragment key={k}><span className="muted">{k}</span><span>{v}</span></Fragment>)}
      </div>
      {plan.warnings.length ? (
        <div className="banner warn" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, maxHeight: 180, overflow: 'auto' }}>
          <b>Cần xem lại ({plan.warnings.length})</b>
          {plan.warnings.map((w, i) => <span key={i} style={{ fontSize: 12.5 }}>• {w}</span>)}
        </div>
      ) : <div className="banner ok">File hợp lệ, không có cảnh báo.</div>}
      <label className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={plan.replace} onChange={(e) => onChange({ ...plan, replace: e.target.checked })} style={{ marginTop: 3 }} />
        <span><b>Thay toàn bộ dữ liệu hiện có</b><br /><span className="muted" style={{ fontSize: 12.5 }}>
          {plan.replace
            ? <>Xóa {cur.projects.length} dự án, {cur.items.length} mục checklist, {cur.tasks.length} việc, {cur.meetings.length} cuộc họp đang có (gồm dữ liệu mẫu) rồi nạp file này. Ảnh chụp được giữ lại.</>
            : <>Chế độ cập nhật: dự án trùng tên được cập nhật và thêm mục checklist mới (mục trùng tiêu đề bỏ qua); người, mục họp, việc lặp lại mới được thêm vào. Không xóa gì.</>}</span></span>
      </label>
    </Modal>
  );
}

/** People list: add, rename (updates owners everywhere), set role / unit, delete. */
function PeopleManager() {
  const s = useStore();
  const { settings } = s;
  const info = settings.peopleInfo || {};
  const [newName, setNewName] = useState('');
  const [askDel, setAskDel] = useState<string | null>(null);
  const save = (people: string[], peopleInfo: typeof info) => s.saveSettings({ people, peopleInfo });
  const add = () => {
    const n = newName.trim();
    if (!n) return;
    if (settings.people.includes(n)) { s.showToast(n + ' đã có trong danh sách', 'info'); return; }
    save([...settings.people, n], info);
    setNewName('');
  };
  const rename = (old: string, name: string) => {
    const n = name.trim();
    if (!n || n === old) return;
    if (settings.people.includes(n)) { s.showToast(n + ' đã có trong danh sách', 'err'); return; }
    const nextInfo = { ...info };
    if (nextInfo[old]) { nextInfo[n] = nextInfo[old]; delete nextInfo[old]; }
    save(settings.people.map((p) => (p === old ? n : p)), nextInfo);
    // Keep checklists and meetings pointing at the same person.
    let changed = 0;
    s.items.filter((i) => i.owner === old).forEach((i) => { s.updateItem(i.id, { owner: n }); changed++; });
    s.meetings.forEach((m) => {
      const att = m.attendees.split(',').map((x) => x.trim());
      const hit = att.includes(old) || m.actions.some((a) => a.owner === old);
      if (!hit) return;
      changed++;
      s.updateMeeting(m.id, { attendees: att.map((x) => (x === old ? n : x)).join(', '), actions: m.actions.map((a) => (a.owner === old ? { ...a, owner: n } : a)) });
    });
    s.showToast('Đã đổi tên ' + old + ' → ' + n + (changed ? ' (cập nhật ' + changed + ' mục / cuộc họp)' : ''));
  };
  const setInfo = (name: string, patch: { role?: string; org?: string }) => {
    const cur = info[name] || {};
    const next = { ...cur, ...patch };
    if ((cur.role || '') === (next.role || '') && (cur.org || '') === (next.org || '')) return;
    save(settings.people, { ...info, [name]: next });
  };
  const used = (name: string) => s.items.filter((i) => i.owner === name).length;

  return (
    <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="between"><b style={{ fontSize: 15 }}>Người làm việc cùng · {settings.people.length}</b><span className="muted" style={{ fontSize: 12 }}>Gợi ý ở cột Người phụ trách và người dự họp</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflow: 'auto' }}>
        {settings.people.length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>Chưa có ai. Thêm ở ô bên dưới hoặc nhập từ Excel.</span> : null}
        {settings.people.map((p) => (
          <div key={p} className="row" style={{ gap: 6 }}>
            <input className="inp" style={{ height: 30, flex: 1.4, minWidth: 0 }} defaultValue={p} aria-label="Tên"
              onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== p) rename(p, e.target.value); else e.target.value = p; }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            <input className="inp" style={{ height: 30, flex: 1, minWidth: 0 }} defaultValue={info[p]?.role || ''} placeholder="Vai trò" aria-label="Vai trò" onBlur={(e) => setInfo(p, { role: e.target.value.trim() || undefined })} />
            <input className="inp" style={{ height: 30, flex: 1, minWidth: 0 }} defaultValue={info[p]?.org || ''} placeholder="Đơn vị" aria-label="Đơn vị" onBlur={(e) => setInfo(p, { org: e.target.value.trim() || undefined })} />
            <button className="btn ghost sm sq" aria-label={'Xóa ' + p} title="Xóa khỏi danh sách" onClick={() => setAskDel(p)}><Icon name="trash" size={13} /></button>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="inp" style={{ height: 32, flex: 1 }} placeholder="Thêm người… (Enter)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Thêm người" />
        <button className="btn sm" onClick={add}><Icon name="plus" size={13} />Thêm</button>
      </div>
      {askDel ? <Confirm title={'Xóa ' + askDel + ' khỏi danh sách?'} danger okLabel="Xóa" onClose={() => setAskDel(null)}
        body={used(askDel) ? askDel + ' đang phụ trách ' + used(askDel) + ' mục checklist. Các mục đó vẫn giữ tên này, chỉ bỏ khỏi danh sách gợi ý.' : 'Chỉ bỏ khỏi danh sách gợi ý.'}
        onOk={() => { const n = askDel; const nextInfo = { ...info }; delete nextInfo[n]; save(settings.people.filter((x) => x !== n), nextInfo); s.showToast('Đã xóa ' + n); }} /> : null}
    </section>
  );
}

/** Standalone meeting categories (Họp nội bộ, Daily…): rename, details, delete. */
function MeetingCatManager() {
  const s = useStore();
  const cats = s.settings.meetingCats || [];
  const [newName, setNewName] = useState('');
  const [askDel, setAskDel] = useState<string | null>(null);
  const save = (next: typeof cats) => s.saveSettings({ meetingCats: next });
  const patch = (id: string, p: Partial<(typeof cats)[number]>) => {
    const cur = cats.find((c) => c.id === id);
    if (!cur || Object.entries(p).every(([k, v]) => (cur as unknown as Record<string, unknown>)[k] === v)) return;
    save(cats.map((c) => (c.id === id ? { ...c, ...p } : c)));
  };
  const add = () => {
    const n = newName.trim();
    if (!n) return;
    save([...cats, { id: 'c' + Date.now().toString(36), name: n }]);
    setNewName('');
  };
  const del = cats.find((c) => c.id === askDel);
  const usedBy = (id: string) => s.meetings.filter((m) => m.catId === id).length;
  return (
    <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="between"><b style={{ fontSize: 15 }}>Mục ghi chú họp · {cats.length}</b><span className="muted" style={{ fontSize: 12 }}>Họp không thuộc dự án</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
        {cats.length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>Chưa có mục nào.</span> : null}
        {cats.map((c) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <input className="inp" style={{ height: 30, fontWeight: 600 }} defaultValue={c.name} aria-label="Tên mục" onBlur={(e) => e.target.value.trim() ? patch(c.id, { name: e.target.value.trim() }) : (e.target.value = c.name)} />
            <input className="inp" style={{ height: 30 }} defaultValue={c.schedule || ''} placeholder="Lịch, vd Thứ 2, 09:00" aria-label="Lịch cố định" onBlur={(e) => patch(c.id, { schedule: e.target.value.trim() || undefined })} />
            <button className="btn ghost sm sq" aria-label={'Xóa ' + c.name} onClick={() => setAskDel(c.id)}><Icon name="trash" size={13} /></button>
            <input className="inp" style={{ height: 30 }} defaultValue={c.desc || ''} placeholder="Mô tả" aria-label="Mô tả" onBlur={(e) => patch(c.id, { desc: e.target.value.trim() || undefined })} />
            <input className="inp" style={{ height: 30 }} defaultValue={c.people || ''} placeholder="Người thường dự (tự điền khi tạo họp)" aria-label="Người thường dự" onBlur={(e) => patch(c.id, { people: e.target.value.trim() || undefined })} />
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="inp" style={{ height: 32, flex: 1 }} placeholder="Thêm mục họp… (Enter)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Thêm mục họp" />
        <button className="btn sm" onClick={add}><Icon name="plus" size={13} />Thêm</button>
      </div>
      {del ? <Confirm title={'Xóa mục “' + del.name + '”?'} danger okLabel="Xóa" onClose={() => setAskDel(null)}
        body={usedBy(del.id) ? usedBy(del.id) + ' cuộc họp trong mục này được giữ lại và chuyển sang “Chưa phân loại”.' : 'Mục chưa có cuộc họp nào.'}
        onOk={() => { save(cats.filter((c) => c.id !== del.id)); s.meetings.filter((m) => m.catId === del.id).forEach((m) => s.updateMeeting(m.id, { catId: undefined })); }} /> : null}
    </section>
  );
}
