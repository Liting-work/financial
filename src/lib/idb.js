const DB_NAME = 'augu-finance-dashboard'
const DB_VERSION = 1
const STORE_NAME = 'snapshot'
const SNAPSHOT_KEY = 'latest'

let dbPromise = null

function openDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'))
      request.onblocked = () => reject(new Error('IndexedDB 被其它页面占用'))
    })
  }
  return dbPromise
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB 操作失败'))
  })
}

export async function loadSnapshot() {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const record = await requestToPromise(store.get(SNAPSHOT_KEY))
  return record && record.version === DB_VERSION ? record : null
}

export async function saveSnapshot(snapshot) {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  store.put({
    ...snapshot,
    id: SNAPSHOT_KEY,
    version: DB_VERSION,
    savedAt: new Date().toISOString(),
  })
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB 写入失败'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB 写入被中止'))
  })
}

export function getDatabaseInfo() {
  return { name: DB_NAME, store: STORE_NAME, version: DB_VERSION }
}
