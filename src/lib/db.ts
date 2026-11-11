// Storage adapter. Windows app: SQLite (records) + PNG files in the app data folder.
// Browser demo: IndexedDB. Both expose the same small API.
import type { Collection } from './types';
import { isTauri } from './platform';

export interface Db {
  all<T>(col: Collection): Promise<T[]>;
  put(col: Collection, id: string, value: unknown): Promise<void>;
  del(col: Collection, id: string): Promise<void>;
  putBlob(key: string, blob: Blob): Promise<void>;
  getBlob(key: string): Promise<Blob | undefined>;
  delBlob(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

// ---------------- IndexedDB (browser) ----------------
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function openIdb(): Promise<Db> {
  const open = indexedDB.open('bakit', 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    const rec = db.createObjectStore('records', { keyPath: ['col', 'id'] });
    rec.createIndex('col', 'col');
    db.createObjectStore('blobs');
  };
  const db = await req(open);
  const store = (name: string, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    async all<T>(col: Collection) {
      const rows = await req(store('records', 'readonly').index('col').getAll(col));
      return rows.map((r: { data: T }) => r.data);
    },
    async put(col, id, value) {
      await req(store('records', 'readwrite').put({ col, id, data: value }));
    },
    async del(col, id) {
      await req(store('records', 'readwrite').delete([col, id]));
    },
    async putBlob(key, blob) {
      await req(store('blobs', 'readwrite').put(blob, key));
    },
    async getBlob(key) {
      return (await req(store('blobs', 'readonly').get(key))) as Blob | undefined;
    },
    async delBlob(key) {
      await req(store('blobs', 'readwrite').delete(key));
    },
    async clearAll() {
      await req(store('records', 'readwrite').clear());
      await req(store('blobs', 'readwrite').clear());
    }
  };
}

// ---------------- SQLite + files (Tauri) ----------------
async function openTauri(): Promise<Db> {
  const Database = (await import('@tauri-apps/plugin-sql')).default;
  const fs = await import('@tauri-apps/plugin-fs');
  const base = { baseDir: fs.BaseDirectory.AppData };
  const sql = await Database.load('sqlite:bakit.db');
  await sql.execute(
    'CREATE TABLE IF NOT EXISTS records (col TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (col, id))'
  );
  if (!(await fs.exists('images', base))) await fs.mkdir('images', { ...base, recursive: true });
  const file = (key: string) => `images/${key}.png`;
  return {
    async all<T>(col: Collection) {
      const rows = await sql.select<Array<{ json: string }>>('SELECT json FROM records WHERE col = $1', [col]);
      return rows.map((r) => JSON.parse(r.json) as T);
    },
    async put(col, id, value) {
      await sql.execute(
        'INSERT INTO records (col, id, json, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT(col, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at',
        [col, id, JSON.stringify(value), new Date().toISOString()]
      );
    },
    async del(col, id) {
      await sql.execute('DELETE FROM records WHERE col = $1 AND id = $2', [col, id]);
    },
    async putBlob(key, blob) {
      // Safe write: write a temp file, then rename over the target so a crash never leaves a half-written image.
      const tmp = `images/${key}.tmp`;
      await fs.writeFile(tmp, new Uint8Array(await blob.arrayBuffer()), base);
      await fs.rename(tmp, file(key), { oldPathBaseDir: fs.BaseDirectory.AppData, newPathBaseDir: fs.BaseDirectory.AppData });
    },
    async getBlob(key) {
      if (!(await fs.exists(file(key), base))) return undefined;
      const bytes = await fs.readFile(file(key), base);
      return new Blob([bytes], { type: 'image/png' });
    },
    async delBlob(key) {
      if (await fs.exists(file(key), base)) await fs.remove(file(key), base);
    },
    async clearAll() {
      await sql.execute('DELETE FROM records');
      await fs.remove('images', { ...base, recursive: true });
      await fs.mkdir('images', { ...base, recursive: true });
    }
  };
}

let dbPromise: Promise<Db> | null = null;
export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = isTauri ? openTauri() : openIdb();
  return dbPromise;
}

// Object URL cache for images so lists and editors share decoded blobs.
const urlCache = new Map<string, string>();
export async function blobUrl(key: string): Promise<string | undefined> {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await (await getDb()).getBlob(key);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}
export function forgetBlobUrl(key: string) {
  const u = urlCache.get(key);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(key);
}
