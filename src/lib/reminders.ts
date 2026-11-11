// In-app reminder loop: fires a Windows/browser notification when a task's reminder time arrives.
import { useStore } from './store';
import { notify } from './platform';
import { hhmm } from './dates';

let timer: ReturnType<typeof setInterval> | undefined;

function check() {
  const s = useStore.getState();
  const now = Date.now();
  for (const t of s.tasks) {
    if (t.done || t.reminded || !t.remindAt) continue;
    if (new Date(t.remindAt).getTime() > now) continue;
    s.updateTask(t.id, { reminded: true });
    const when = t.time ? ' · ' + t.time : '';
    notify('Nhắc việc' + when, t.title + (t.workItem ? ' · ' + t.workItem : '')).catch(() => undefined);
    s.showToast('Nhắc việc: ' + t.title + ' (' + hhmm(t.remindAt) + ')', 'info', {
      label: 'Nhắc lại 15 phút',
      run: () => s.updateTask(t.id, { reminded: false, remindAt: new Date(Date.now() + 15 * 60000).toISOString() })
    });
  }
}

export function startReminders() {
  clearInterval(timer);
  check();
  timer = setInterval(check, 30000);
}
