import type { LiteratureWork } from '../types/work';

const DB_NAME = 'kyoto_call_chinese_reader_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'local_works';
const FALLBACK_KEY = 'kyoto_call_chinese_local_works_fallback_v1';

export interface StoredLocalWork {
  id: string;
  work: LiteratureWork;
  importedAt: string;
  updatedAt: string;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function readFallback(): StoredLocalWork[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallback(items: StoredLocalWork[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export async function listLocalWorks(): Promise<StoredLocalWork[]> {
  if (!hasIndexedDb()) {
    return readFallback();
  }
  try {
    const db = await openDb();
    return await new Promise<StoredLocalWork[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredLocalWork[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback();
  }
}

export async function saveLocalWork(work: LiteratureWork): Promise<StoredLocalWork> {
  const now = new Date().toISOString();
  const existingList = await listLocalWorks();
  const existing = existingList.find((w) => w.id === work.metadata.id);
  const record: StoredLocalWork = {
    id: work.metadata.id,
    work,
    importedAt: existing?.importedAt ?? now,
    updatedAt: now,
  };

  if (!hasIndexedDb()) {
    const filtered = existingList.filter((w) => w.id !== record.id);
    writeFallback([...filtered, record]);
    return record;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return record;
  } catch {
    const filtered = existingList.filter((w) => w.id !== record.id);
    writeFallback([...filtered, record]);
    return record;
  }
}

export async function deleteLocalWork(workId: string): Promise<void> {
  if (!hasIndexedDb()) {
    writeFallback(readFallback().filter((w) => w.id !== workId));
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(workId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeFallback(readFallback().filter((w) => w.id !== workId));
  }
}

export async function exportLocalWorksBackup(): Promise<string> {
  const items = await listLocalWorks();
  return JSON.stringify(
    {
      backupVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      works: items.map((i) => i.work),
    },
    null,
    2
  );
}
