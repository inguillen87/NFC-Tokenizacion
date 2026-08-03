"use client";

import {
  canonicalOfflineSunPath,
  isOfflineSunScanId,
  isOfflineSunStatus,
  normalizeOfflineSunParams,
  offlineSunIdFromParams,
  type OfflinePublicProduct,
  type OfflineSunParams,
  type OfflineSunStatus,
} from "../../lib/offline-sun-contract";

export const OFFLINE_DB_NAME = "nexid-offline-level1";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_QUEUE_STORE = "pending-sun-scans";
export const OFFLINE_PRODUCT_STORE = "public-products";
const MAX_CACHED_PRODUCTS = 50;
const MAX_CACHED_PRODUCT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type OfflineSunRecord = {
  id: string;
  schemaVersion: 1;
  params: OfflineSunParams;
  capturedPath: string;
  capturedAt: string;
  lastSeenAt: string;
  updatedAt: string;
  duplicateCount: number;
  attempts: number;
  status: OfflineSunStatus;
  verdict?: "MESSAGE_VALID" | "MESSAGE_NOT_VALID" | "REPLAY_SUSPECT";
  resultTitle?: string;
  resultMessage?: string;
  checkedAt?: string;
  publicProduct?: OfflinePublicProduct;
  lastError?: "network_unavailable" | "rate_limited" | "sync_unavailable";
};

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("offline_storage_request_failed")), { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("offline_storage_aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error || new Error("offline_storage_failed")), { once: true });
  });
}

function openOfflineDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve<IDBDatabase | null>(null);
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_PRODUCT_STORE)) {
        db.createObjectStore(OFFLINE_PRODUCT_STORE, { keyPath: "bid" });
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("offline_storage_open_failed")), { once: true });
  });
}

export async function listOfflineSunRecords() {
  const db = await openOfflineDb();
  if (!db) return [] as OfflineSunRecord[];
  try {
    const transaction = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const records = await requestResult(transaction.objectStore(OFFLINE_QUEUE_STORE).getAll()) as OfflineSunRecord[];
    await transactionComplete(transaction);
    const checked = await Promise.all(records.map(async (record) => {
      if (!record || record.schemaVersion !== 1 || !isOfflineSunScanId(record.id) || !isOfflineSunStatus(record.status)) return null;
      const normalized = normalizeOfflineSunParams(record.params);
      if (!normalized.ok || await offlineSunIdFromParams(normalized.params) !== record.id) return null;
      const capturedAt = Number.isFinite(Date.parse(record.capturedAt)) ? record.capturedAt : new Date().toISOString();
      const lastSeenAt = Number.isFinite(Date.parse(record.lastSeenAt)) ? record.lastSeenAt : capturedAt;
      const updatedAt = Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : lastSeenAt;
      return {
        ...record,
        params: normalized.params,
        capturedPath: canonicalOfflineSunPath(normalized.params),
        capturedAt,
        lastSeenAt,
        updatedAt,
        duplicateCount: Math.min(10_000, Math.max(0, Number(record.duplicateCount) || 0)),
        attempts: Math.min(1_000, Math.max(0, Number(record.attempts) || 0)),
      } satisfies OfflineSunRecord;
    }));
    return checked
      .filter((record): record is OfflineSunRecord => Boolean(record))
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  } finally {
    db.close();
  }
}

export async function putOfflineSunRecord(record: OfflineSunRecord) {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    const transaction = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    transaction.objectStore(OFFLINE_QUEUE_STORE).put(record);
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function removeOfflineSunRecord(id: string) {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    const transaction = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    transaction.objectStore(OFFLINE_QUEUE_STORE).delete(id);
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function cacheOfflinePublicProduct(product: OfflinePublicProduct) {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    const transaction = db.transaction(OFFLINE_PRODUCT_STORE, "readwrite");
    transaction.objectStore(OFFLINE_PRODUCT_STORE).put(product);
    await transactionComplete(transaction);

    const readTransaction = db.transaction(OFFLINE_PRODUCT_STORE, "readonly");
    const products = await requestResult(readTransaction.objectStore(OFFLINE_PRODUCT_STORE).getAll()) as OfflinePublicProduct[];
    await transactionComplete(readTransaction);
    const expiresBefore = Date.now() - MAX_CACHED_PRODUCT_AGE_MS;
    const expiredBids = products
      .filter((candidate) => {
        const cachedAt = Date.parse(candidate.cachedAt || "");
        return candidate.bid !== product.bid && (!Number.isFinite(cachedAt) || cachedAt < expiresBefore);
      })
      .map((candidate) => candidate.bid);
    const survivors = products
      .filter((candidate) => candidate.bid === product.bid || !expiredBids.includes(candidate.bid))
      .sort((left, right) => String(right.cachedAt).localeCompare(String(left.cachedAt)));
    const overflowBids = survivors.slice(MAX_CACHED_PRODUCTS).filter((candidate) => candidate.bid !== product.bid).map((candidate) => candidate.bid);
    const bidsToDelete = [...new Set([...expiredBids, ...overflowBids])];
    if (bidsToDelete.length) {
      const pruneTransaction = db.transaction(OFFLINE_PRODUCT_STORE, "readwrite");
      const store = pruneTransaction.objectStore(OFFLINE_PRODUCT_STORE);
      bidsToDelete.forEach((bid) => store.delete(bid));
      await transactionComplete(pruneTransaction);
    }
  } finally {
    db.close();
  }
}

export async function getOfflinePublicProduct(bid: string) {
  const db = await openOfflineDb();
  if (!db) return null;
  try {
    const transaction = db.transaction(OFFLINE_PRODUCT_STORE, "readonly");
    const product = await requestResult(transaction.objectStore(OFFLINE_PRODUCT_STORE).get(bid)) as OfflinePublicProduct | undefined;
    await transactionComplete(transaction);
    if (!product || !Number.isFinite(Date.parse(product.cachedAt)) || Date.parse(product.cachedAt) < Date.now() - MAX_CACHED_PRODUCT_AGE_MS) {
      return null;
    }
    return product;
  } finally {
    db.close();
  }
}
