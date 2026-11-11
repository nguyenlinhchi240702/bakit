import type { ChecklistDef, Color, StatusDef } from './types';
import { uid } from './util';

const st = (name: string, color: Color, done = false): StatusDef => ({ id: uid('s'), name, color, done });
const cols = { cat: true, owner: true, due: true, attach: true, note: false };

export function defaultLists(): ChecklistDef[] {
  return [
    { id: uid('l'), name: 'Tính năng', prefix: 'F', catLabel: 'Module', seq: 0, cols: { ...cols },
      statuses: [st('Chưa làm', 'gray'), st('Đang phân tích', 'blue'), st('Chờ khách duyệt', 'amber'), st('Đang dev', 'blue'), st('Đang test', 'purple'), st('Xong', 'green', true)] },
    { id: uid('l'), name: 'Issue', prefix: 'I', catLabel: 'Ảnh hưởng', seq: 0, cols: { ...cols },
      statuses: [st('Mới', 'red'), st('Đang xử lý', 'blue'), st('Chờ bên khác', 'amber'), st('Đã giải quyết', 'green', true)] },
    { id: uid('l'), name: 'Vấn đề', prefix: 'Q', catLabel: 'Hỏi ai', seq: 0, cols: { ...cols },
      statuses: [st('Chờ trả lời', 'amber'), st('Đã trả lời', 'blue'), st('Đã chốt', 'green', true), st('Hủy', 'gray', true)] },
    { id: uid('l'), name: 'Bug', prefix: 'B', catLabel: 'Env · Mức độ', seq: 0, cols: { ...cols },
      statuses: [st('Mở', 'red'), st('Đang sửa', 'blue'), st('Chờ retest', 'amber'), st('Đã đóng', 'green', true), st('Reopen', 'red')] },
    { id: uid('l'), name: 'Tài liệu', prefix: 'D', catLabel: 'Phiên bản', seq: 0, cols: { ...cols },
      statuses: [st('Chưa có', 'gray'), st('Đang viết', 'blue'), st('Chờ review', 'amber'), st('Đã gửi khách', 'purple'), st('Đã duyệt / ký', 'green', true)] }
  ];
}

export function customList(name: string, prefix: string): ChecklistDef {
  return {
    id: uid('l'), name, prefix: prefix.toUpperCase().slice(0, 3) || 'X', catLabel: 'Phân loại', seq: 0, cols: { ...cols },
    statuses: [st('Chưa làm', 'gray'), st('Đang làm', 'blue'), st('Xong', 'green', true)]
  };
}

export const COLOR_STYLE: Record<Color, { bg: string; fg: string }> = {
  gray: { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
  blue: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
  amber: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  green: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  red: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)' }
};
export const COLORS: Color[] = ['gray', 'blue', 'amber', 'green', 'red', 'purple'];
export const PROJECT_COLORS = ['#2B5BE3', '#B45309', '#16733F', '#7C3AED', '#C42F33', '#0E7490'];
