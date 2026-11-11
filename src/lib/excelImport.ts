// Reads the "BAKit_du_lieu_ban_dau.xlsx" template and turns it into BAKit records.
// Parsing is pure (testable); applyImport() writes the result to the database.
import type { ChecklistDef, Color, Item, MeetingCat, Project, Settings, StatusDef, Task } from './types';
import { cloneLists, defaultLists, PROJECT_COLORS } from './templates';
import { normalize, uid } from './util';
import { addDays, fromKey, nowStamp, toIso, todayKey } from './dates';

export type Cell = string | number | boolean | Date | null | undefined;
export interface SheetIn { sheet: string; data: Cell[][] }

export interface ImportPlan {
  listTemplate?: ChecklistDef[];
  projects: Project[];
  items: Item[];
  tasks: Task[];
  people: string[];
  peopleInfo: Record<string, { role?: string; org?: string }>;
  meetingCats: MeetingCat[];
  settings: Partial<Settings>;
  replace: boolean;
  warnings: string[];
}

const N = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');

function str(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.getUTCFullYear() + '-' + pad(v.getUTCMonth() + 1) + '-' + pad(v.getUTCDate());
  return String(v).trim();
}
const yes = (v: Cell, dflt = false) => {
  const s = N(str(v));
  if (!s) return dflt;
  return ['co', 'x', 'yes', 'y', 'true', '1', 'v'].includes(s);
};

/** Excel date cell, serial number or text (dd/mm/yyyy, d/m/yy, yyyy-mm-dd) → YYYY-MM-DD. */
export function parseDate(v: Cell): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : str(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return str(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
  }
  return undefined;
}

/** "16:00", "16h", "16h30", Excel time fraction or time-formatted Date → HH:mm. */
export function parseTime(v: Cell): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date) return pad(v.getUTCHours()) + ':' + pad(v.getUTCMinutes());
  if (typeof v === 'number') {
    const mins = Math.round((v % 1) * 24 * 60);
    return pad(Math.floor(mins / 60) % 24) + ':' + pad(mins % 60);
  }
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h]\s*(\d{1,2})?)?$/);
  if (!m || +m[1] > 23) return undefined;
  return pad(+m[1]) + ':' + pad(m[2] ? +m[2] : 0);
}

const COLOR_NAMES: Record<string, Color> = {
  xam: 'gray', 'xanh duong': 'blue', 'xanh': 'blue', vang: 'amber', cam: 'amber', 'xanh la': 'green', do: 'red', tim: 'purple'
};

/** Rows under the header whose first cell starts with `firstHeader`; skips empty and "(VD)" example rows. */
function table(sheets: SheetIn[], sheetName: string, firstHeader: string): Cell[][] {
  const sh = sheets.find((x) => N(x.sheet) === N(sheetName)) || sheets.find((x) => N(x.sheet).includes(N(sheetName)));
  if (!sh) return [];
  const h = sh.data.findIndex((r) => N(str(r?.[0])).startsWith(N(firstHeader)));
  if (h < 0) return [];
  return sh.data.slice(h + 1).filter((r) => r && r.some((c) => str(c) !== '') && !/^\(\s*vd\s*\)/i.test(str(r[0])));
}

