// Data model for BAKit. Every record is plain JSON so it can live in SQLite (Tauri) or IndexedDB (web).

export type Color = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple';

// ---------- Screenshots ----------
export type ToolId =
  | 'select' | 'arrow' | 'rect' | 'ellipse' | 'line' | 'text' | 'number'
  | 'crop' | 'erase' | 'cover' | 'blur' | 'redact';

interface ShapeBase { id: string; opacity?: number }
export interface LineShape extends ShapeBase { type: 'arrow' | 'line'; points: [number, number, number, number]; color: string; width: number; dash?: boolean }
export interface BoxShape extends ShapeBase { type: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; color: string; width: number; fill?: string; dash?: boolean }
export interface FillShape extends ShapeBase { type: 'cover' | 'redact'; x: number; y: number; w: number; h: number; fill: string }
export interface BlurShape extends ShapeBase { type: 'blur'; x: number; y: number; w: number; h: number; radius: number }
export interface TextShape extends ShapeBase { type: 'text'; x: number; y: number; text: string; color: string; size: number; bg?: string }
export interface NumberShape extends ShapeBase { type: 'number'; x: number; y: number; n: number; color: string; size: number }
export interface EraseShape extends ShapeBase { type: 'erase'; points: number[]; size: number }
export type Shape = LineShape | BoxShape | FillShape | BlurShape | TextShape | NumberShape | EraseShape;

export interface Crop { x: number; y: number; w: number; h: number }
export interface EditState { shapes: Shape[]; crop?: Crop }

export interface Asset {
  id: string;
  name: string;
  createdAt: string;           // ISO
  width: number;
  height: number;
  originalKey: string;         // immutable original PNG
  renderedKey?: string;        // last rendered working version
  edit: EditState;             // editable layers, re-openable
  note: string;
  workItem: string;            // Azure work item, e.g. #4521
  source: 'capture' | 'paste' | 'file';
}

// ---------- Day notes, tasks, events ----------
export interface DayNote { id: string; date: string; text: string } // id = date (YYYY-MM-DD)

export interface Task {
  id: string;
  kind: 'task' | 'event';
  title: string;
  date?: string;               // YYYY-MM-DD, undefined = no due date
  time?: string;               // HH:mm
  end?: string;                // HH:mm (events)
  done: boolean;
  remindAt?: string;           // ISO datetime
  reminded?: boolean;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  workItem?: string;
  note?: string;
  assetIds: string[];
  createdAt: string;
}

// ---------- Projects & checklists ----------
export interface StatusDef { id: string; name: string; color: Color; done: boolean }
export interface ChecklistDef {
  id: string;
  name: string;                // Tính năng, Issue, Vấn đề, Bug, Tài liệu…
  prefix: string;              // F, I, Q, B, D
  catLabel: string;            // Module, Ảnh hưởng, Hỏi ai, Env · Mức độ, Phiên bản
  statuses: StatusDef[];
  cols: { cat: boolean; owner: boolean; due: boolean; attach: boolean; note: boolean };
  seq: number;                 // last number used for codes
}
export interface Project {
  id: string;
  name: string;
  client: string;
  phase: string;
  color: string;               // hex
  pinned: boolean;
  order: number;
  lists: ChecklistDef[];
  createdAt: string;
  archived?: boolean;
  short?: string;              // 2–3 letter badge; defaults to initials of the name
}
export interface HistoryLine { t: string; txt: string }
export interface Item {
  id: string;
  projectId: string;
  listId: string;
  code: string;
  title: string;
  cat: string;
  statusId: string;
  owner: string;
  due?: string;                // YYYY-MM-DD
  note: string;
  assetIds: string[];
  workItem: string;
  history: HistoryLine[];
  createdAt: string;
  order: number;
}

// ---------- Meetings ----------
export interface MeetingCat { id: string; name: string; desc?: string; schedule?: string; people?: string }
export interface MeetingAction { id: string; text: string; owner: string; due?: string; done: boolean; taskId?: string }
export interface Meeting {
  id: string;
  title: string;
  date: string;                // YYYY-MM-DD
  time?: string;               // HH:mm
  end?: string;
  projectId?: string;          // belongs to a project…
  catId?: string;              // …or to a standalone category (Họp nội bộ, Daily…)
  attendees: string;           // comma separated names
  content: string;             // free notes / agenda / discussion
  decisions: string;           // kết luận
  actions: MeetingAction[];
  assetIds: string[];
  workItem?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Settings ----------
export interface Settings {
  id: 'settings';
  theme: 'system' | 'light' | 'dark';
  captureHotkey: string;       // e.g. CommandOrControl+Shift+S
  exportFormat: 'png' | 'jpg' | 'webp';
  people: string[];            // quick-pick owners
  peopleInfo?: Record<string, { role?: string; org?: string }>;
  seeded: boolean;
  sidebarCollapsed?: boolean;
  meetingCats?: MeetingCat[];
  azureBase?: string;
  listTemplate?: ChecklistDef[]; // checklist types/statuses new projects start with (from the Excel import)          // https://dev.azure.com/org/project → work items open in the browser
}

export type Collection = 'assets' | 'notes' | 'tasks' | 'projects' | 'items' | 'meetings' | 'settings';

export type View =
  | { name: 'today' }
  | { name: 'calendar'; mode?: 'week' | 'month'; date?: string }
  | { name: 'tasks'; taskId?: string }
  | { name: 'projects' }
  | { name: 'project'; projectId: string; listId?: string; itemId?: string }
  | { name: 'images'; assetId?: string }
  | { name: 'meetings'; group?: string; meetingId?: string }   // group: 'all' | 'p:<projectId>' | 'c:<catId>'
  | { name: 'settings' };
