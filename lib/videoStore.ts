/**
 * On-device persistence for reference videos (IndexedDB).
 * Videos never leave the device — this is what makes repeat practice
 * instant while keeping server storage at zero.
 *
 * All read paths are no-throw: when IndexedDB is unavailable (private
 * browsing), callers fall back to session-only behavior.
 */

export interface StoredVideo {
  key: string;             // identityKey from videoIdentity.ts
  blob: Blob;
  fileName: string;
  songName: string;
  thumbnailUrl?: string;
  bytes: number;
  lastUsedAt: number;      // epoch ms — bumped on get
}

export type StoredVideoMeta = Omit<StoredVideo, "blob">;

const DB_NAME = "trace-videos";
const STORE   = "videos";
const DEFAULT_BUDGET_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  }));
}

/**
 * Stored shape: video bytes live as ArrayBuffer + MIME type rather than a
 * Blob — Blobs in IndexedDB are unreliable on Safari, and buffers clone
 * cleanly everywhere. Blob is reconstructed on read.
 */
interface StoredRecord {
  key: string;
  buf: ArrayBuffer;
  type: string;
  fileName: string;
  songName: string;
  thumbnailUrl?: string;
  bytes: number;
  lastUsedAt: number;
}

function toVideo({ buf, type, ...rest }: StoredRecord): StoredVideo {
  return { ...rest, blob: new Blob([buf], { type }) };
}

let persistRequested = false;

/**
 * Ask the browser to make this origin's storage persistent, so saved videos
 * survive eviction under storage pressure. Without it iOS can silently clear
 * IndexedDB and the user's videos vanish between sessions.
 *
 * Best-effort and fire-once: the browser may grant, deny, or ignore it, and
 * denial is not an error worth surfacing.
 */
async function requestPersistentStorage(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // Unsupported or blocked — storage is simply evictable.
  }
}

export async function putVideo(
  v: Omit<StoredVideo, "bytes" | "lastUsedAt">,
): Promise<void> {
  if (!idbAvailable()) return;
  void requestPersistentStorage();
  try {
    const { blob, ...rest } = v;
    const buf = await blob.arrayBuffer();
    const record: StoredRecord = {
      ...rest, buf, type: blob.type,
      bytes: buf.byteLength, lastUsedAt: Date.now(),
    };
    await tx("readwrite", s => s.put(record));
  } catch {
    // Quota or private-browsing failure — video stays session-only.
  }
}

export async function getVideo(key: string): Promise<StoredVideo | null> {
  if (!idbAvailable()) return null;
  try {
    const rec = await tx<StoredRecord | undefined>("readonly", s => s.get(key));
    if (!rec) return null;
    const bumped = { ...rec, lastUsedAt: Date.now() };
    await tx("readwrite", s => s.put(bumped));
    return toVideo(bumped);
  } catch {
    return null;
  }
}

export async function listVideos(): Promise<StoredVideoMeta[]> {
  if (!idbAvailable()) return [];
  try {
    const all = await tx<StoredRecord[]>("readonly", s => s.getAll());
    return all
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .map(r => ({
        key: r.key, fileName: r.fileName, songName: r.songName,
        ...(r.thumbnailUrl ? { thumbnailUrl: r.thumbnailUrl } : {}),
        bytes: r.bytes, lastUsedAt: r.lastUsedAt,
      }));
  } catch {
    return [];
  }
}

export async function deleteVideo(key: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await tx("readwrite", s => s.delete(key));
  } catch {
    // ignore
  }
}

/**
 * Videos to offer for deletion when stored bytes exceed the budget,
 * least-recently-used first. Callers MUST confirm with the user before
 * calling deleteVideo — never evict silently.
 */
export async function evictionCandidates(
  budgetBytes: number = DEFAULT_BUDGET_BYTES,
): Promise<StoredVideoMeta[]> {
  const metas = await listVideos(); // most recent first
  const total = metas.reduce((sum, m) => sum + m.bytes, 0);
  if (total <= budgetBytes) return [];
  let excess = total - budgetBytes;
  const candidates: StoredVideoMeta[] = [];
  for (const m of [...metas].reverse()) { // oldest first
    if (excess <= 0) break;
    candidates.push(m);
    excess -= m.bytes;
  }
  return candidates;
}
