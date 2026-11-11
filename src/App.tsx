import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { isTauri, registerHotkey } from './lib/platform';
import { cancelWebCapture, finishWebCapture, listenOverlayEvents, startCapture } from './lib/capture';
import { startReminders } from './lib/reminders';
import { imagesFromClipboard, routeImages } from './lib/paste';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ToastHost } from './components/ui';
import { CaptureOverlay } from './components/CaptureOverlay';
import { TodayView } from './views/TodayView';
import { CalendarView } from './views/CalendarView';
import { TasksView } from './views/TasksView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectView } from './views/ProjectView';
import { ImagesView } from './views/ImagesView';
import { SettingsView } from './views/SettingsView';

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => setSysDark(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const dark = theme === 'dark' || (theme === 'system' && sysDark);
  useEffect(() => {
    document.body.style.background = dark ? '#15171B' : '#F3F4F6';
  }, [dark]);
  return dark;
}

export default function App() {
  const { ready, fatal, view, webShots, init } = useStore();
  const hotkey = useStore((s) => s.settings.captureHotkey);
  const dark = useTheme();
  const [dragging, setDragging] = useState(false);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (!ready) return;
    startReminders();
    listenOverlayEvents();
  }, [ready]);

  useEffect(() => {
    if (!ready || !isTauri) return;
    registerHotkey(hotkey, () => startCapture()).then((ok) => {
      if (!ok) useStore.getState().showToast('Phím tắt ' + hotkey + ' đang bị ứng dụng khác dùng — đổi trong Cài đặt', 'err');
    });
  }, [ready, hotkey]);

  // Global keyboard, paste and drag-drop.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (!isTauri && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); startCapture(); }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n' && !typing) { e.preventDefault(); useStore.getState().go({ name: 'today' }); setTimeout(() => window.dispatchEvent(new Event('bakit:new-task')), 50); }
    };
    const paste = (e: ClipboardEvent) => {
      const imgs = imagesFromClipboard(e);
      if (!imgs.length) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        // The editor pastes copied annotations itself; elsewhere tell the user the clipboard has no image.
        if (useStore.getState().view.name === 'images') window.dispatchEvent(new Event('bakit:paste-shapes'));
        else useStore.getState().showToast('Clipboard chưa có hình ảnh', 'err');
        return;
      }
      e.preventDefault();
      routeImages(imgs, 'paste');
    };
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setDragging(true); }
    };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false); };
    const drop = (e: DragEvent) => {
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      if (!files.length) { useStore.getState().showToast('Chỉ nhận file ảnh (PNG, JPG, WebP, BMP)', 'err'); return; }
      routeImages(files, 'file', files.map((f) => f.name.replace(/\.[^.]+$/, '')));
    };
    window.addEventListener('keydown', key);
    window.addEventListener('paste', paste);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!ready) return <div className={'bk' + (dark ? ' dark' : '')} style={{ height: '100%', display: 'grid', placeItems: 'center' }}><span className="muted">Đang mở BAKit…</span></div>;
  if (fatal) return <div className="bk" style={{ padding: 40 }}><div className="banner err">{fatal}</div></div>;

  let page;
  switch (view.name) {
    case 'today': page = <TodayView />; break;
    case 'calendar': page = <CalendarView mode={view.mode || 'week'} />; break;
    case 'tasks': page = <TasksView />; break;
    case 'projects': page = <ProjectsView />; break;
    case 'project': page = <ProjectView key={view.projectId} projectId={view.projectId} listId={view.listId} />; break;
    case 'images': page = <ImagesView assetId={view.assetId} />; break;
    case 'settings': page = <SettingsView />; break;
  }

  return (
    <div className={'bk app' + (dark ? ' dark' : '')}>
      <Topbar />
      <div className="body">
        <Sidebar />
        <div className="main">{page}</div>
      </div>
      {dragging ? (
        <div style={{ position: 'fixed', inset: 12, border: '2px dashed var(--accent)', borderRadius: 14, background: 'rgba(43,91,227,.08)', zIndex: 80, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <b style={{ fontSize: 18, color: 'var(--accent-text)' }}>Thả ảnh vào đây</b>
        </div>
      ) : null}
      {webShots && webShots[0] ? (
        <CaptureOverlay shot={webShots[0]} onDone={(r) => finishWebCapture(webShots[0], r)} onCancel={cancelWebCapture} />
      ) : null}
      <ToastHost />
    </div>
  );
}
