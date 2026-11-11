// Sample data for the first run so every screen has something to show. Cài đặt › "Xóa toàn bộ dữ liệu" removes it.
import { useStore } from './store';
import { addDays, toIso, todayKey } from './dates';

export function seedDemo() {
  const s = useStore.getState();
  const T = todayKey();
  const d = (n: number) => addDays(T, n);

  s.saveSettings({ people: ['Linh Chi', 'Khoa', 'Bình', 'Huy', 'Hà'] });

  const p1 = s.addProject({ name: 'Becamex AI', client: 'Becamex IDC', phase: 'UAT vòng 3', color: '#2B5BE3', pinned: true, order: 0 });
  const p2 = s.addProject({ name: 'Cổng khách hàng B2B', client: 'Khối Kinh doanh', phase: 'Phân tích yêu cầu', color: '#B45309', pinned: true, order: 1 });
  s.addProject({ name: 'App chấm công', client: 'Phòng Nhân sự', phase: 'Bảo trì', color: '#16733F', pinned: false, order: 2 });

  const add =(listIdx: number, title: string, cat: string, statusIdx: number, owner: string, due: number | null, note = '', workItem = '') => {
    const proj = useStore.getState().projects.find((p) => p.id === p1.id)!;
    const list = proj.lists[listIdx];
    s.addItem(p1.id, list.id, title, { cat, statusId: list.statuses[statusIdx].id, owner, due: due === null ? undefined : d(due), note, workItem });
  };
  add(0, 'Đăng nhập SSO', 'Hệ thống', 5, 'Huy', -15, 'Đã nghiệm thu UAT vòng 1');
  add(0, 'Danh sách tài liệu + tìm kiếm', 'Quản trị tài liệu', 4, 'Bình', -1, 'Còn bug nhãn nút');
  add(0, 'Cập nhật trạng thái tài liệu', 'Quản trị tài liệu', 3, 'Khoa', 3, 'Đang sửa lỗi không cập nhật sau khi lưu', '#4521');
  add(0, 'Lọc danh sách theo phòng ban', 'Quản trị tài liệu', 2, 'Linh Chi', -3, 'Đã gửi mockup v2, chưa phản hồi');
  add(0, 'Xuất báo cáo tuần (PDF)', 'Báo cáo', 1, 'Linh Chi', 6, 'Đã chốt định dạng PDF');
  add(0, 'Phân quyền theo vai trò', 'Phân quyền', 0, 'Linh Chi', 11, 'Chờ danh sách vai trò từ khách');
  add(1, 'Chưa có tài khoản UAT cho Phòng Pháp chế', 'UAT vòng 3', 2, 'Huy', 1, 'Đã gửi yêu cầu IT khách');
  add(1, 'Thiếu dữ liệu mẫu trên 5.000 dòng', 'Test báo cáo', 1, 'Khoa', 2);
  add(1, 'Chưa có template báo cáo chuẩn của khách', 'Báo cáo tuần', 0, 'Linh Chi', -2, 'Nhắc lại trong buổi demo');
  add(2, 'Tài liệu “Đang rà soát” có cho sửa nội dung không?', 'Phòng Pháp chế', 0, 'Linh Chi', -1, 'Đã hỏi qua email');
  add(2, 'Báo cáo tuần chốt vào thứ mấy?', 'Phòng Pháp chế', 1, 'Linh Chi', null, 'Trả lời: thứ Sáu 16:00');
  add(2, 'Có cần duyệt 2 cấp khi ban hành?', 'PM khách hàng', 0, 'Linh Chi', 3);
  add(3, 'Không cập nhật ngay sau khi lưu', 'UAT · Cao', 1, 'Khoa', 3, 'Phải F5 mới thấy giá trị mới', '#4521');
  add(3, 'Lỗi 500 khi xuất báo cáo trên 5.000 dòng', 'MIG · Cao', 2, 'Khoa', 0, 'Đã fix — retest hôm nay', '#4498');
  add(3, 'Nhãn nút “Lưu nháp” bị cắt ở 1280px', 'UAT · Thấp', 0, 'Bình', 5, '', '#4503');
  add(3, 'Sai định dạng ngày trên danh sách', 'UAT · Trung bình', 3, 'Bình', null, '', '#4480');
  add(4, 'SRS Becamex AI', 'v1.3', 1, 'Linh Chi', 2, 'Bổ sung mục phân quyền');
  add(4, 'Biên bản UAT vòng 2', 'v1.0', 4, 'Linh Chi', -3, 'Khách đã ký');
  add(4, 'Kịch bản UAT vòng 3', 'v0.9', 2, 'Bình', 1, 'Chờ review 46 test case');
  add(4, 'Biên bản demo', '—', 0, 'Linh Chi', 1);

  const q2 = useStore.getState().projects.find((p) => p.id === p2.id)!.lists[2];
  s.addItem(p2.id, q2.id, 'Đại lý cấp 2 có được xem công nợ không?', { cat: 'Khối Kinh doanh', owner: 'Linh Chi', due: d(2) });
  s.addItem(p2.id, q2.id, 'Đăng nhập bằng mã số thuế hay email?', { cat: 'IT khách hàng', owner: 'Linh Chi' });

  s.addTask({ kind: 'task', title: 'Gửi evidence UAT vòng 2 cho khách', date: d(-3), workItem: '#4521' });
  s.addTask({ kind: 'event', title: 'Daily standup', date: T, time: '09:00', end: '09:15', repeat: 'daily' });
  s.addTask({ kind: 'task', title: 'Retest lỗi lưu danh sách trên UAT', date: T, time: '10:00', workItem: '#4521', remindAt: toIso(T, '09:45') });
  s.addTask({ kind: 'event', title: 'Demo Becamex AI với Phòng Pháp chế', date: T, time: '14:00', end: '15:00' });
  s.addTask({ kind: 'task', title: 'Viết test case luồng phê duyệt', date: T });
  s.addTask({ kind: 'event', title: 'Họp chốt phạm vi', date: d(1), time: '15:00' });
  s.addTask({ kind: 'task', title: 'Gửi biên bản demo', date: d(1), remindAt: toIso(d(1), '08:30') });
  s.addTask({ kind: 'event', title: 'UAT vòng 3', date: d(3), time: '09:30' });
  s.addTask({ kind: 'task', title: 'Báo cáo tuần', date: d(4), time: '16:00', repeat: 'weekly' });
  s.addTask({ kind: 'task', title: 'Tìm hiểu query Azure DevOps cho bug UAT' });

  s.setDayNote(T, '• Bản mới đã sửa lỗi lưu danh sách (#4521) — cần retest thêm trường hợp đổi Ngày hiệu lực.\n• Khách muốn lọc theo phòng ban → hỏi dev có vào sprint này không.\n\n(Đây là dữ liệu mẫu — xóa trong Cài đặt.)');
}