export function buildPlan(sheets: SheetIn[]): ImportPlan {
  const warnings: string[] = [];
  const st = (name: string, color: Color, done: boolean): StatusDef => ({ id: uid('s'), name, color, done });

  // ----- checklist types + statuses -----
  const typeRows = table(sheets, 'Loại checklist', 'Tên checklist');
  const statusRows = table(sheets, 'Trạng thái', 'Loại checklist');
  let listTemplate: ChecklistDef[] | undefined;
  if (typeRows.length) {
    const builtIn = defaultLists();
    listTemplate = typeRows.filter((r) => str(r[0])).map((r) => {
      const name = str(r[0]);
      const prefix = (str(r[1]) || name.replace(/[^A-Za-zÀ-ỹ]/g, '').slice(0, 1) || 'X').toUpperCase().slice(0, 4);
      const rows = statusRows.filter((s) => N(str(s[0])) === N(name) && str(s[2]))
        .sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
      let statuses = rows.map((s) => st(str(s[2]), COLOR_NAMES[N(str(s[3]))] || 'gray', yes(s[4])));
      if (!statuses.length) {
        statuses = builtIn.find((b) => N(b.name) === N(name))?.statuses.map((x) => ({ ...x, id: uid('s') }))
          || [st('Chưa làm', 'gray', false), st('Đang làm', 'blue', false), st('Xong', 'green', true)];
        warnings.push(`Checklist “${name}” chưa có trạng thái ở sheet Trạng thái — dùng trạng thái mặc định.`);
      } else if (!statuses.some((x) => x.done)) {
        warnings.push(`Checklist “${name}” không có trạng thái nào “Tính là xong” — dấu tick sẽ không dùng được.`);
      }
      return {
        id: uid('l'), name, prefix, catLabel: str(r[2]) || 'Phân loại', seq: 0, statuses,
        cols: { cat: true, owner: yes(r[3], true), due: yes(r[4], true), attach: yes(r[5], true), note: yes(r[6], false) }
      };
    });
    statusRows.forEach((s) => {
      if (str(s[0]) && !listTemplate!.some((l) => N(l.name) === N(str(s[0])))) warnings.push(`Trạng thái “${str(s[2])}” thuộc checklist “${str(s[0])}” không có ở sheet Loại checklist — bỏ qua.`);
    });
  }
  const template = listTemplate || defaultLists();

  // ----- projects -----
  const projects: Project[] = [];
  table(sheets, 'Dự án', 'Tên dự án').forEach((r, i) => {
    const name = str(r[0]);
    if (!name) return;
    if (projects.some((p) => N(p.name) === N(name))) { warnings.push(`Dự án “${name}” bị trùng — chỉ lấy dòng đầu.`); return; }
    const apply = str(r[5]);
    let defs = template;
    if (apply && N(apply) !== 'tat ca') {
      const raw = apply.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      const wanted = raw.map(N);
      defs = template.filter((l) => wanted.includes(N(l.name)));
      const missing = raw.filter((w) => !template.some((l) => N(l.name) === N(w)));
      if (missing.length) warnings.push(`Dự án “${name}”: không có loại checklist ${missing.join(', ')}.`);
      if (!defs.length) defs = template;
    }
    projects.push({
      id: uid('p'), name, short: str(r[1]).toUpperCase().slice(0, 3) || undefined, client: str(r[2]), phase: str(r[3]),
      pinned: yes(r[4], false), color: PROJECT_COLORS[i % PROJECT_COLORS.length], order: i, lists: cloneLists(defs),
      createdAt: new Date().toISOString()
    });
  });

  // ----- people, meeting categories -----
  const personRows = table(sheets, 'Người', 'Tên hiển thị').filter((r) => str(r[0]));
  const people = Array.from(new Set(personRows.map((r) => str(r[0]))));
  const peopleInfo: Record<string, { role?: string; org?: string }> = {};
  personRows.forEach((r) => { if (str(r[1]) || str(r[2])) peopleInfo[str(r[0])] = { role: str(r[1]) || undefined, org: str(r[2]) || undefined }; });
  const meetingCats: MeetingCat[] = table(sheets, 'Mục họp', 'Tên mục').filter((r) => str(r[0])).map((r) => ({
    id: uid('c'), name: str(r[0]), desc: str(r[1]) || undefined, schedule: str(r[2]) || undefined, people: str(r[3]) || undefined
  }));

  // ----- recurring tasks -----
  const REPEAT: Record<string, Task['repeat']> = { 'hang ngay': 'daily', 'hang tuan': 'weekly', 'hang thang': 'monthly', 'khong lap': 'none' };
  const REMIND: Record<string, number | null> = { 'khong nhac': null, 'dung gio': 0, '5 phut': 5, '15 phut': 15, '30 phut': 30, '1 gio': 60, '1 ngay': 1440 };
  const tasks: Task[] = [];
  table(sheets, 'Việc lặp lại', 'Tên việc').forEach((r) => {
    const title = str(r[0]);
    if (!title) return;
    const rep = N(str(r[1]));
    const repeat = REPEAT[rep] || (Object.entries(REPEAT).find(([k]) => rep.startsWith(k))?.[1]) || 'weekly';
    let date = parseDate(r[2]) || todayKey();
    // "Hằng tuần vào thứ 5" / "chủ nhật": move to the first such weekday from this week on.
    const wd = rep.match(/thu\s*([2-7])/) ? Number(rep.match(/thu\s*([2-7])/)![1]) - 1 : /chu nhat|\bcn\b/.test(rep) ? 0 : -1;
    if (repeat === 'weekly' && wd >= 0 && fromKey(date).getDay() !== wd) {
      const from = [addDays(date, -6), todayKey()].sort()[1];
      let d = from;
      for (let k = 0; k < 7 && fromKey(d).getDay() !== wd; k++) d = addDays(d, 1);
      warnings.push(`Việc “${title}”: ngày bắt đầu ${str(r[2])} không phải ${wd === 0 ? 'chủ nhật' : 'thứ ' + (wd + 1)} — đặt lần đầu vào ${d.slice(8, 10)}/${d.slice(5, 7)}.`);
      date = d;
    }
    if (r[2] && !parseDate(r[2])) warnings.push(`Việc “${title}”: không đọc được ngày “${str(r[2])}” — dùng hôm nay.`);
    const time = parseTime(r[3]);
    const rem = N(str(r[4]));
    const before = rem in REMIND ? REMIND[rem] : (time ? 0 : null);
    let remindAt: string | undefined;
    if (before !== null && before !== undefined) {
      const at = new Date(toIso(date, time || '09:00'));
      at.setMinutes(at.getMinutes() - before);
      remindAt = at.toISOString();
    }
    const note = [str(r[5]) ? 'Dự án: ' + str(r[5]) : '', str(r[6])].filter(Boolean).join('\n');
    tasks.push({ id: uid('t'), kind: 'task', title, date, time, repeat, remindAt, done: false, note: note || undefined, assetIds: [], createdAt: new Date().toISOString() });
  });

  // ----- checklist items -----
  const items: Item[] = [];
  table(sheets, 'Mục checklist', 'Dự án').forEach((r, idx) => {
    const pName = str(r[0]), lName = str(r[1]), title = str(r[2]);
    if (!title) return;
    const row = `Mục checklist dòng ${idx + 1} (“${title}”)`;
    const p = projects.find((x) => N(x.name) === N(pName));
    if (!p) { warnings.push(`${row}: không tìm thấy dự án “${pName}” ở sheet Dự án — bỏ qua.`); return; }
    const l = p.lists.find((x) => N(x.name) === N(lName));
    if (!l) { warnings.push(`${row}: dự án “${p.name}” không có checklist “${lName}” — bỏ qua.`); return; }
    const stName = str(r[4]);
    let status = stName ? l.statuses.find((x) => N(x.name) === N(stName)) : undefined;
    if (stName && !status) warnings.push(`${row}: trạng thái “${stName}” không có trong ${l.name} — đặt “${l.statuses[0]?.name}”.`);
    status = status || l.statuses[0];
    const due = parseDate(r[6]);
    if (str(r[6]) && !due) warnings.push(`${row}: không đọc được hạn “${str(r[6])}”.`);
    l.seq += 1;
    items.push({
      id: uid('i'), projectId: p.id, listId: l.id, code: l.prefix + '-' + String(l.seq).padStart(2, '0'), title,
      cat: str(r[3]), statusId: status?.id || '', owner: str(r[5]), due, workItem: str(r[7]), note: str(r[8]), assetIds: [],
      history: [{ t: nowStamp(), txt: 'Nhập từ Excel' }], createdAt: new Date().toISOString(),
      order: items.filter((x) => x.listId === l.id).length
    });
  });

  // ----- settings -----
  const settings: Partial<Settings> = {};
  let replace = true;
  const sh = sheets.find((x) => N(x.sheet).includes('cai dat'));
  for (const r of sh?.data || []) {
    const k = N(str(r?.[0])), v = str(r?.[1]);
    if (!k) continue;
    if (k.startsWith('link azure')) { if (v) settings.azureBase = v; }
    else if (k.startsWith('phim chup')) {
      if (v) settings.captureHotkey = v.replace(/⌘/g, 'CommandOrControl+').replace(/⇧/g, 'Shift+').replace(/⌥/g, 'Alt+').replace(/\bCtrl\b|\bCmd\b|\bCommand\b/gi, 'CommandOrControl').replace(/\s+/g, '');
    }
    else if (k.startsWith('dinh dang luu anh')) { const f = N(v); if (f === 'png' || f === 'jpg' || f === 'webp') settings.exportFormat = f; }
    else if (k.startsWith('giao dien')) { const t = N(v); settings.theme = t === 'sang' ? 'light' : t === 'toi' ? 'dark' : 'system'; }
    else if (k.startsWith('xoa du lieu mau')) replace = v ? yes(v) : true;
  }

  return { listTemplate, projects, items, tasks, people, peopleInfo, meetingCats, settings, replace, warnings };
}

