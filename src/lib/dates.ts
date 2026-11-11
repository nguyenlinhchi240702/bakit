// Local-date helpers. Dates are stored as 'YYYY-MM-DD' strings in the user's local time zone.

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function toKey(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayKey(): string {
  return toKey(new Date());
}
export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
export function addMonths(key: string, n: number): string {
  const d = fromKey(key);
  d.setMonth(d.getMonth() + n);
  return toKey(d);
}
/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const d = fromKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(key, -dow);
}
export function monthGridStart(key: string): string {
  const d = fromKey(key);
  return weekStart(toKey(new Date(d.getFullYear(), d.getMonth(), 1)));
}
export const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const DOW_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function dow(key: string): number {
  return fromKey(key).getDay();
}
export function ddmm(key?: string): string {
  if (!key) return '—';
  return key.slice(8, 10) + '/' + key.slice(5, 7);
}
export function ddmmyyyy(key: string): string {
  return ddmm(key) + '/' + key.slice(0, 4);
}
export function longDate(key: string): string {
  return DOW_LONG[dow(key)] + ' · ' + ddmmyyyy(key);
}
export function shortDay(key: string): string {
  return DOW_SHORT[dow(key)] + ' ' + ddmm(key);
}
export function relDay(key: string | undefined): string {
  if (!key) return 'Chưa có hạn';
  const t = todayKey();
  if (key === t) return 'Hôm nay';
  if (key === addDays(t, 1)) return 'Ngày mai';
  if (key === addDays(t, -1)) return 'Hôm qua';
  return shortDay(key);
}
export function monthTitle(key: string): string {
  const d = fromKey(key);
  return 'Tháng ' + (d.getMonth() + 1) + ', ' + d.getFullYear();
}
export function nowStamp(): string {
  const d = new Date();
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
export function hhmm(iso: string): string {
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
/** Combine a date key and HH:mm into an ISO datetime in local time. */
export function toIso(key: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = fromKey(key);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}
export function fileStamp(d = new Date()): string {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
