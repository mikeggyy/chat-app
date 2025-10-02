function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

let autoId = 1;

function generateId() {
  autoId += 1;
  return `mock_${autoId}`;
}

class MockDocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this.exists = data !== null && data !== undefined;
    this._data = data ?? null;
  }

  data() {
    return clone(this._data);
  }

  get(field) {
    return this._data ? this._data[field] : undefined;
  }
}

class Query {
  constructor(store, options = {}) {
    this._store = store;
    this._orderBy = options.orderBy ?? null;
    this._direction = options.direction ?? 'asc';
    this._limit = options.limit ?? null;
  }

  orderBy(field, direction = 'asc') {
    return new Query(this._store, {
      orderBy: field,
      direction,
      limit: this._limit,
    });
  }

  limit(limit) {
    return new Query(this._store, {
      orderBy: this._orderBy,
      direction: this._direction,
      limit,
    });
  }

  async get() {
    const docs = [];
    for (const [id, entry] of this._store.entries()) {
      if (!entry.doc) continue;
      docs.push(new MockDocumentSnapshot(id, entry.doc));
    }

    if (this._orderBy) {
      const field = this._orderBy;
      const direction = this._direction === 'desc' ? -1 : 1;
      docs.sort((a, b) => {
        const valueA = a.get(field);
        const valueB = b.get(field);
        if (valueA === valueB) return 0;
        if (valueA === undefined || valueA === null) return 1 * direction;
        if (valueB === undefined || valueB === null) return -1 * direction;
        return valueA > valueB ? direction : -direction;
      });
    }

    if (typeof this._limit === 'number') {
      return { docs: docs.slice(0, this._limit) };
    }

    return { docs };
  }
}

class MockDocumentReference {
  constructor(store, id) {
    this._store = store;
    this.id = id;
    if (!this._store.has(id)) {
      this._store.set(id, { doc: null, subcollections: new Map() });
    }
  }

  async get() {
    const entry = this._store.get(this.id);
    return new MockDocumentSnapshot(this.id, entry.doc);
  }

  async set(data, options = {}) {
    const entry = this._store.get(this.id) ?? { doc: null, subcollections: new Map() };
    entry.doc = options.merge && entry.doc ? { ...entry.doc, ...clone(data) } : clone(data);
    entry.subcollections = entry.subcollections || new Map();
    this._store.set(this.id, entry);
  }

  async delete() {
    this._store.delete(this.id);
  }

  collection(name) {
    const entry = this._store.get(this.id) ?? { doc: null, subcollections: new Map() };
    if (!entry.subcollections) {
      entry.subcollections = new Map();
    }
    if (!entry.subcollections.has(name)) {
      entry.subcollections.set(name, new Map());
    }
    this._store.set(this.id, entry);
    return new MockCollectionReference(entry.subcollections.get(name));
  }
}

class MockCollectionReference extends Query {
  constructor(store) {
    super(store);
    this._store = store;
  }

  doc(id) {
    const documentId = id ?? generateId();
    return new MockDocumentReference(this._store, documentId);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data, { merge: false });
    return { id: docRef.id };
  }

  async get() {
    return super.get();
  }
}

export function createMockFirestore() {
  const rootCollections = new Map();

  function ensureCollection(name) {
    if (!rootCollections.has(name)) {
      rootCollections.set(name, new Map());
    }
    return rootCollections.get(name);
  }

  const firestore = {
    collection(name) {
      return new MockCollectionReference(ensureCollection(name));
    },
    batch() {
      const operations = [];
      return {
        set(docRef, data, options) {
          operations.push(() => docRef.set(data, options));
        },
        delete(docRef) {
          operations.push(() => docRef.delete());
        },
        async commit() {
          for (const operation of operations) {
            await operation();
          }
        },
      };
    },
    __getDocument(pathSegments) {
      const [collectionName, docId, subCollectionName, subDocId] = pathSegments;
      const collectionStore = rootCollections.get(collectionName);
      if (!collectionStore) return null;
      const docEntry = collectionStore.get(docId);
      if (!docEntry) return null;
      if (!subCollectionName) {
        return clone(docEntry.doc);
      }
      const subStore = docEntry.subcollections?.get(subCollectionName);
      if (!subStore) return null;
      const subEntry = subStore.get(subDocId);
      return subEntry ? clone(subEntry.doc) : null;
    },
    __reset() {
      rootCollections.clear();
    },
  };

  const FieldValue = {
    serverTimestamp() {
      return Date.now();
    },
  };

  return { firestore, FieldValue };
}

