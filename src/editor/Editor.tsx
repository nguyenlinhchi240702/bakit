// Screenshot editor: annotations as editable layers over an immutable original.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import Konva from 'konva';
import { Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { Asset, Crop, EditState, Shape, ToolId } from '../lib/types';
import { useStore } from '../lib/store';
import { useBlobUrl } from '../components/ui';
import { Icon } from '../components/Icon';
import { ShapeNode, type ShapeEvents } from './Shapes';
import { uid, clamp } from '../lib/util';
import { copyImage } from '../lib/platform';

export interface EditorApi { render: (format?: 'png' | 'jpg' | 'webp') => Promise<Blob> }

const TOOLS: Array<{ id: ToolId; name: string; key: string; group: number }> = [
  { id: 'select', name: 'Chọn', key: 'V', group: 0 },
  { id: 'arrow', name: 'Mũi tên', key: 'A', group: 1 }, { id: 'rect', name: 'Khung', key: 'R', group: 1 },
  { id: 'ellipse', name: 'Elip', key: 'E', group: 1 }, { id: 'line', name: 'Đường thẳng', key: 'L', group: 1 },
  { id: 'text', name: 'Chữ', key: 'T', group: 1 }, { id: 'number', name: 'Đánh số', key: 'N', group: 1 },
  { id: 'crop', name: 'Cắt ảnh', key: 'C', group: 2 }, { id: 'erase', name: 'Tẩy (trong suốt)', key: 'X', group: 2 },
  { id: 'cover', name: 'Phủ màu', key: 'O', group: 2 }, { id: 'blur', name: 'Làm mờ', key: 'B', group: 2 },
  { id: 'redact', name: 'Che kín (an toàn)', key: 'D', group: 2 }
];
const QUICK = ['#E5484D', '#2B6CF0', '#F5B400'];
const MORE = ['#111317', '#FFFFFF', '#16A34A'];
const RATIOS: Array<[string, number | null]> = [['Tự do', null], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9]];
const HINTS: Record<ToolId, string> = {
  select: 'Click chọn · Shift+Click chọn nhiều · kéo để di chuyển · Ctrl+D nhân bản · Del xóa',
  arrow: 'Kéo để vẽ mũi tên · Esc về Chọn', rect: 'Kéo để vẽ khung', ellipse: 'Kéo để vẽ elip', line: 'Kéo để vẽ đường thẳng',
  text: 'Click để gõ chữ · Enter xuống dòng · Esc / click ra ngoài để xong', number: 'Click để đặt số tiếp theo',
  crop: 'Kéo khung cắt · Enter áp dụng · Esc hủy · ảnh gốc giữ nguyên', erase: 'Tô để xóa thành trong suốt',
  cover: 'Kéo để phủ màu (mặc định trắng)', blur: 'Kéo vùng để làm mờ · dữ liệu nhạy cảm hãy dùng Che kín',
  redact: 'Kéo vùng để che kín — luôn flatten khi copy / xuất'
};

