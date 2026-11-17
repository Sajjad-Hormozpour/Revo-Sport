import { useEffect, useState } from "react";
import { API_BASE, getToken } from "./remote";

const DB = "revofit-media-v1";
const STORE = "blobs";

/** در حالت سرور، فایل‌ها روی سرور ذخیره می‌شوند تا همهٔ دستگاه‌ها ببینند */
let remoteMode = false;
export function setRemoteMedia(v: boolean) {
  remoteMode = v;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  if (remoteMode) {
    const token = getToken();
    const r = await fetch(`${API_BASE}media/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: blob,
    });
    if (!r.ok) {
      let msg = "آپلود روی سرور ناموفق بود";
      try {
        msg = ((await r.json()) as { error?: string }).error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return;
  }
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => {
      db.close();
      res();
    };
    tx.onerror = () => {
      db.close();
      rej(tx.error);
    };
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  if (remoteMode) {
    try {
      const r = await fetch(`${API_BASE}media/${encodeURIComponent(id)}`);
      return r.ok ? await r.blob() : null;
    } catch {
      return null;
    }
  }
  try {
    const db = await openDb();
    return new Promise((res) => {
      const tx = db.transaction(STORE, "readonly");
      const q = tx.objectStore(STORE).get(id);
      q.onsuccess = () => {
        db.close();
        res((q.result as Blob) ?? null);
      };
      q.onerror = () => {
        db.close();
        res(null);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  if (remoteMode) {
    try {
      const token = getToken();
      await fetch(`${API_BASE}media/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((res) => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

const urlCache = new Map<string, string>();

export async function blobUrl(id: string): Promise<string | null> {
  if (remoteMode) return `${API_BASE}media/${encodeURIComponent(id)}`;
  if (urlCache.has(id)) return urlCache.get(id)!;
  const b = await getBlob(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}

export function useMediaUrl(mediaId?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!mediaId) {
      setUrl(null);
      return;
    }
    blobUrl(mediaId).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [mediaId]);
  return url;
}

export function isYoutube(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

export function youtubeEmbed(url: string): string {
  try {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split(/[?&#]/)[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    const u = new URL(url);
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
    if (url.includes("/embed/")) return url;
    if (url.includes("/shorts/")) {
      const id2 = url.split("/shorts/")[1].split(/[?&#/]/)[0];
      return `https://www.youtube.com/embed/${id2}`;
    }
  } catch {
    /* ignore */
  }
  return url;
}

export function isAparat(url: string): boolean {
  return /aparat\.com/.test(url);
}

export function aparatEmbed(url: string): string {
  try {
    const m = url.match(/aparat\.com\/v\/([A-Za-z0-9]+)/);
    if (m) return `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame`;
  } catch {
    /* ignore */
  }
  return url;
}
