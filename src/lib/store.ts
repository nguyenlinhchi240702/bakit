import { create } from 'zustand';
import type { Asset, ChecklistDef, Collection, DayNote, Item, Meeting, Project, Settings, Task, View } from './types';
import { getDb, forgetBlobUrl } from './db';
import { uid } from './util';
import { addDays, addMonths, fileStamp, nowStamp, todayKey } from './dates';
import type { ScreenShot } from './platform';
import { startingLists } from './templates';

export interface ToastAction { label: string; run: () => void }
export interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info'; action?: ToastAction }

const DEFAULT_SETTINGS: Settings = {
  id: 'settings', theme: 'system', captureHotkey: 'CommandOrControl+Shift+S', exportFormat: 'png', people: [], seeded: false
};

interface State {
  ready: boolean;
  fatal?: string;
  settings: Settings;
  assets: Asset[];
  notes: Record<string, DayNote>;
  tasks: Task[];
  projects: Project[];
  items: Item[];
  meetings: Meeting[];
  view: View;
  toast: Toast | null;
  webShots: ScreenShot[] | null;       // in-page capture overlay (browser demo)
  captureTarget: { kind: 'item' | 'task' | 'meeting'; id: string } | null;
  update: { version: string; current: string; notes?: string } | null; // newer version available (desktop) // attach next capture to this record

  init(): Promise<void>;
  go(v: View): void;
  showToast(text: string, kind?: Toast['kind'], action?: ToastAction): void;
  hideToast(): void;
  saveSettings(patch: Partial<Settings>): void;

  addImage(blob: Blob, source: Asset['source'], name?: string): Promise<Asset>;
  updateAsset(id: string, patch: Partial<Asset>): void;
  setRendered(id: string, blob: Blob): Promise<void>;
  deleteAsset(id: string): Promise<boolean>;
  assetRefs(id: string): string[];

  setDayNote(date: string, text: string): void;

  addTask(t: Partial<Task> & { title: string }): Task;
  updateTask(id: string, patch: Partial<Task>, toast?: string): void;
  toggleTask(id: string): void;
  deleteTask(id: string): void;

  addProject(p: Partial<Project> & { name: string }): Project;
  updateProject(id: string, patch: Partial<Project>): void;
  deleteProject(id: string): void;
  togglePin(id: string): void;
  updateList(projectId: string, listId: string, patch: Partial<ChecklistDef>): void;
  addList(projectId: string, def: ChecklistDef): void;
  deleteList(projectId: string, listId: string): void;

  addItem(projectId: string, listId: string, title: string, extra?: Partial<Item>): Item | undefined;
  updateItem(id: string, patch: Partial<Item>, historyText?: string): void;
  setItemStatus(id: string, statusId: string): void;
  tickItem(id: string): void;
  deleteItem(id: string): void;
  attachAssetToItem(itemId: string, assetId: string): void;
  attachAssetToTask(taskId: string, assetId: string): void;

  addMeeting(m: Partial<Meeting>): Meeting;
  updateMeeting(id: string, patch: Partial<Meeting>): void;
  deleteMeeting(id: string): void;
  attachAssetToMeeting(id: string, assetId: string): void;

  resetAll(): Promise<void>;
  importData(data: BackupData, blobs: Record<string, Blob>): Promise<void>;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  settings: Settings;
  assets: Asset[];
  notes: DayNote[];
  tasks: Task[];
  projects: Project[];
  items: Item[];
  meetings?: Meeting[];
}

