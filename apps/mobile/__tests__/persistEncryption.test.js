const mockAsyncStore = new Map();
const mockKeychain = new Map();
const mockState = { keychainDown: false };

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (k) => (mockAsyncStore.has(k) ? mockAsyncStore.get(k) : null)),
    setItem: jest.fn(async (k, v) => mockAsyncStore.set(k, v)),
    removeItem: jest.fn(async (k) => mockAsyncStore.delete(k)),
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

jest.mock('../src/store/reducers', () => (state = { companyName: '' }, action) =>
    action.type === 'SET_NAME' ? { ...state, companyName: action.name } : state,
);

const ROOT = 'persist:root';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
    let configure;
    jest.isolateModules(() => {
        configure = require('../src/store').default;
    });
    const { store, persistor } = configure();
    await new Promise((resolve) => {
        if (persistor.getState().bootstrapped) return resolve();
        const unsub = persistor.subscribe(() => {
            if (persistor.getState().bootstrapped) {
                unsub();
                resolve();
            }
        });
    });
    return store;
}

beforeEach(() => {
    mockAsyncStore.clear();
    mockKeychain.clear();
    mockState.keychainDown = false;
});

test('state is saved encrypted with the per-device key', async () => {
    const store = await boot();
    store.dispatch({ type: 'SET_NAME', name: 'Ama Stores' });
    await wait(50);
    expect(mockAsyncStore.get(ROOT)).toBeDefined();
    expect(mockAsyncStore.get(ROOT)).not.toContain('Ama Stores');
    const again = await boot();
    expect(again.getState().companyName).toBe('Ama Stores');
});

test('with the Keychain down, nothing is saved and the stored copy is kept', async () => {
    const first = await boot();
    first.dispatch({ type: 'SET_NAME', name: 'Ama Stores' });
    await wait(50);
    const saved = mockAsyncStore.get(ROOT);

    mockState.keychainDown = true;
    const store = await boot();
    store.dispatch({ type: 'SET_NAME', name: 'Changed while locked' });
    await wait(50);
    expect(mockAsyncStore.get(ROOT)).toBe(saved);

    mockState.keychainDown = false;
    expect((await boot()).getState().companyName).toBe('Ama Stores');
});

test('state saved by older builds under the legacy key is still read', async () => {
    const Aes = require('crypto-js/aes');
    const legacy = Aes.encrypt(JSON.stringify('Old Shop'), '__test__').toString();
    mockAsyncStore.set(ROOT, JSON.stringify({ companyName: JSON.stringify(legacy), _persist: JSON.stringify({ version: -1, rehydrated: true }) }));
    expect((await boot()).getState().companyName).toBe('Old Shop');
});
