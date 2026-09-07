import { combineSlices } from '@reduxjs/toolkit';
import apiService from './apiService';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// @ts-expect-error Intentionally empty for declaration merging
export interface LazyLoadedSlices {}

// Navigation is read directly from config in useNavigation (no store).
export const rootReducer = combineSlices(
	/**
	 * Lazy loaded slices
	 */
	{
		[apiService.reducerPath]: apiService.reducer
	}
).withLazyLoadedSlices<LazyLoadedSlices>();

const persistConfig = {
	key: 'root',
	storage,
}

const persistedReducer = persistReducer(persistConfig, rootReducer);

export default rootReducer;
// export default persistedReducer;