function useImage(url?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImg(null);
    if (!url) return;
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

function checkerPattern(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#E1E4E9'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
  return c;
}

const lsGet = (k: string, d: string) => { try { return localStorage.getItem('bakit.' + k) || d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem('bakit.' + k, v); } catch { /* ignore */ } };

export function Editor({ asset, apiRef }: { asset: Asset; apiRef: MutableRefObject<EditorApi | null> }) {
  const { updateAsset, setRendered, showToast } = useStore();
  const url = useBlobUrl(asset.originalKey);
  const img = useImage(url);
  const W = asset.width, H = asset.height;

  // ----- document state + history -----
  const [doc, setDoc] = useState<EditState>(() => asset.edit || { shapes: [] });
  const past = useRef<EditState[]>([]);
  const future = useRef<EditState[]>([]);
  const [, force] = useState(0);
  const commit = useCallback((next: EditState) => {
    setDoc((cur) => { past.current.push(cur); if (past.current.length > 200) past.current.shift(); future.current = []; return next; });
  }, []);
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(doc); setDoc(p); setSel([]); };
  const redo = () => { const n = future.current.pop(); if (!n) return; past.current.push(doc); setDoc(n); };

  // ----- tool state -----
  const [tool, setToolRaw] = useState<ToolId>(() => (lsGet('tool', 'arrow') as ToolId));
  const [color, setColor] = useState(() => lsGet('color', '#E5484D'));
  const [width, setWidth] = useState(() => Number(lsGet('width', '4')));
  const [textSize, setTextSize] = useState(() => Number(lsGet('textSize', '22')));
  const [fill, setFill] = useState<string>('');
  const [textBg, setTextBg] = useState<string>(() => lsGet('textBg', '#FFFFFF'));
  const [blurR, setBlurR] = useState(14);
  const [eraseSize, setEraseSize] = useState(28);
  const [coverFill, setCoverFill] = useState('#FFFFFF');
  const [ratio, setRatio] = useState<number | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [pendingCrop, setPendingCrop] = useState<Crop | null>(null);
  const [askSwitch, setAskSwitch] = useState<ToolId | null>(null);
  const [original, setOriginal] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const clipboard = useRef<Shape[]>([]);

  useEffect(() => { lsSet('tool', tool); }, [tool]);
  useEffect(() => { lsSet('color', color); lsSet('width', String(width)); lsSet('textSize', String(textSize)); lsSet('textBg', textBg); }, [color, width, textSize, textBg]);

  const setTool = (t: ToolId) => {
    if (tool === 'crop' && pendingCrop && t !== 'crop') { setAskSwitch(t); return; }
    if (t === 'crop') setPendingCrop(doc.crop ? { ...doc.crop } : null);
    setToolRaw(t);
    setSel([]);
  };

  // ----- viewport -----
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const showCrop = tool !== 'crop' && !original && doc.crop;
  const area: Crop = showCrop ? doc.crop! : { x: 0, y: 0, w: W, h: H };
  const LEFT = 68, RIGHT = 20, TOP = 20, BOTTOM = 84;
  const fitZoom = Math.max(0.05, Math.min((size.w - LEFT - RIGHT) / area.w, (size.h - TOP - BOTTOM) / area.h, 1));
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const z = zoomMode === 'fit' ? fitZoom : zoomMode;
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  const center = { x: LEFT + (size.w - LEFT - RIGHT - area.w * z) / 2, y: TOP + (size.h - TOP - BOTTOM - area.h * z) / 2 };
  const p0 = zoomMode === 'fit' || !pan ? center : pan;
  const gx = p0.x - area.x * z, gy = p0.y - area.y * z;
  useEffect(() => { setPan(null); }, [zoomMode === 'fit', area.x, area.y, area.w, area.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const toImg = (stage: Konva.Stage) => {
    const p = stage.getPointerPosition()!;
    return { x: (p.x - gx) / z, y: (p.y - gy) / z };
  };

  // ----- persistence (autosave edit layers + rendered PNG) -----
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const overlayRef = useRef<Konva.Group>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const first = useRef(true);
  const render = useCallback(async (format: 'png' | 'jpg' | 'webp' = 'png'): Promise<Blob> => {
    const stage = stageRef.current;
    if (!stage || !img) throw new Error('Ảnh chưa sẵn sàng');
    // Off-screen render at 1:1 image pixels: clone the content layers so the live view is untouched.
    const crop = doc.crop || { x: 0, y: 0, w: W, h: H };
    const off = new Konva.Stage({ container: document.createElement('div'), width: crop.w, height: crop.h });
    const base = new Konva.Layer();
    base.add(new Konva.Image({ image: img, x: -crop.x, y: -crop.y }));
    for (const s of doc.shapes) if (s.type === 'erase') base.add(new Konva.Line({ points: s.points.map((v, i) => v - (i % 2 ? crop.y : crop.x)), stroke: '#000', strokeWidth: s.size, lineCap: 'round', lineJoin: 'round', globalCompositeOperation: 'destination-out' }));
    off.add(base);
    const ann = stage.findOne('#ann') as Konva.Group | undefined;
    if (ann) {
      const layer = new Konva.Layer();
      const g = ann.clone({ x: -crop.x, y: -crop.y, scaleX: 1, scaleY: 1, clip: undefined }) as Konva.Group;
      g.find('Image').forEach((n) => (n as Konva.Image).cache());
      layer.add(g);
      off.add(layer);
    }
    const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    let canvas = off.toCanvas({ pixelRatio: 1 });
    if (format === 'jpg') {
      const c2 = document.createElement('canvas');
      c2.width = canvas.width; c2.height = canvas.height;
      const g2 = c2.getContext('2d')!;
      g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(canvas, 0, 0);
      canvas = c2;
    }
    off.destroy();
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), mime, 0.92));
  }, [doc, img, W, H]);
  apiRef.current = { render };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t1 = setTimeout(() => updateAsset(asset.id, { edit: doc }), 300);
    const t2 = setTimeout(() => { render().then((b) => setRendered(asset.id, b)).catch(() => undefined); }, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- transformer -----
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const ns = sel.map((id) => nodes.current.get(id)).filter(Boolean) as Konva.Node[];
    tr.nodes(tool === 'select' && !original ? ns : []);
    const only = sel.length === 1 ? doc.shapes.find((s) => s.id === sel[0]) : undefined;
    tr.keepRatio(only?.type === 'text' || only?.type === 'number');
    tr.getLayer()?.batchDraw();
  }, [sel, doc, tool, original]);

  const patchShapes = (ids: string[], fn: (s: Shape) => Shape) => commit({ ...doc, shapes: doc.shapes.map((s) => (ids.includes(s.id) ? fn(s) : s)) });

  const ev: ShapeEvents = {
    draggable: tool === 'select',
    listening: tool === 'select',
    register: (id, n) => { if (n) nodes.current.set(id, n); else nodes.current.delete(id); },
    onSelect: (id, add) => setSel((cur) => (add ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : cur.includes(id) ? cur : [id])),
    onDblText: (id) => { setSel([id]); setEditingText(id); },
    onDragEnd: (id, n) => {
      const dx = n.x(), dy = n.y();
      patchShapes([id], (s) => {
        if (s.type === 'arrow' || s.type === 'line') { n.position({ x: 0, y: 0 }); return { ...s, points: [s.points[0] + dx, s.points[1] + dy, s.points[2] + dx, s.points[3] + dy] }; }
        if (s.type === 'ellipse') return { ...s, x: dx - s.w / 2, y: dy - s.h / 2 };
        if (s.type === 'erase') return s;
        return { ...s, x: dx, y: dy } as Shape;
      });
    },
    onTransformEnd: (id, n) => {
      const sx = n.scaleX(), sy = n.scaleY();
      n.scale({ x: 1, y: 1 });
      patchShapes([id], (s) => {
        switch (s.type) {
          case 'arrow': case 'line': {
            const x = n.x(), y = n.y();
            n.position({ x: 0, y: 0 });
            return { ...s, points: [s.points[0] * sx + x, s.points[1] * sy + y, s.points[2] * sx + x, s.points[3] * sy + y] };
          }
          case 'ellipse': { const w = s.w * sx, h = s.h * sy; return { ...s, w, h, x: n.x() - w / 2, y: n.y() - h / 2 }; }
          case 'text': return { ...s, x: n.x(), y: n.y(), size: Math.max(8, Math.round(s.size * sy)) };
          case 'number': return { ...s, x: n.x(), y: n.y(), size: Math.max(8, Math.round(s.size * sy)) };
          case 'erase': return s;
          default: return { ...s, x: n.x(), y: n.y(), w: Math.max(2, (s as { w: number }).w * sx), h: Math.max(2, (s as { h: number }).h * sy) } as Shape;
        }
      });
    }
  };

  // ----- drawing -----
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const space = useRef(false);
  const down = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()!;
    if (space.current || e.evt.button === 1) {
      const p = stage.getPointerPosition()!;
      panning.current = { x: p.x, y: p.y, px: p0.x, py: p0.y };
      if (zoomMode === 'fit') setZoomMode(z);
      return;
    }
    if (e.evt.button !== 0 || original) return;
    if (editingText) { setEditingText(null); return; }
    const p = toImg(stage);
    const id = uid('s');
    switch (tool) {
      case 'select':
        if (e.target === stage || e.target.getParent()?.id() === 'base' || e.target.id() === 'checker') setSel([]);
        return;
      case 'arrow': case 'line': setDraft({ id, type: tool, points: [p.x, p.y, p.x, p.y], color, width }); return;
      case 'rect': case 'ellipse': setDraft({ id, type: tool, x: p.x, y: p.y, w: 0, h: 0, color, width, fill: fill || undefined }); return;
      case 'cover': setDraft({ id, type: 'cover', x: p.x, y: p.y, w: 0, h: 0, fill: coverFill }); return;
      case 'redact': setDraft({ id, type: 'redact', x: p.x, y: p.y, w: 0, h: 0, fill: '#111317' }); return;
      case 'blur': setDraft({ id, type: 'blur', x: p.x, y: p.y, w: 0, h: 0, radius: blurR }); return;
      case 'erase': setDraft({ id, type: 'erase', points: [p.x, p.y, p.x + 0.1, p.y], size: eraseSize }); return;
      case 'crop': setPendingCrop({ x: p.x, y: p.y, w: 0, h: 0 }); setDraft({ id: 'crop', type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: '#fff', width: 1 }); return;
      case 'number': {
        const n = doc.shapes.reduce((m, s) => (s.type === 'number' ? Math.max(m, s.n) : m), 0) + 1;
        commit({ ...doc, shapes: [...doc.shapes, { id, type: 'number', x: p.x, y: p.y, n, color, size: Math.max(12, Math.round(textSize * 0.6)) }] });
        return;
      }
      case 'text': {
        const s: Shape = { id, type: 'text', x: p.x, y: p.y - textSize * 0.7, text: '', color, size: textSize, bg: textBg || undefined };
        commit({ ...doc, shapes: [...doc.shapes, s] });
        setSel([id]);
        setEditingText(id);
        return;
      }
    }
  };
  const move = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()!;
    const pp = stage.getPointerPosition();
    if (pp) setCursor({ x: pp.x, y: pp.y });
    if (panning.current) {
      const pc = panning.current;
      setPan({ x: pc.px + (pp!.x - pc.x), y: pc.py + (pp!.y - pc.y) });
      return;
    }
    if (!draft) return;
    const p = toImg(stage);
    if (draft.type === 'arrow' || draft.type === 'line') {
      let { x, y } = p;
      if (e.evt.shiftKey) { // snap to 45°
        const dx = x - draft.points[0], dy = y - draft.points[1];
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
        x = draft.points[0] + Math.cos(ang) * len; y = draft.points[1] + Math.sin(ang) * len;
      }
      setDraft({ ...draft, points: [draft.points[0], draft.points[1], x, y] });
    } else if (draft.type === 'erase') {
      setDraft({ ...draft, points: [...draft.points, p.x, p.y] });
    } else if ('w' in draft) {
      const sx = (draft as { sx?: number }).sx ?? draft.x, sy = (draft as { sy?: number }).sy ?? draft.y;
      let w = p.x - sx, h = p.y - sy;
      if (tool === 'crop' && ratio) h = Math.sign(h || 1) * Math.abs(w) / ratio;
      const box = { x: Math.min(sx, sx + w), y: Math.min(sy, sy + h), w: Math.abs(w), h: Math.abs(h) };
      const next = { ...draft, ...box, sx, sy } as unknown as Shape;
      setDraft(next);
      if (tool === 'crop') setPendingCrop(clampCrop(box));
    }
  };
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const clampCrop = (c: Crop): Crop => {
    const x = clamp(c.x, 0, W), y = clamp(c.y, 0, H);
    return { x, y, w: clamp(c.w, 0, W - x), h: clamp(c.h, 0, H - y) };
  };
  const up = () => {
    if (panning.current) { panning.current = null; return; }
    if (!draft) return;
    const d = draft;
    setDraft(null);
    if (tool === 'crop') return;
    const clean = { ...d } as Shape & { sx?: number; sy?: number };
    delete clean.sx; delete clean.sy;
    if ((clean.type === 'arrow' || clean.type === 'line') && Math.hypot(clean.points[2] - clean.points[0], clean.points[3] - clean.points[1]) < 4) return;
    if ('w' in clean && (clean.w < 3 || clean.h < 3)) return;
    commit({ ...doc, shapes: [...doc.shapes, clean] });
    if (clean.type !== 'erase' && clean.type !== 'redact' && clean.type !== 'blur' && clean.type !== 'cover') setSel([clean.id]);
  };

  const applyCrop = () => {
    if (pendingCrop && pendingCrop.w > 4 && pendingCrop.h > 4) {
      commit({ ...doc, crop: clampCrop(pendingCrop) });
      showToast('Đã cắt ' + Math.round(pendingCrop.w) + ' × ' + Math.round(pendingCrop.h) + ' · ảnh gốc giữ nguyên', 'ok', { label: 'Hoàn tác', run: undo });
    }
    setPendingCrop(null);
    setToolRaw('select');
  };
  const cancelCrop = () => { setPendingCrop(null); setToolRaw('select'); };

  // ----- actions on selection -----
  const selShapes = doc.shapes.filter((s) => sel.includes(s.id));
  const del = () => { if (!sel.length) return; commit({ ...doc, shapes: doc.shapes.filter((s) => !sel.includes(s.id)) }); setSel([]); };
  const dup = (src = selShapes) => {
    if (!src.length) return;
    const copies = src.map((s) => shift({ ...s, id: uid('s') } as Shape, 16));
    commit({ ...doc, shapes: [...doc.shapes, ...copies] });
    setSel(copies.map((c) => c.id));
  };
  const order = (dir: 1 | -1) => {
    if (!sel.length) return;
    const arr = [...doc.shapes];
    const idxs = arr.map((s, i) => (sel.includes(s.id) ? i : -1)).filter((i) => i >= 0);
    (dir === 1 ? idxs.reverse() : idxs).forEach((i) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length || sel.includes(arr[j].id)) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });
    commit({ ...doc, shapes: arr });
  };
  const renumber = () => {
    let n = 0;
    commit({ ...doc, shapes: doc.shapes.map((s) => (s.type === 'number' ? { ...s, n: ++n } : s)) });
    showToast('Đã đánh số lại 1 → ' + n);
  };
  const applyStyle = (p: { color?: string; width?: number; fill?: string; size?: number; bg?: string; radius?: number }) => {
    if (!selShapes.length) return;
    patchShapes(sel, (s) => {
      const o = { ...s } as Record<string, unknown>;
      if (p.color && 'color' in s) o.color = p.color;
      if (p.width && 'width' in s) o.width = p.width;
      if (p.fill !== undefined && (s.type === 'rect' || s.type === 'ellipse')) o.fill = p.fill || undefined;
      if (p.fill !== undefined && s.type === 'cover') o.fill = p.fill || '#FFFFFF';
      if (p.size && (s.type === 'text')) o.size = p.size;
      if (p.bg !== undefined && s.type === 'text') o.bg = p.bg || undefined;
      if (p.radius && s.type === 'blur') o.radius = p.radius;
      return o as unknown as Shape;
    });
  };
  const copyRendered = async () => {
    try { await copyImage(await render()); showToast('Đã copy ảnh ' + Math.round(area.w) + ' × ' + Math.round(area.h) + ' vào clipboard'); }
    catch (e) { showToast('Không copy được ảnh: ' + String(e), 'err'); }
  };

  // ----- keyboard -----
  const keyState = useRef({ tool, sel, doc, pendingCrop, editingText });
  keyState.current = { tool, sel, doc, pendingCrop, editingText };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || document.querySelector('.modal-wrap')) return;
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === ' ') { space.current = true; e.preventDefault(); return; }
      if (k === '\\') { setOriginal(true); return; }
      if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (ctrl && k === 'd') { e.preventDefault(); dup(); return; }
      if (ctrl && e.shiftKey && k === 'c') { e.preventDefault(); copyRendered(); return; }
      if (ctrl && k === 'c') {
        e.preventDefault();
        if (keyState.current.sel.length) { clipboard.current = selShapes.map((s) => ({ ...s })); showToast('Đã copy ' + sel.length + ' đối tượng · Ctrl+V để dán trong ảnh'); }
        else copyRendered();
        return;
      }
      if (ctrl && k === ']') { e.preventDefault(); order(1); return; }
      if (ctrl && k === '[') { e.preventDefault(); order(-1); return; }
      if (ctrl && k === '0') { e.preventDefault(); setZoomMode('fit'); return; }
      if (ctrl && k === '1') { e.preventDefault(); setZoomMode(1); return; }
      if (ctrl) return;
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); del(); return; }
      if (k === 'escape') {
        if (keyState.current.tool === 'crop') { cancelCrop(); return; }
        setSel([]); setToolRaw('select'); return;
      }
      if (k === 'enter' && keyState.current.tool === 'crop') { applyCrop(); return; }
      const t2 = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (t2) setTool(t2.id);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ') space.current = false;
      if (e.key === '\\') setOriginal(false);
    };
    const onPasteShapes = () => {
      if (!clipboard.current.length) { showToast('Clipboard chưa có hình ảnh', 'err'); return; }
      dup(clipboard.current);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('bakit:paste-shapes', onPasteShapes);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); window.removeEventListener('bakit:paste-shapes', onPasteShapes); };
  });

  const wheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!e.evt.ctrlKey) return;
    e.evt.preventDefault();
    const stage = e.target.getStage()!;
    const p = stage.getPointerPosition()!;
    const nz = clamp(z * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1), 0.05, 8);
    const ix = (p.x - gx) / z, iy = (p.y - gy) / z;
    setZoomMode(nz);
    setPan({ x: p.x - ix * nz + area.x * nz, y: p.y - iy * nz + area.y * nz });
  };

  const checker = useMemo(() => checkerPattern(), []);
  const erases = doc.shapes.filter((s) => s.type === 'erase') as Extract<Shape, { type: 'erase' }>[];
  const visibleShapes = original ? [] : doc.shapes.filter((s) => s.type !== 'erase');
  const editingShape = editingText ? (doc.shapes.find((s) => s.id === editingText) as Extract<Shape, { type: 'text' }> | undefined) : undefined;
  const clip = showCrop ? { x: area.x, y: area.y, width: area.w, height: area.h } : { x: 0, y: 0, width: W, height: H };
  const wantsColor = ['arrow', 'rect', 'ellipse', 'line', 'text', 'number'].includes(tool) || selShapes.some((s) => 'color' in s);
  const wantsWidth = ['arrow', 'rect', 'ellipse', 'line'].includes(tool) || selShapes.some((s) => 'width' in s);
  const cursorCss = tool === 'select' ? (space.current ? 'grab' : 'default') : tool === 'erase' ? 'none' : 'crosshair';

  return (
    <div className="editor-stage" ref={wrap} style={{ cursor: cursorCss }}>
      {img ? (
        <Stage ref={stageRef} width={size.w} height={size.h} onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={() => setCursor(null)} onWheel={wheel}>
          <Layer listening={false}>
            <Rect id="checker" x={gx + area.x * z} y={gy + area.y * z} width={area.w * z} height={area.h * z} fillPatternImage={checker as unknown as HTMLImageElement} shadowColor="black" shadowBlur={18} shadowOpacity={0.22} />
          </Layer>
          <Layer>
            <Group id="base" x={gx} y={gy} scaleX={z} scaleY={z} clip={clip}>
              <KImage image={img} />
              {!original ? erases.map((s) => <Line key={s.id} points={s.points} stroke="#000" strokeWidth={s.size} lineCap="round" lineJoin="round" globalCompositeOperation="destination-out" listening={false} />) : null}
              {draft?.type === 'erase' ? <Line points={draft.points} stroke="#000" strokeWidth={draft.size} lineCap="round" lineJoin="round" globalCompositeOperation="destination-out" listening={false} /> : null}
            </Group>
          </Layer>
          <Layer>
            <Group id="ann" x={gx} y={gy} scaleX={z} scaleY={z} clip={clip}>
              {visibleShapes.map((s) => (s.id === editingText ? null : <ShapeNode key={s.id} s={s} img={img} ev={ev} />))}
              {draft && draft.type !== 'erase' && tool !== 'crop' ? <ShapeNode s={draft} img={img} ev={{ ...ev, draggable: false, listening: false, register: () => undefined }} /> : null}
            </Group>
            <Group ref={overlayRef} x={gx} y={gy} scaleX={z} scaleY={z} listening={false}>
              {tool === 'crop' ? (() => {
                const c = pendingCrop && pendingCrop.w > 0 ? pendingCrop : null;
                const dim = 'rgba(10,12,16,.55)';
                if (!c) return <Rect x={0} y={0} width={W} height={H} fill="rgba(10,12,16,.35)" />;
                return (
                  <>
                    <Rect x={0} y={0} width={W} height={c.y} fill={dim} />
                    <Rect x={0} y={c.y + c.h} width={W} height={H - c.y - c.h} fill={dim} />
                    <Rect x={0} y={c.y} width={c.x} height={c.h} fill={dim} />
                    <Rect x={c.x + c.w} y={c.y} width={W - c.x - c.w} height={c.h} fill={dim} />
                    <Rect x={c.x} y={c.y} width={c.w} height={c.h} stroke="#fff" strokeWidth={1.5 / z} />
                    <Line points={[c.x + c.w / 3, c.y, c.x + c.w / 3, c.y + c.h]} stroke="rgba(255,255,255,.5)" strokeWidth={1 / z} />
                    <Line points={[c.x + (2 * c.w) / 3, c.y, c.x + (2 * c.w) / 3, c.y + c.h]} stroke="rgba(255,255,255,.5)" strokeWidth={1 / z} />
                    <Line points={[c.x, c.y + c.h / 3, c.x + c.w, c.y + c.h / 3]} stroke="rgba(255,255,255,.5)" strokeWidth={1 / z} />
                    <Line points={[c.x, c.y + (2 * c.h) / 3, c.x + c.w, c.y + (2 * c.h) / 3]} stroke="rgba(255,255,255,.5)" strokeWidth={1 / z} />
                    <Text x={c.x} y={c.y + c.h + 6 / z} text={Math.round(c.w) + ' × ' + Math.round(c.h)} fontSize={12 / z} fill="#fff" />
                  </>
                );
              })() : null}
              {draft && (draft.type === 'rect' || draft.type === 'cover' || draft.type === 'redact' || draft.type === 'blur') && tool !== 'crop' ? (
                <Text x={draft.x} y={draft.y + draft.h + 4 / z} text={Math.round(draft.w) + ' × ' + Math.round(draft.h)} fontSize={11 / z} fill="#2B5BE3" />
              ) : null}
            </Group>
            <Transformer ref={trRef} rotateEnabled={false} flipEnabled={false} anchorSize={9} anchorStroke="#2B5BE3" borderStroke="#2B5BE3" borderDash={[4, 3]} ignoreStroke
              boundBoxFunc={(o, n) => (n.width < 6 || n.height < 6 ? o : n)} />
          </Layer>
        </Stage>
      ) : <div className="empty" style={{ height: '100%' }}>Đang mở ảnh…</div>}

      {tool === 'erase' && cursor ? <div style={{ position: 'absolute', left: cursor.x - (eraseSize * z) / 2, top: cursor.y - (eraseSize * z) / 2, width: eraseSize * z, height: eraseSize * z, borderRadius: '50%', border: '1.5px solid #2B5BE3', boxShadow: '0 0 0 1px #fff', pointerEvents: 'none' }} /> : null}

      {editingShape ? (
        <textarea className="text-editor" autoFocus defaultValue={editingShape.text}
          style={{ left: gx + editingShape.x * z, top: gy + editingShape.y * z, fontSize: editingShape.size * z, color: editingShape.color, background: editingShape.bg || 'rgba(255,255,255,.85)', minWidth: 140, minHeight: editingShape.size * z * 1.6 }}
          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; el.style.width = 'auto'; el.style.width = Math.max(140, el.scrollWidth + 4) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLTextAreaElement).blur(); } e.stopPropagation(); }}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            const id = editingShape.id;
            setEditingText(null);
            if (!v.trim()) { setDoc((cur) => ({ ...cur, shapes: cur.shapes.filter((s) => s.id !== id) })); setSel([]); }
            else setDoc((cur) => ({ ...cur, shapes: cur.shapes.map((s) => (s.id === id ? { ...s, text: v } : s)) }));
          }} />
      ) : null}

      {/* Tool bar */}
      <div className="card" style={{ position: 'absolute', left: 10, top: 10, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4, boxShadow: 'var(--shadow)', maxHeight: 'calc(100% - 50px)', overflow: 'visible' }} onMouseDown={(e) => e.stopPropagation()}>
        {TOOLS.map((t, i) => (
          <span key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {i > 0 && TOOLS[i - 1].group !== t.group ? <span style={{ width: 26, height: 1, background: 'var(--border)', margin: '3px 0' }} /> : null}
            <button className={'tool' + (tool === t.id ? ' on' : '')} aria-label={t.name + ' (' + t.key + ')'} onClick={() => setTool(t.id)}>
              <Icon name={t.id} size={18} />
              <span className="tipx tip">{t.name} <span className="kbd">{t.key}</span></span>
            </button>
          </span>
        ))}
        <span style={{ width: 26, height: 1, background: 'var(--border)', margin: '3px 0' }} />
        <button className="tool" aria-label="Undo (Ctrl+Z)" disabled={!past.current.length} style={{ opacity: past.current.length ? 1 : 0.4 }} onClick={() => { undo(); force((x) => x + 1); }}><Icon name="undo" size={18} /><span className="tipx tip">Undo <span className="kbd">Ctrl+Z</span></span></button>
        <button className="tool" aria-label="Redo (Ctrl+Y)" disabled={!future.current.length} style={{ opacity: future.current.length ? 1 : 0.4 }} onClick={() => { redo(); force((x) => x + 1); }}><Icon name="redo" size={18} /><span className="tipx tip">Redo <span className="kbd">Ctrl+Y</span></span></button>
        <button className={'tool' + (original ? ' on' : '')} aria-label="Giữ để xem ảnh gốc" onMouseDown={() => setOriginal(true)} onMouseUp={() => setOriginal(false)} onMouseLeave={() => setOriginal(false)}><Icon name="eye" size={18} /><span className="tipx tip">Giữ để xem ảnh gốc <span className="kbd">\</span></span></button>
      </div>

      {/* Options bar for the current tool / selection */}
      {tool !== 'crop' ? (
        <div className="card" style={{ position: 'absolute', left: 68, bottom: 38, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', boxShadow: 'var(--shadow)', flexWrap: 'wrap', maxWidth: 'calc(100% - 24px)' }} onMouseDown={(e) => e.stopPropagation()}>
          {wantsColor ? (
            <span className="row" style={{ gap: 7 }}>
              {[...QUICK, ...MORE].map((c) => <button key={c} className={'sw' + (color === c ? ' on' : '')} style={{ background: c, width: 20, height: 20 }} aria-label={'Màu ' + c} onClick={() => { setColor(c); applyStyle({ color: c }); }} />)}
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); applyStyle({ color: e.target.value }); }} aria-label="Màu khác" style={{ width: 24, height: 22, padding: 0, border: 0, background: 'transparent' }} />
            </span>
          ) : null}
          {wantsWidth ? <label className="row" style={{ gap: 6, fontSize: 12 }}>Nét<input type="range" min={1} max={16} value={width} onChange={(e) => { const v = Number(e.target.value); setWidth(v); applyStyle({ width: v }); }} style={{ width: 90, accentColor: 'var(--accent)' }} /><span className="val" style={{ minWidth: 34, height: 22 }}>{width}</span></label> : null}
          {tool === 'rect' || tool === 'ellipse' || selShapes.some((s) => s.type === 'rect' || s.type === 'ellipse') ? (
            <span className="row" style={{ gap: 6, fontSize: 12 }}>Nền
              {['', '#FFFFFF', '#FFF1B8', '#FDE2E3'].map((f) => <button key={f || 'none'} className={'sw' + (f ? '' : ' none') + (fill === f ? ' on' : '')} style={f ? { background: f, width: 20, height: 20 } : { width: 20, height: 20 }} aria-label={f ? 'Nền ' + f : 'Không nền'} onClick={() => { setFill(f); applyStyle({ fill: f }); }} />)}
            </span>
          ) : null}
          {tool === 'text' || selShapes.some((s) => s.type === 'text') ? (
            <>
              <label className="row" style={{ gap: 6, fontSize: 12 }}>Cỡ<input type="number" className="inp" min={8} max={120} value={textSize} onChange={(e) => { const v = Number(e.target.value) || 22; setTextSize(v); applyStyle({ size: v }); }} style={{ width: 64, height: 26 }} /></label>
              <span className="row" style={{ gap: 6, fontSize: 12 }}>Nền chữ
                {['', '#FFFFFF', '#FFF1B8', '#111317'].map((f) => <button key={f || 'none'} className={'sw' + (f ? '' : ' none') + (textBg === f ? ' on' : '')} style={f ? { background: f, width: 20, height: 20 } : { width: 20, height: 20 }} aria-label={f ? 'Nền ' + f : 'Không nền'} onClick={() => { setTextBg(f); applyStyle({ bg: f }); }} />)}
              </span>
            </>
          ) : null}
          {tool === 'number' ? <><label className="row" style={{ gap: 6, fontSize: 12 }}>Cỡ<input type="range" min={10} max={40} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} style={{ width: 80, accentColor: 'var(--accent)' }} /></label><button className="btn sm" onClick={renumber}><Icon name="refresh" size={13} />Đánh số lại 1 → n</button></> : null}
          {tool === 'cover' ? <span className="row" style={{ gap: 6, fontSize: 12 }}>Màu phủ {['#FFFFFF', '#F2F4F7', '#9AA3AF', '#111317'].map((f) => <button key={f} className={'sw' + (coverFill === f ? ' on' : '')} style={{ background: f, width: 20, height: 20 }} aria-label={'Phủ ' + f} onClick={() => { setCoverFill(f); applyStyle({ fill: f }); }} />)}</span> : null}
          {tool === 'blur' ? <><label className="row" style={{ gap: 6, fontSize: 12 }}>Cường độ<input type="range" min={4} max={40} value={blurR} onChange={(e) => { const v = Number(e.target.value); setBlurR(v); applyStyle({ radius: v }); }} style={{ width: 90, accentColor: 'var(--accent)' }} /></label><span className="pill warn"><Icon name="warn" size={13} />Blur không đủ an toàn cho email, số tài khoản… → dùng Che kín (D)</span></> : null}
          {tool === 'redact' ? <span className="pill ok"><Icon name="shield" size={13} />Copy / xuất ảnh luôn flatten vùng che — không còn pixel gốc</span> : null}
          {tool === 'erase' ? <label className="row" style={{ gap: 6, fontSize: 12 }}>Cỡ cọ<input type="range" min={6} max={120} value={eraseSize} onChange={(e) => setEraseSize(Number(e.target.value))} style={{ width: 100, accentColor: 'var(--accent)' }} /><span className="val" style={{ minWidth: 40, height: 22 }}>{eraseSize}</span></label> : null}
          {selShapes.length ? (
            <span className="row" style={{ gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>{selShapes.length} đã chọn</span>
              <button className="btn ghost sm sq" title="Nhân bản (Ctrl+D)" aria-label="Nhân bản" onClick={() => dup()}><Icon name="copy" size={14} /></button>
              <button className="btn ghost sm sq" title="Lên trên (Ctrl+])" aria-label="Lên trên" onClick={() => order(1)}><Icon name="up" size={14} /></button>
              <button className="btn ghost sm sq" title="Xuống dưới (Ctrl+[)" aria-label="Xuống dưới" onClick={() => order(-1)}><Icon name="down" size={14} /></button>
              <button className="btn ghost sm sq" title="Xóa (Del)" aria-label="Xóa đối tượng" onClick={del}><Icon name="trash" size={14} /></button>
            </span>
          ) : null}
        </div>
      ) : (
        <div className="card" style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 12px', boxShadow: 'var(--shadow)' }} onMouseDown={(e) => e.stopPropagation()}>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>{pendingCrop ? Math.round(pendingCrop.w) + ' × ' + Math.round(pendingCrop.h) : 'Kéo để chọn'}</span>
          <div className="seg">{RATIOS.map(([l, r]) => <button key={l} className={ratio === r ? 'on' : ''} onClick={() => setRatio(r)}>{l}</button>)}</div>
          {doc.crop ? <button className="btn ghost sm" onClick={() => { commit({ ...doc, crop: undefined }); setPendingCrop(null); }}>Bỏ cắt</button> : null}
          <button className="btn sm" onClick={cancelCrop}>Cancel <span className="kbd">Esc</span></button>
          <button className="btn sm pri" onClick={applyCrop} disabled={!pendingCrop || pendingCrop.w < 5}>Apply <span className="kbd" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>Enter</span></button>
        </div>
      )}

      {/* Status bar */}
      <div className="sbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <span>{Math.round(area.w)} × {Math.round(area.h)} px{doc.crop ? ' (đã cắt từ ' + W + ' × ' + H + ')' : ''}</span>
        <span className="vsep" />
        <button className="btn ghost sm sq" style={{ height: 22, width: 22 }} aria-label="Thu nhỏ" onClick={() => setZoomMode(clamp(z / 1.25, 0.05, 8))}>−</button>
        <span className="val" style={{ height: 20, minWidth: 50 }}>{Math.round(z * 100)}%</span>
        <button className="btn ghost sm sq" style={{ height: 22, width: 22 }} aria-label="Phóng to" onClick={() => setZoomMode(clamp(z * 1.25, 0.05, 8))}>+</button>
        <button className="btn ghost sm" style={{ height: 22, padding: '0 8px' }} title="Ctrl+0" onClick={() => setZoomMode('fit')}>Fit</button>
        <button className="btn ghost sm" style={{ height: 22, padding: '0 8px' }} title="Ctrl+1" onClick={() => setZoomMode(1)}>100%</button>
        <span className="vsep" />
        <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{original ? 'Đang xem ảnh gốc — thả để quay lại' : HINTS[tool]} · Space+kéo: di chuyển · Ctrl+cuộn: zoom</span>
      </div>

      {askSwitch ? (
        <div className="modal-wrap">
          <div className="modal" style={{ width: 420 }}>
            <b style={{ fontSize: 15 }}>Vùng cắt chưa được áp dụng</b>
            <span className="muted">Bạn đang chuyển sang công cụ khác. Áp dụng vùng cắt hiện tại hay bỏ?</span>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setAskSwitch(null)}>Ở lại</button>
              <button className="btn" onClick={() => { const t = askSwitch; setAskSwitch(null); setPendingCrop(null); setToolRaw(t); }}>Bỏ vùng &amp; chuyển</button>
              <button className="btn pri" onClick={() => { const t = askSwitch; setAskSwitch(null); applyCrop(); setToolRaw(t); }}>Apply &amp; chuyển</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shift(s: Shape, d: number): Shape {
  switch (s.type) {
    case 'arrow': case 'line': return { ...s, points: [s.points[0] + d, s.points[1] + d, s.points[2] + d, s.points[3] + d] };
    case 'erase': return { ...s, points: s.points.map((v) => v + d) };
    default: return { ...s, x: s.x + d, y: s.y + d };
  }
}
