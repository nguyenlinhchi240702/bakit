// Routes pasted / dropped images. The open item or task can claim them; otherwise they become new screenshots.
import { saveCapture } from './capture';

type Handler = (blobs: Blob[], source: 'paste' | 'file') => boolean;
const stack: Handler[] = [];

export function pushImageHandler(h: Handler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

export async function routeImages(blobs: Blob[], source: 'paste' | 'file', names?: string[]) {
  if (!blobs.length) return;
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i](blobs, source)) return;
  for (let k = 0; k < blobs.length; k++) await saveCapture(blobs[k], source, names?.[k]);
}

export function imagesFromClipboard(e: ClipboardEvent): Blob[] {
  const out: Blob[] = [];
  for (const it of Array.from(e.clipboardData?.items || [])) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** Toolbar "Dán ảnh" button: read the clipboard directly. Returns false when it holds no image. */
export async function readClipboardImages(): Promise<Blob[] | null> {
  try {
    const items = await navigator.clipboard.read();
    const out: Blob[] = [];
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith('image/'));
      if (type) out.push(await it.getType(type));
    }
    return out;
  } catch {
    return null;
  }
}
