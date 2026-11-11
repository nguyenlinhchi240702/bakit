import { useState } from 'react';
import { addDays, addMonths, monthGridStart, monthTitle, todayKey } from '../lib/dates';
import { Icon } from './Icon';

export function MiniCalendar({ marks, onPick, selected }: { marks: (date: string) => 'none' | 'dot' | 'late'; onPick: (d: string) => void; selected?: string }) {
  const T = todayKey();
  const [month, setMonth] = useState(T.slice(0, 8) + '01');
  const start = monthGridStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="between">
        <b>{monthTitle(month)}</b>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn ghost sm sq" aria-label="Tháng trước" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevLeft" size={14} /></button>
          <button className="btn ghost sm sq" aria-label="Tháng sau" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevRight" size={14} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center' }}>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <span key={d} className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{d}</span>)}
        {days.map((d) => {
          const isT = d === T;
          const other = d.slice(5, 7) !== month.slice(5, 7);
          const m = marks(d);
          const sel = d === selected;
          return (
            <button key={d} onClick={() => onPick(d)} aria-label={d}
              style={{ height: 34, borderRadius: 6, border: sel && !isT ? '1.5px solid var(--accent)' : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12,
                background: isT ? 'var(--accent)' : 'transparent', color: isT ? '#fff' : other ? 'var(--text-3)' : 'var(--text)', fontWeight: isT ? 700 : 500 }}>
              {Number(d.slice(8, 10))}
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: m === 'none' ? 'transparent' : isT ? '#fff' : m === 'late' ? 'var(--danger)' : 'var(--accent)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
