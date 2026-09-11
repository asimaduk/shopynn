'use client';

import { Action, Middleware, ThunkAction, configureStore, createSelector } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import apiService from 'src/store/apiService';
import rootReducer from './rootReducer';
import { dynamicMiddleware } from './middleware';

import {
	persistStore,
	persistReducer,
	FLUSH,
	REHYDRATE,
	PAUSE,
	PERSIST,
	PURGE,
	REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { apiServicePersistTransform, slimApiServiceForOfflineCatalog } from './persistApiTransform';

// Infer the `RootState` type from the root reducer
export type RootState = ReturnType<typeof rootReducer>;

const middlewares: Middleware[] = [apiService.middleware, dynamicMiddleware];

/** Slices injected when feature modules load; if persisted, rehydrate can run before inject and triggers combineSlices "unexpected key" warnings. */
const LAZY_PERSIST_BLACKLIST = [
	'newsales',
	'pendingsales',
	'fuseMessage',
] as const;

const persistConfig = {
	key: 'root',
	storage,
	blacklist: [...LAZY_PERSIST_BLACKLIST],
	transforms: [apiServicePersistTransform],
	migrate: (persistedState: RootState | undefined) => {
		let next = { ...(persistedState ?? {}) } as Record<string, unknown>;
		// Remove legacy "navigation" key (sidebar now uses config directly)
		if (next && 'navigation' in next) {
			const { navigation: _, ...rest } = next;
			next = rest as Record<string, unknown>;
		}
		for (const key of LAZY_PERSIST_BLACKLIST) {
			delete next[key];
		}
		// Slim bloated apiService from older persist full-cache versions
		if (next?.apiService) {
			next = {
				...next,
				apiService: slimApiServiceForOfflineCatalog(next.apiService) as Record<string, unknown>
			};
		}
		return Promise.resolve(next as RootState);
	}
};

const persistedReducer = persistReducer(
	persistConfig as never,
	rootReducer as never
) as unknown as typeof rootReducer;

export const makeStore = (preloadedState?: Partial<RootState>) => {
	const store = configureStore({
		// reducer: rootReducer,
		reducer: persistedReducer,
		middleware: (getDefaultMiddleware) => getDefaultMiddleware({
			serializableCheck: {
			  ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
			},
		  }).concat(middlewares),
		preloadedState
	});
	// configure listeners using the provided defaults
	// optional, but required for `refetchOnFocus`/`refetchOnReconnect` behaviors
	setupListeners(store.dispatch);
	let persistor = persistStore(store);
	return { store, persistor };
};

export const store = makeStore();

// Infer the type of `store`
export type AppStore = typeof store.store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ThunkReturnType = void> = ThunkAction<ThunkReturnType, RootState, unknown, Action>;
export type AppAction<R = Promise<void>> = Action<string> | ThunkAction<R, RootState, unknown, Action<string>>;

export const createAppSelector = createSelector.withTypes<RootState>();

export default store;
