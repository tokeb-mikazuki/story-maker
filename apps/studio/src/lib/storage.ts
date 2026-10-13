// 브라우저 저장소. 프로젝트(패키지 + 이미지)는 용량이 커질 수 있어 IndexedDB,
// 회차 기록·플레이 세이브는 작아서 localStorage.

import type { MetaData, MetaStore, RunState, StoryPackage } from '@engine';
import { currentAccountId } from './auth';
import { migrateImages } from './migrate';

export interface ProjectRecord {
  id: string;
  pkg: StoryPackage;
  updatedAt: number;
  /** 만든 계정. 없으면 로그인하지 않고 만든 게스트 작업 */
  ownerId?: string;
}

const DB_NAME = 'story-workshop';
const STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | undefined;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB 없음');
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** IndexedDB를 못 쓰는 환경(사생활 보호 모드, 일부 임베드)에서는 이 탭 안에서만 유지되는 메모리 저장소로 대신한다 */
const memory = new Map<string, ProjectRecord>();
export let storageIsVolatile = false;

async function withFallback<T>(idb: () => Promise<T>, mem: () => T): Promise<T> {
  if (!storageIsVolatile) {
    try {
      return await idb();
    } catch (e) {
      console.warn('IndexedDB를 쓸 수 없어 임시 저장소로 전환합니다', e);
      storageIsVolatile = true;
    }
  }
  return mem();
}

export const projects = {
  list: () =>
    withFallback(
      () => tx<ProjectRecord[]>('readonly', (s) => s.getAll()),
      () => [...memory.values()],
    ).then((xs) => xs.sort((a, b) => b.updatedAt - a.updatedAt)),
  get: (id: string) =>
    withFallback(
      () => tx<ProjectRecord | undefined>('readonly', (s) => s.get(id)),
      () => memory.get(id),
    ).then((rec) => (rec ? { ...rec, pkg: migrateImages(rec.pkg) } : rec)),
  /** 저장. 이미 있는 작품은 만든 사람을 그대로 두고, 새 작품은 지금 로그인한 계정의 것이 된다 */
  put: async (pkg: StoryPackage) => {
    const prev = memory.get(pkg.meta.id) ?? (await withFallback(() => tx<ProjectRecord | undefined>('readonly', (s) => s.get(pkg.meta.id)), () => undefined));
    const rec: ProjectRecord = { id: pkg.meta.id, pkg, updatedAt: Date.now(), ownerId: prev ? prev.ownerId : currentAccountId() };
    memory.set(rec.id, rec);
    return withFallback(
      () => tx('readwrite', (s) => s.put(rec)).then(() => undefined),
      () => undefined,
    );
  },
  /** 로그인 전에 만든 게스트 작업을 이 계정으로 옮긴다. 옮긴 개수를 돌려준다 */
  claimGuest: async (ownerId: string) => {
    const all = await projects.list();
    const guest = all.filter((r) => !r.ownerId);
    for (const r of guest) {
      const rec = { ...r, ownerId };
      memory.set(rec.id, rec);
      await withFallback(
        () => tx('readwrite', (s) => s.put(rec)).then(() => undefined),
        () => undefined,
      );
    }
    return guest.length;
  },
  remove: (id: string) => {
    memory.delete(id);
    return withFallback(
      () => tx('readwrite', (s) => s.delete(id)).then(() => undefined),
      () => undefined,
    );
  },
};

// ───────────────────────── localStorage ─────────────────────────

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등 — 저장 실패해도 플레이는 계속
  }
}

/** 회차 간 기록(도전과제, 본 엔딩, 메타 변수). prefix로 테스트 플레이와 분리 */
export class LocalMetaStore implements MetaStore {
  constructor(private readonly prefix = 'meta:') {}
  load(id: string) {
    return readJson<MetaData>(this.prefix + id);
  }
  save(id: string, meta: MetaData) {
    writeJson(this.prefix + id, meta);
  }
  clear(id: string) {
    localStorage.removeItem(this.prefix + id);
  }
}

export const saves = {
  load: (id: string) => readJson<RunState>(`save:${id}`),
  save: (id: string, state: RunState) => writeJson(`save:${id}`, state),
  clear: (id: string) => localStorage.removeItem(`save:${id}`),
};

/** 에디터 화면 설정(꾸러미 펼침, 묶어 보기 방식 등) */
export const prefs = {
  get: (key: string) => readJson<string>(`pref:${key}`),
  set: (key: string, value: string | undefined) => (value === undefined ? writeJson(`pref:${key}`, null) : writeJson(`pref:${key}`, value)),
};