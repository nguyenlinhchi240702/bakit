// Konva renderers for each annotation type.
import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Ellipse, Group, Image as KImage, Label, Line, Rect, Tag, Text } from 'react-konva';
import type { Shape } from '../lib/types';

export interface ShapeEvents {
  draggable: boolean;
  listening: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onDragEnd: (id: string, node: Konva.Node) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  onDblText: (id: string) => void;
  register: (id: string, node: Konva.Node | null) => void;
}

function BlurNode({ s, img, ev }: { s: Extract<Shape, { type: 'blur' }>; img: HTMLImageElement; ev: ShapeEvents }) {
  const ref = useRef<Konva.Image>(null);
  useEffect(() => {
    const n = ref.current;
    if (!n) return;
    n.cache();
    n.getLayer()?.batchDraw();
  }, [s.x, s.y, s.w, s.h, s.radius, img]);
  const w = Math.max(1, s.w), h = Math.max(1, s.h);
  return (
    <KImage
      ref={(n) => { ref.current = n; ev.register(s.id, n); }}
      image={img} x={s.x} y={s.y} width={w} height={h}
      crop={{ x: Math.max(0, s.x), y: Math.max(0, s.y), width: w, height: h }}
      filters={[Konva.Filters.Blur]} blurRadius={s.radius}
      draggable={ev.draggable} listening={ev.listening}
      onMouseDown={(e) => { if (ev.listening) { e.cancelBubble = true; ev.onSelect(s.id, e.evt.shiftKey); } }}
      onDragEnd={(e) => ev.onDragEnd(s.id, e.target)}
      onTransformEnd={(e) => ev.onTransformEnd(s.id, e.target)}
    />
  );
}

export function ShapeNode({ s, img, ev }: { s: Shape; img: HTMLImageElement; ev: ShapeEvents }) {
  const common = {
    draggable: ev.draggable,
    listening: ev.listening,
    opacity: s.opacity ?? 1,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => { if (ev.listening) { e.cancelBubble = true; ev.onSelect(s.id, e.evt.shiftKey); } },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => ev.onDragEnd(s.id, e.target),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => ev.onTransformEnd(s.id, e.target),
    ref: (n: Konva.Node | null) => ev.register(s.id, n)
  };
  switch (s.type) {
    case 'arrow':
      return <Arrow {...common} points={s.points} stroke={s.color} fill={s.color} strokeWidth={s.width} pointerLength={s.width * 3 + 6} pointerWidth={s.width * 3 + 6} lineCap="round" lineJoin="round" dash={s.dash ? [s.width * 3, s.width * 2] : undefined} hitStrokeWidth={Math.max(12, s.width + 8)} />;
    case 'line':
      return <Line {...common} points={s.points} stroke={s.color} strokeWidth={s.width} lineCap="round" dash={s.dash ? [s.width * 3, s.width * 2] : undefined} hitStrokeWidth={Math.max(12, s.width + 8)} />;
    case 'rect':
      return <Rect {...common} x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.color} strokeWidth={s.width} fill={s.fill} cornerRadius={2} dash={s.dash ? [s.width * 3, s.width * 2] : undefined} strokeScaleEnabled={false} />;
    case 'ellipse':
      return <Ellipse {...common} x={s.x + s.w / 2} y={s.y + s.h / 2} radiusX={Math.abs(s.w / 2)} radiusY={Math.abs(s.h / 2)} stroke={s.color} strokeWidth={s.width} fill={s.fill} dash={s.dash ? [s.width * 3, s.width * 2] : undefined} strokeScaleEnabled={false} />;
    case 'cover':
    case 'redact':
      return <Rect {...common} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} opacity={1} />;
    case 'blur':
      return <BlurNode s={s} img={img} ev={ev} />;
    case 'text':
      return (
        <Label {...common} x={s.x} y={s.y} onDblClick={() => ev.onDblText(s.id)}>
          <Tag fill={s.bg || 'rgba(0,0,0,0)'} cornerRadius={4} shadowColor="black" shadowBlur={s.bg ? 3 : 0} shadowOpacity={0.18} shadowOffsetY={1} />
          <Text text={s.text || ' '} fontSize={s.size} fontStyle="600" fontFamily="Segoe UI, Inter, system-ui, sans-serif" fill={s.color} padding={s.bg ? 6 : 2} lineHeight={1.3} />
        </Label>
      );
    case 'number':
      return (
        <Group {...common} x={s.x} y={s.y}>
          <Circle radius={s.size} fill={s.color} stroke="#fff" strokeWidth={2} shadowColor="black" shadowBlur={4} shadowOpacity={0.3} />
          <Text text={String(s.n)} fontSize={s.size * 1.05} fontStyle="700" fill="#fff" width={s.size * 2} height={s.size * 2} x={-s.size} y={-s.size} align="center" verticalAlign="middle" fontFamily="Segoe UI, Inter, sans-serif" />
        </Group>
      );
    default:
      return null;
  }
}
