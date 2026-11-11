import type { ChecklistDef, Item, Project, StatusDef, Task } from './types';
import { todayKey } from './dates';

export function listOf(projects: Project[], it: Item): ChecklistDef | undefined {
  return projects.find((p) => p.id === it.projectId)?.lists.find((l) => l.id === it.listId);
}
export function statusOf(list: ChecklistDef | undefined, it: Item): StatusDef | undefined {
  return list?.statuses.find((s) => s.id === it.statusId);
}
export function itemDone(projects: Project[], it: Item): boolean {
  return !!statusOf(listOf(projects, it), it)?.done;
}
export function itemLate(projects: Project[], it: Item, today = todayKey()): boolean {
  return !!it.due && it.due < today && !itemDone(projects, it);
}
export function taskLate(t: Task, today = todayKey()): boolean {
  return t.kind === 'task' && !t.done && !!t.date && t.date < today;
}
export function overdueCount(tasks: Task[], items: Item[], projects: Project[]): number {
  const t = todayKey();
  return tasks.filter((x) => taskLate(x, t)).length + items.filter((x) => itemLate(projects, x, t)).length;
}
/** Checklist items with a due date — shown alongside tasks in Hôm nay and Lịch. */
export interface DueEntry { kind: 'item'; item: Item; project: Project; list: ChecklistDef; done: boolean }
export function dueItems(projects: Project[], items: Item[]): DueEntry[] {
  const out: DueEntry[] = [];
  for (const it of items) {
    if (!it.due) continue;
    const project = projects.find((p) => p.id === it.projectId);
    const list = project?.lists.find((l) => l.id === it.listId);
    if (!project || !list || project.archived) continue;
    out.push({ kind: 'item', item: it, project, list, done: !!list.statuses.find((s) => s.id === it.statusId)?.done });
  }
  return out;
}
export const byTime = (a: { time?: string }, b: { time?: string }) => (a.time || '99').localeCompare(b.time || '99');