export async function readWorkbook(file: Blob): Promise<SheetIn[]> {
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  return sheets.map((s) => ({ sheet: s.sheet, data: s.data as unknown as Cell[][] }));
}

/**
 * Write the plan.
 * - replace: projects, checklist items, tasks, day notes and meetings are cleared first (screenshots are kept).
 * - update (replace = false): matched by name — existing projects are updated and get the new items; checklist
 *   types missing in a project are added; people, meeting categories and recurring tasks are added if new.
 */
export async function applyImport(plan: ImportPlan): Promise<void> {
  const { getDb } = await import('./db');
  const { useStore } = await import('./store');
  const db = await getDb();
  const s = useStore.getState();
  const prev = s.settings;
  if (plan.replace) {
    for (const p of s.projects) await db.del('projects', p.id);
    for (const i of s.items) await db.del('items', i.id);
    for (const t of s.tasks) await db.del('tasks', t.id);
    for (const n of Object.values(s.notes)) await db.del('notes', n.id);
    for (const m of s.meetings) await db.del('meetings', m.id);
    for (const p of plan.projects) await db.put('projects', p.id, p);
    for (const i of plan.items) await db.put('items', i.id, i);
    for (const t of plan.tasks) await db.put('tasks', t.id, t);
  } else {
    let order = s.projects.length;
    for (const np of plan.projects) {
      const ex = s.projects.find((p) => N(p.name) === N(np.name));
      if (!ex) { np.order = order++; await db.put('projects', np.id, np); for (const i of plan.items.filter((x) => x.projectId === np.id)) await db.put('items', i.id, i); continue; }
      // Merge into the existing project: keep its ids, statuses and items.
      const lists = ex.lists.map((l) => ({ ...l }));
      for (const nl of np.lists) if (!lists.some((l) => N(l.name) === N(nl.name))) lists.push({ ...nl, seq: 0 });
      for (const it of plan.items.filter((x) => x.projectId === np.id)) {
        const nl = np.lists.find((l) => l.id === it.listId)!;
        const l = lists.find((x) => N(x.name) === N(nl.name))!;
        const stName = nl.statuses.find((x) => x.id === it.statusId)?.name || '';
        const st = l.statuses.find((x) => N(x.name) === N(stName)) || l.statuses[0];
        if (s.items.some((x) => x.projectId === ex.id && x.listId === l.id && N(x.title) === N(it.title))) continue; // already there
        l.seq += 1;
        const item = { ...it, projectId: ex.id, listId: l.id, statusId: st?.id || '', code: l.prefix + '-' + String(l.seq).padStart(2, '0') };
        await db.put('items', item.id, item);
      }
      const merged: Project = { ...ex, lists, client: np.client || ex.client, phase: np.phase || ex.phase, short: np.short || ex.short, pinned: np.pinned || ex.pinned };
      await db.put('projects', merged.id, merged);
    }
    for (const t of plan.tasks) if (!s.tasks.some((x) => N(x.title) === N(t.title) && !x.done)) await db.put('tasks', t.id, t);
  }
  const cats = plan.replace ? plan.meetingCats : [...(prev.meetingCats || []), ...plan.meetingCats.filter((c) => !(prev.meetingCats || []).some((x) => N(x.name) === N(c.name)))];
  const settings: Settings = {
    ...prev, ...plan.settings, seeded: true,
    people: plan.replace ? plan.people : Array.from(new Set([...prev.people, ...plan.people])),
    peopleInfo: { ...(plan.replace ? {} : prev.peopleInfo || {}), ...plan.peopleInfo },
    meetingCats: cats,
    listTemplate: plan.listTemplate || prev.listTemplate
  };
  await db.put('settings', 'settings', settings);
  await s.init();
}