function persist(col: Collection, rec: { id: string }) {
  getDb().then((db) => db.put(col, rec.id, rec)).catch((e) => useStore.getState().showToast('Lỗi lưu dữ liệu: ' + String(e), 'err'));
}
function remove(col: Collection, id: string) {
  getDb().then((db) => db.del(col, id)).catch((e) => useStore.getState().showToast('Lỗi xóa dữ liệu: ' + String(e), 'err'));
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

async function toPng(blob: Blob): Promise<{ png: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(blob);
  const { width, height } = bmp;
  if (blob.type === 'image/png') {
    bmp.close();
    return { png: blob, width, height };
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const png = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  return { png, width, height };
}

function nextRepeat(t: Task): string | undefined {
  if (!t.date || !t.repeat || t.repeat === 'none') return undefined;
  if (t.repeat === 'daily') return addDays(t.date, 1);
  if (t.repeat === 'weekly') return addDays(t.date, 7);
  return addMonths(t.date, 1);
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  assets: [],
  notes: {},
  tasks: [],
  projects: [],
  items: [],
  meetings: [],
  view: { name: 'today' },
  toast: null,
  webShots: null,
  captureTarget: null,
  update: null,

  async init() {
    try {
      const db = await getDb();
      const [settingsArr, assets, notes, tasks, projects, items, meetings] = await Promise.all([
        db.all<Settings>('settings'), db.all<Asset>('assets'), db.all<DayNote>('notes'),
        db.all<Task>('tasks'), db.all<Project>('projects'), db.all<Item>('items'), db.all<Meeting>('meetings')
      ]);
      const settings = { ...DEFAULT_SETTINGS, ...(settingsArr[0] || {}) };
      const noteMap: Record<string, DayNote> = {};
      notes.forEach((n) => (noteMap[n.id] = n));
      set({
        settings,
        assets: assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        notes: noteMap, tasks, projects: projects.sort((a, b) => a.order - b.order), items, meetings, ready: true
      });
      // Fresh installs start empty: data comes from the Excel template (Cài đặt → Nhập từ Excel)
      // or the optional demo set.
      if (!settings.seeded) get().saveSettings({ seeded: true });
    } catch (e) {
      set({ fatal: 'Không mở được dữ liệu: ' + String(e), ready: true });
    }
  },

  go(v) {
    set({ view: v });
  },

  showToast(text, kind = 'ok', action) {
    clearTimeout(toastTimer);
    const id = ++toastSeq;
    set({ toast: { id, text, kind, action } });
    toastTimer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, action ? 6000 : 3200);
  },
  hideToast() {
    set({ toast: null });
  },

  saveSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    persist('settings', settings);
  },

  // ---------- Images ----------
  async addImage(blob, source, name) {
    const { png, width, height } = await toPng(blob);
    const id = uid('a');
    const key = id + '_o';
    await (await getDb()).putBlob(key, png);
    let base = name || 'Capture_' + fileStamp();
    const names = new Set(get().assets.map((a) => a.name));
    let n = 2;
    while (names.has(base)) base = (name || 'Capture_' + fileStamp()) + '-' + n++;
    const asset: Asset = {
      id, name: base, createdAt: new Date().toISOString(), width, height, originalKey: key,
      edit: { shapes: [] }, note: '', workItem: '', source
    };
    set({ assets: [asset, ...get().assets] });
    persist('assets', asset);
    return asset;
  },
  updateAsset(id, patch) {
    let next: Asset | undefined;
    set({ assets: get().assets.map((a) => (a.id === id ? (next = { ...a, ...patch }) : a)) });
    if (next) persist('assets', next);
  },
  async setRendered(id, blob) {
    const key = id + '_r';
    await (await getDb()).putBlob(key, blob);
    forgetBlobUrl(key);
    get().updateAsset(id, { renderedKey: key });
  },
  assetRefs(id) {
    const refs: string[] = [];
    get().items.forEach((i) => i.assetIds.includes(id) && refs.push(i.code));
    get().tasks.forEach((t) => t.assetIds.includes(id) && refs.push(t.title));
    get().meetings.forEach((m) => m.assetIds.includes(id) && refs.push('Họp: ' + m.title));
    return refs;
  },
  async deleteAsset(id) {
    if (get().assetRefs(id).length) return false;
    const a = get().assets.find((x) => x.id === id);
    if (!a) return false;
    const db = await getDb();
    await db.delBlob(a.originalKey);
    if (a.renderedKey) await db.delBlob(a.renderedKey);
    forgetBlobUrl(a.originalKey);
    if (a.renderedKey) forgetBlobUrl(a.renderedKey);
    set({ assets: get().assets.filter((x) => x.id !== id) });
    remove('assets', id);
    return true;
  },

  // ---------- Day notes ----------
  setDayNote(date, text) {
    const note = { id: date, date, text };
    set({ notes: { ...get().notes, [date]: note } });
    persist('notes', note);
  },

  // ---------- Tasks ----------
  addTask(t) {
    const task: Task = { kind: 'task', done: false, assetIds: [], createdAt: new Date().toISOString(), ...t, id: uid('t') };
    set({ tasks: [...get().tasks, task] });
    persist('tasks', task);
    return task;
  },
  updateTask(id, patch, toast) {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch };
    set({ tasks: get().tasks.map((t) => (t.id === id ? next : t)) });
    persist('tasks', next);
    if (toast) get().showToast(toast, 'ok', { label: 'Hoàn tác', run: () => { set({ tasks: get().tasks.map((t) => (t.id === id ? prev : t)) }); persist('tasks', prev); } });
  },
  toggleTask(id) {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    const done = !t.done;
    get().updateTask(id, { done }, done ? 'Đã xong: ' + t.title : undefined);
    const nextDate = done ? nextRepeat(t) : undefined;
    if (nextDate) {
      // Keep the same reminder offset on the next occurrence.
      let remindAt: string | undefined;
      if (t.remindAt && t.date) {
        const shift = new Date(nextDate + 'T00:00:00').getTime() - new Date(t.date + 'T00:00:00').getTime();
        remindAt = new Date(new Date(t.remindAt).getTime() + shift).toISOString();
      }
      get().addTask({ ...t, date: nextDate, done: false, reminded: false, remindAt, title: t.title });
    }
  },
  deleteTask(id) {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) return;
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
    remove('tasks', id);
    get().showToast('Đã xóa “' + prev.title + '”', 'ok', { label: 'Hoàn tác', run: () => { set({ tasks: [...get().tasks, prev] }); persist('tasks', prev); } });
  },

  // ---------- Projects ----------
  addProject(p) {
    const project: Project = {
      client: '', phase: '', color: '#2B5BE3', pinned: true, order: get().projects.length, lists: startingLists(get().settings.listTemplate),
      createdAt: new Date().toISOString(), ...p, id: uid('p')
    };
    set({ projects: [...get().projects, project] });
    persist('projects', project);
    return project;
  },
  updateProject(id, patch) {
    let next: Project | undefined;
    set({ projects: get().projects.map((p) => (p.id === id ? (next = { ...p, ...patch }) : p)) });
    if (next) persist('projects', next);
  },
  deleteProject(id) {
    const items = get().items.filter((i) => i.projectId === id);
    set({ projects: get().projects.filter((p) => p.id !== id), items: get().items.filter((i) => i.projectId !== id) });
    remove('projects', id);
    items.forEach((i) => remove('items', i.id));
  },
  togglePin(id) {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    get().updateProject(id, { pinned: !p.pinned });
    get().showToast(p.pinned ? 'Đã bỏ ghim ' + p.name : 'Đã ghim ' + p.name + ' ra menu trái');
  },
  updateList(projectId, listId, patch) {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return;
    get().updateProject(projectId, { lists: p.lists.map((l) => (l.id === listId ? { ...l, ...patch } : l)) });
  },
  addList(projectId, def) {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return;
    get().updateProject(projectId, { lists: [...p.lists, def] });
  },
  deleteList(projectId, listId) {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return;
    const items = get().items.filter((i) => i.listId === listId);
    get().updateProject(projectId, { lists: p.lists.filter((l) => l.id !== listId) });
    set({ items: get().items.filter((i) => i.listId !== listId) });
    items.forEach((i) => remove('items', i.id));
  },

  // ---------- Checklist items ----------
  addItem(projectId, listId, title, extra) {
    const p = get().projects.find((x) => x.id === projectId);
    const list = p?.lists.find((l) => l.id === listId);
    if (!p || !list) return undefined;
    const seq = list.seq + 1;
    get().updateList(projectId, listId, { seq });
    const item: Item = {
      id: uid('i'), projectId, listId, code: list.prefix + '-' + String(seq).padStart(2, '0'), title, cat: '',
      statusId: list.statuses[0]?.id || '', owner: '', note: '', assetIds: [], workItem: '',
      history: [{ t: nowStamp(), txt: 'Tạo mục' }], createdAt: new Date().toISOString(),
      order: get().items.filter((i) => i.listId === listId).length, ...extra
    };
    set({ items: [...get().items, item] });
    persist('items', item);
    return item;
  },
  updateItem(id, patch, historyText) {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;
    const next: Item = { ...prev, ...patch };
    if (historyText) next.history = [{ t: nowStamp(), txt: historyText }, ...prev.history].slice(0, 50);
    set({ items: get().items.map((i) => (i.id === id ? next : i)) });
    persist('items', next);
  },
  setItemStatus(id, statusId) {
    const it = get().items.find((i) => i.id === id);
    const list = it && get().projects.find((p) => p.id === it.projectId)?.lists.find((l) => l.id === it.listId);
    if (!it || !list || it.statusId === statusId) return;
    const from = list.statuses.find((s) => s.id === it.statusId)?.name || '—';
    const to = list.statuses.find((s) => s.id === statusId)?.name || '—';
    const prev = it;
    get().updateItem(id, { statusId }, from + ' → ' + to);
    get().showToast(it.code + ': ' + from + ' → ' + to, 'ok', { label: 'Hoàn tác', run: () => { set({ items: get().items.map((i) => (i.id === id ? prev : i)) }); persist('items', prev); } });
  },
  tickItem(id) {
    const it = get().items.find((i) => i.id === id);
    const list = it && get().projects.find((p) => p.id === it.projectId)?.lists.find((l) => l.id === it.listId);
    if (!it || !list) return;
    const cur = list.statuses.find((s) => s.id === it.statusId);
    const target = cur?.done ? list.statuses.find((s) => !s.done) : list.statuses.find((s) => s.done);
    if (target) get().setItemStatus(id, target.id);
  },
  deleteItem(id) {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;
    set({ items: get().items.filter((i) => i.id !== id) });
    remove('items', id);
    get().showToast('Đã xóa ' + prev.code, 'ok', { label: 'Hoàn tác', run: () => { set({ items: [...get().items, prev] }); persist('items', prev); } });
  },
  attachAssetToItem(itemId, assetId) {
    const it = get().items.find((i) => i.id === itemId);
    if (!it || it.assetIds.includes(assetId)) return;
    get().updateItem(itemId, { assetIds: [...it.assetIds, assetId] }, 'Thêm 1 ảnh');
  },
  attachAssetToTask(taskId, assetId) {
    const t = get().tasks.find((x) => x.id === taskId);
    if (!t || t.assetIds.includes(assetId)) return;
    get().updateTask(taskId, { assetIds: [...t.assetIds, assetId] });
  },

  // ---------- Meetings ----------
  addMeeting(m) {
    const now = new Date().toISOString();
    const meeting: Meeting = {
      title: '', date: todayKey(), attendees: '', content: '', decisions: '', actions: [], assetIds: [],
      createdAt: now, updatedAt: now, ...m, id: uid('m')
    };
    set({ meetings: [meeting, ...get().meetings] });
    persist('meetings', meeting);
    return meeting;
  },
  updateMeeting(id, patch) {
    let next: Meeting | undefined;
    set({ meetings: get().meetings.map((m) => (m.id === id ? (next = { ...m, ...patch, updatedAt: new Date().toISOString() }) : m)) });
    if (next) persist('meetings', next);
  },
  deleteMeeting(id) {
    const prev = get().meetings.find((m) => m.id === id);
    if (!prev) return;
    set({ meetings: get().meetings.filter((m) => m.id !== id) });
    remove('meetings', id);
    get().showToast('Đã xóa ghi chú họp “' + (prev.title || 'Không tên') + '”', 'ok', { label: 'Hoàn tác', run: () => { set({ meetings: [prev, ...get().meetings] }); persist('meetings', prev); } });
  },
  attachAssetToMeeting(id, assetId) {
    const m = get().meetings.find((x) => x.id === id);
    if (!m || m.assetIds.includes(assetId)) return;
    get().updateMeeting(id, { assetIds: [...m.assetIds, assetId] });
  },

  async resetAll() {
    await (await getDb()).clearAll();
    set({ assets: [], notes: {}, tasks: [], projects: [], items: [], meetings: [], view: { name: 'today' } });
    const settings = { ...get().settings, seeded: true };
    set({ settings });
    persist('settings', settings);
  },

  async importData(data, blobs) {
    const db = await getDb();
    await db.clearAll();
    for (const [k, b] of Object.entries(blobs)) await db.putBlob(k, b);
    const all: Array<[Collection, { id: string }[]]> = [
      ['assets', data.assets], ['notes', data.notes], ['tasks', data.tasks], ['projects', data.projects], ['items', data.items], ['meetings', data.meetings || []], ['settings', [data.settings]]
    ];
    for (const [col, rows] of all) for (const r of rows) await db.put(col, r.id, r);
    await get().init();
  }
}));

export const today = todayKey;
