import { useEffect, useRef, useState } from 'react';
import type { ScreenShot } from '../lib/platform';
import type { Rect } from '../lib/capture';
import { Icon } from './Icon';

/** Frozen screenshot with a crosshair; drag a region, release to capture. Esc cancels. */
export function CaptureOverlay({ shot, onDone, onCancel, others }: { shot: ScreenShot; onDone: (r: Rect) => void; onCancel: () => void; others?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [cur, setCur] = useState<{ x: number; y: number }>({ x: -100, y: -100 });

  useEffect(() => {
    root.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onDone({ x: 0, y: 0, w: shot.width, h: shot.height });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel, onDone, shot]);

  const ratio = () => {
    const el = root.current!;
    return { rx: shot.width / el.clientWidth, ry: shot.height / el.clientHeight };
  };
  const sel = start ? { x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) } : null;
  const finish = () => {
    if (!sel) return;
    setStart(null);
    if (sel.w < 3 || sel.h < 3) return; // a zero-size region creates nothing
    const { rx, ry } = ratio();
    onDone({ x: sel.x * rx, y: sel.y * ry, w: sel.w * rx, h: sel.h * ry });
  };
  const { rx, ry } = root.current ? ratio() : { rx: 1, ry: 1 };
  const dim = 'rgba(8,10,14,.48)';

  return (
    <div ref={root} className="overlay-root bk dark" tabIndex={-1}
      onMouseDown={(e) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest('.card')) return; setStart({ x: e.clientX, y: e.clientY }); setCur({ x: e.clientX, y: e.clientY }); }}
      onMouseMove={(e) => setCur({ x: e.clientX, y: e.clientY })}
      onMouseUp={finish}
      onContextMenu={(e) => { e.preventDefault(); onCancel(); }}>
      <img src={shot.src} alt="" draggable={false} />
      {sel ? (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: sel.y, background: dim }} />
          <div style={{ position: 'absolute', left: 0, top: sel.y + sel.h, right: 0, bottom: 0, background: dim }} />
          <div style={{ position: 'absolute', left: 0, top: sel.y, width: sel.x, height: sel.h, background: dim }} />
          <div style={{ position: 'absolute', left: sel.x + sel.w, top: sel.y, right: 0, height: sel.h, background: dim }} />
          <div style={{ position: 'absolute', left: sel.x, top: sel.y, width: sel.w, height: sel.h, outline: '2px solid #4C7DF0', boxShadow: '0 0 0 1px rgba(255,255,255,.6)' }} />
          <div className="tip" style={{ position: 'absolute', left: sel.x + sel.w + 8, top: sel.y + sel.h + 8, fontWeight: 600 }}>
            {Math.round(sel.w * rx)} × {Math.round(sel.h * ry)} px
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,14,.25)' }} />
      )}
      <div style={{ position: 'absolute', left: cur.x, top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,.5)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: cur.y, height: 1, width: '100%', background: 'rgba(255,255,255,.5)', pointerEvents: 'none' }} />

      <div className="card" style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: 6, boxShadow: 'var(--shadow)', cursor: 'default' }}>
        <span className="row" style={{ gap: 6, padding: '0 6px', fontSize: 12.5 }}><Icon name="capture" />Kéo để chọn vùng</span>
        <span className="vsep" />
        <button className="btn sm" onClick={() => onDone({ x: 0, y: 0, w: shot.width, h: shot.height })} title="Enter">
          <Icon name="monitor" size={14} />Toàn màn hình này <span className="kbd">Enter</span>
        </button>
        <button className="btn ghost sm" onClick={onCancel}>Hủy <span className="kbd">Esc</span></button>
      </div>
      <div className="tip" style={{ position: 'absolute', left: 20, bottom: 20, fontSize: 12 }}>
        {shot.name} · {shot.width}×{shot.height} · {Math.round(shot.scale * 100)}%{others && others > 1 ? ' · có thể chọn vùng trên màn hình khác' : ''}
      </div>
    </div>
  );
}
