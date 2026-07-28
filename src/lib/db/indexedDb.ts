// ============================================
// Nancy OS — IndexedDB Capture Storage
// Offline-first quick capture (ported from MindDrop)
// ============================================

const DB_NAME = "nancy-capture";
const STORE_NAME = "captures";
const DB_VERSION = 1;

export interface PendingCapture {
  localId: string;
  content: string;
  category: string;
  images: string[];
  audioDataUrl: string | null;
  audioDuration: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCaptures(): Promise<PendingCapture[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("createdAt");
    const request = index.openCursor(null, "prev");
    const records: PendingCapture[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getCapture(localId: string): Promise<PendingCapture | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(localId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveCapture(capture: PendingCapture): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(capture);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCapture(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(localId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSyncs(): Promise<PendingCapture[]> {
  const all = await getAllCaptures();
  return all.filter((c) => !c.synced);
}

export async function markSynced(localId: string): Promise<void> {
  await deleteCapture(localId);
}
