import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { blobUrl } from '../lib/db';
import { useStore } from '../lib/store';
import { COLOR_STYLE } from '../lib/templates';
import type { Asset, StatusDef } from '../lib/types';
import { colorFor, initials } from '../lib/util';
import { openUrl, workItemUrl } from '../lib/platform';

export function useBlobUrl(key?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    setUrl(undefined);
    if (key) blobUrl(key).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [key]);
  return url;
}

export function AssetThumb({ asset, w, h, onClick, title }: { asset?: Asset; w: number | string; h: number; onClick?: () => void; title?: string }) {
  const url = useBlobUrl(asset?.renderedKey || asset?.originalKey);
  return (
    <button className="thumb-btn" style={{ width: w, height: h }} onClick={onClick} title={title || asset?.name} type="button">
      {url ? <img src={url} alt={asset?.name || ''} /> : null}
    </button>
  );
}

export function Check({ on, onClick, size = 18, label = 'Đánh dấu đã thực hiện' }: { on: boolean; onClick: (e: React.MouseEvent) => void; size?: number; label?: string }) {
  return (
    <button type="button" className={'cb' + (on ? ' on' : '')} style={{ width: size, height: size }} aria-label={label} aria-pressed={on} title={label}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}>
      <Icon name="check" size={size - 7} style={{ strokeWidth: 3, opacity: on ? 1 : 0 }} />
    </button>
  );
}

export function StatusPill({ status, onClick, title }: { status?: StatusDef; onClick?: (e: React.MouseEvent) => void; title?: string }) {
  if (!status) return <span className="muted">—</span>;
  const c = COLOR_STYLE[status.color];
  return (
    <button type="button" className="status-pill" style={{ background: c.bg, color: c.fg }} title={title} onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      {status.name}
    </button>
  );
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  if (!name) return <span className="avatar" style={{ width: size, height: size, background: 'var(--border-strong)' }}>?</span>;
  return <span className="avatar" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.45 }}>{initials(name)}</span>;
}

export function Modal({ title, onClose, children, width = 440, footer }: { title: string; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-label={title}>
        <div className="between">
          <b style={{ fontSize: 16 }}>{title}</b>
          <button className="btn ghost sm sq" aria-label="Đóng" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
        {footer ? <div className="row" style={{ justifyContent: 'flex-end' }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function Confirm({ title, body, okLabel, danger, onOk, onClose }: { title: string; body: ReactNode; okLabel: string; danger?: boolean; onOk: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Hủy</button>
      <button className={'btn ' + (danger ? 'dng' : 'pri')} onClick={() => { onOk(); onClose(); }}>{okLabel}</button>
    </>}>
      <div className="muted">{body}</div>
    </Modal>
  );
}

export function ToastHost() {
  const toast = useStore((s) => s.toast);
  const hide = useStore((s) => s.hideToast);
  if (!toast) return null;
  return (
    <div className="toast-wrap">
      <div className={'toast ' + (toast.kind === 'ok' ? '' : toast.kind)} role="status">
        {toast.kind === 'ok' ? <Icon name="check" style={{ color: '#5CCB8E' }} /> : toast.kind === 'err' ? <Icon name="warn" /> : <Icon name="bell" />}
        <span>{toast.text}</span>
        {toast.action ? <button className="act" style={toast.kind !== 'ok' ? { color: '#fff', textDecoration: 'underline' } : undefined} onClick={() => { toast.action!.run(); hide(); }}>{toast.action.label}</button> : null}
        <button className="act" aria-label="Đóng thông báo" style={{ color: 'inherit', opacity: 0.7 }} onClick={hide}><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}

/** Popover that closes on outside click / Escape. */
export function Popover({ open, onClose, children, style, className = 'menu' }: { open: boolean; onClose: () => void; children: ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('mousedown', down), 0);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={'popover ' + className} style={style}>{children}</div>;
}

export function PeopleInput({ value, onChange, placeholder = 'Người phụ trách' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const people = useStore((s) => s.settings.people);
  const id = 'people-list';
  return (
    <>
      <input className="inp" list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      <datalist id={id}>{people.map((p) => <option key={p} value={p} />)}</datalist>
    </>
  );
}

/** Azure work item chip — clickable when an Azure DevOps link is set in Cài đặt. */
export function WorkItemChip({ value, style, label }: { value?: string; style?: React.CSSProperties; label?: string }) {
  const base = useStore((s) => s.settings.azureBase);
  if (!value) return null;
  const url = workItemUrl(value, base);
  if (!url) return <span className="chip blue" style={style} title={'Azure ' + value}>{label || value}</span>;
  return (
    <a className="chip blue" style={{ cursor: 'pointer', textDecoration: 'none', ...style }} title={'Mở ' + value + ' trên Azure DevOps'} href={url}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openUrl(url).catch(() => undefined); }}>{label || value} ↗</a>
  );
}
