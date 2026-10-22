const mockAsyncStore = new Map();
const mockKeychain = new Map();
const mockState = { keychainDown: false };

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (k) => (mockAsyncStore.has(k) ? mockAsyncStore.get(k) : null)),
    setItem: jest.fn(async (k, v) => mockAsyncStore.set(k, v)),
    removeItem: jest.fn(async (k) => mockAsyncStore.delete(k)),
    multiRemove: jest.fn(async (keys) => keys.forEach((k) => mockAsyncStore.delete(k))),
}));

jest.mock('react-native-keychain', () => ({
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly' },
    getGenericPassword: jest.fn(async ({ service }) => {
        if (mockState.keychainDown) throw new Error('keystore unavailable');
        return mockKeychain.has(service) ? { password: mockKeychain.get(service) } : false;
    }),
    setGenericPassword: jest.fn(async (_u, value, { service }) => {
        if (mockState.keychainDown) throw new Error('keystore unavailable');
        mockKeychain.set(service, value);
        return true;
    }),
}));

// Stand-in cipher: tags the text with the key so tests can tell what was encrypted, and with what.
jest.mock('react-native-aes-crypto', () => ({
    randomKey: jest.fn(async (n) => `k${n}-${Math.random()}`),
    encrypt: jest.fn(async (text, key) => Buffer.from(`${key}|${text}`).toString('base64')),
    decrypt: jest.fn(async (cipher, key) => {
        const plain = Buffer.from(cipher, 'base64').toString();
        if (!plain.startsWith(`${key}|`)) throw new Error('bad key');
        return plain.slice(key.length + 1);
    }),
}));

const KEY = 'SHOPYNN_PENDING_SALES';

function freshModule() {
    let mod;
    jest.isolateModules(() => {
        mod = require('../src/utils/secureOfflineStorage');
    });
    return mod;
}

beforeEach(() => {
    mockAsyncStore.clear();
    mockKeychain.clear();
    mockState.keychainDown = false;
});

const stored = () => mockAsyncStore.get(KEY);

test('lists are stored encrypted and read back', async () => {
    const s = freshModule();
    await s.writeSecureList(KEY, [{ id: 'a', amount: 10 }]);
    expect(stored()).toMatch(/^ENC::/);
    expect(stored()).not.toContain('amount');
    expect(await freshModule().readSecureList(KEY)).toEqual([{ id: 'a', amount: 10 }]);
});

test('with the Keychain down, nothing is written in plaintext', async () => {
    mockState.keychainDown = true;
    const s = freshModule();
    await s.writeSecureList(KEY, [{ id: 'a', customer: 'Ama' }]);
    expect(stored()).toBeUndefined();
    expect(await s.readSecureList(KEY)).toEqual([{ id: 'a', customer: 'Ama' }]);
});

test('an unreadable stored queue is never overwritten, and new sales merge in later', async () => {
    await freshModule().writeSecureList(KEY, [{ id: 'old1' }, { id: 'old2' }]);
    const before = stored();

    mockState.keychainDown = true;
    const s = freshModule();
    const list = await s.readSecureList(KEY);
    expect(list).toEqual([]);
    list.push({ id: 'new1' });
    await s.writeSecureList(KEY, list);
    expect(stored()).toBe(before);

    mockState.keychainDown = false;
    expect(await s.readSecureList(KEY)).toEqual([{ id: 'old1' }, { id: 'old2' }, { id: 'new1' }]);
    expect(await freshModule().readSecureList(KEY)).toEqual([{ id: 'old1' }, { id: 'old2' }, { id: 'new1' }]);
});

test('a sale uploaded while the Keychain was down does not come back', async () => {
    await freshModule().writeSecureList(KEY, [{ id: 'old1' }]);
    mockState.keychainDown = true;
    const s = freshModule();
    await s.writeSecureList(KEY, [...(await s.readSecureList(KEY)), { id: 'new1' }, { id: 'new2' }]);
    await s.writeSecureList(KEY, (await s.readSecureList(KEY)).filter((i) => i.id !== 'new1'));

    mockState.keychainDown = false;
    await s.writeSecureList(KEY, [...(await s.readSecureList(KEY)), { id: 'new3' }]);
    expect(await freshModule().readSecureList(KEY)).toEqual([{ id: 'old1' }, { id: 'new2' }, { id: 'new3' }]);
});

test('plaintext lists from older builds are re-encrypted on read', async () => {
    mockAsyncStore.set(KEY, JSON.stringify([{ id: 'legacy' }]));
    expect(await freshModule().readSecureList(KEY)).toEqual([{ id: 'legacy' }]);
    expect(stored()).toMatch(/^ENC::/);
});
