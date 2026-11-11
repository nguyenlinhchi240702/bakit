// Runs inside each per-monitor overlay window (Tauri only).
import { useEffect, useState } from 'react';
import { readShots, type Rect } from '../lib/capture';
import type { ScreenShot } from '../lib/platform';
import { CaptureOverlay } from './CaptureOverlay';

export default function OverlayApp({ index }: { index: number }) {
  const [shot, setShot] = useState<ScreenShot | null>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    const shots = readShots();
    setCount(shots.length);
    setShot(shots.find((s) => s.index === index) || null);
    document.body.style.background = '#000';
  }, [index]);

  const send = async (name: 'capture:done' | 'capture:cancel', payload?: { index: number; rect: Rect }) => {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(name, payload);
  };

  if (!shot) return null;
  return (
    <CaptureOverlay shot={shot} others={count}
      onDone={(rect) => send('capture:done', { index, rect })}
      onCancel={() => send('capture:cancel')} />
  );
}
