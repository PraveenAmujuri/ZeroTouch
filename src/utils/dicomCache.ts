/**
 * 0Touch DICOM IndexedDB Cache
 * Stores recently opened DICOM studies, their metadata, slice counts,
 * and thumbnails so they can be reopened instantly without re-uploading.
 */

export interface CachedDICOMStudy {
  id: string; // hash or unique key
  fileName: string;
  patientName: string;
  patientId: string;
  modality: string;
  studyDate: string;
  seriesDescription: string;
  numberOfFrames: number;
  thumbnailDataUrl?: string;
  timestamp: number;
  // Raw ArrayBuffer stored in IndexedDB Blob
  buffer: ArrayBuffer;
}

const DB_NAME = 'ZeroTouch_DICOM_Cache';
const DB_VERSION = 1;
const STORE_NAME = 'recent_studies';
const MAX_RECENT = 12;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStudyToCache(study: CachedDICOMStudy): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(study);

    // Prune oldest if exceeds MAX_RECENT
    const index = store.index('timestamp');
    const getAllKeysReq = index.getAllKeys();
    getAllKeysReq.onsuccess = () => {
      const keys = getAllKeysReq.result;
      if (keys.length > MAX_RECENT) {
        const toDelete = keys.slice(0, keys.length - MAX_RECENT);
        toDelete.forEach((k) => store.delete(k));
      }
    };
  } catch (err) {
    console.warn('Failed to cache DICOM study:', err);
  }
}

export async function getRecentStudies(): Promise<Omit<CachedDICOMStudy, 'buffer'>[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();
      request.onsuccess = () => {
        const results = (request.result || []).map((s) => ({
          id: s.id,
          fileName: s.fileName,
          patientName: s.patientName,
          patientId: s.patientId,
          modality: s.modality,
          studyDate: s.studyDate,
          seriesDescription: s.seriesDescription,
          numberOfFrames: s.numberOfFrames,
          thumbnailDataUrl: s.thumbnailDataUrl,
          timestamp: s.timestamp,
        }));
        // Sort descending (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getCachedStudyBuffer(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result && request.result.buffer) {
          resolve(request.result.buffer);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
