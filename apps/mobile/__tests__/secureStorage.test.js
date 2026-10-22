const mockAsyncStore = new Map();
const mockKeychain = new Map();
const mockState = { keychainFails: 0 };

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (k) => (mockAsyncStore.has(k) ? mockAsyncStore.get(k) : null)),
    setItem: jest.fn(async (k, v) => mockAsyncStore.set(k, v)),
    removeItem: jest.fn(async (k) => mockAsyncStore.delete(k)),
    multiGet: jest.fn(async (keys) => keys.map((k) => [k, mockAsyncStore.has(k) ? mockAsyncStore.get(k) : null])),
    multiRemove: jest.fn(async (keys) => keys.forEach((k) => mockAsyncStore.delete(k))),
}));

jest.mock('react-native-keychain', () => {
    const maybeFail = () => {
        if (mockState.keychainFails > 0) {
            mockState.keychainFails -= 1;
            throw new Error('keystore unavailable');
        }
    };
    return {
        ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly' },
        getGenericPassword: jest.fn(async ({ service }) => {
            maybeFail();
            return mockKeychain.has(service) ? { password: mockKeychain.get(service) } : false;
        }),
        setGenericPassword: jest.fn(async (_user, value, { service }) => {
            maybeFail();
            mockKeychain.set(service, value);
            return true;
        }),
        resetGenericPassword: jest.fn(async ({ service }) => mockKeychain.delete(service)),
    };
});

function freshModule() {
    let mod;
    jest.isolateModules(() => {
        mod = require('../src/utils/secureStorage');
    });
    return mod;
}

beforeEach(() => {
    mockAsyncStore.clear();
    mockKeychain.clear();
    mockState.keychainFails = 0;
});

test('tokens go to the Keychain, never AsyncStorage', async () => {
    const s = freshModule();
    await s.setTokens('access-1', 'refresh-1');
    expect(mockKeychain.get('com.shopynn.auth.access')).toBe('access-1');
    expect([...mockAsyncStore.values()]).not.toContain('access-1');
    expect(await freshModule().getAccessToken()).toBe('access-1');
});

test('a transient Keychain error is retried', async () => {
    const s = freshModule();
    mockState.keychainFails = 1;
    await s.setTokens('access-2');
    expect(mockKeychain.get('com.shopynn.auth.access')).toBe('access-2');
});

test('when the Keychain keeps failing, tokens stay in memory only', async () => {
    const s = freshModule();
    mockState.keychainFails = 100;
    await s.setTokens('access-3', 'refresh-3');
    expect(await s.getAccessToken()).toBe('access-3');
    expect(mockAsyncStore.size).toBe(0);
    mockState.keychainFails = 0;
    expect(await freshModule().getAccessToken()).toBeNull();
});

test('a failed Keychain read is not cached as signed out', async () => {
    mockKeychain.set('com.shopynn.auth.access', 'access-4');
    const s = freshModule();
    mockState.keychainFails = 2;
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.getAccessToken()).toBe('access-4');
});

test('plaintext tokens from older builds move to the Keychain and are deleted', async () => {
    mockAsyncStore.set('BRS_ACCESS_TOKEN', 'old-access');
    mockAsyncStore.set('BRS_REFRESH_TOKEN', 'old-refresh');
    mockAsyncStore.set('BRS_KEYCHAIN_MIGRATION_V2', 'true');
    const s = freshModule();
    expect(await s.getAccessToken()).toBe('old-access');
    expect(mockKeychain.get('com.shopynn.auth.refresh')).toBe('old-refresh');
    expect(mockAsyncStore.size).toBe(0);
});
