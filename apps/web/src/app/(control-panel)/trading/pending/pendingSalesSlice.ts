import { createSlice, WithSlice } from '@reduxjs/toolkit';
import rootReducer from '@/store/rootReducer';
import { readLocalJson, writeLocalJson } from '../offlineStorage';

type initialStateProps = {
	data: any[];
};

const initialState: initialStateProps = {
	data: readLocalJson<any[]>('ims:pending_sales', [])
};

export const pendingSalesSlice = createSlice({
	name: 'pendingsales',
	initialState,
	reducers: {
		addItem: (state, action) => {
			const existing = Array.isArray(state.data) ? state.data : [];
			const d = [action.payload, ...existing.map((d) => d)];
			state.data = d;
			writeLocalJson('ims:pending_sales', state.data);
		},
		removeItem: (state, action) => {
			const d = state.data.filter(d=> d.id != action.payload.id);            
            state.data = d;
			writeLocalJson('ims:pending_sales', state.data);
		},
		resetPendingSales: () => {
			writeLocalJson('ims:pending_sales', []);
			return { data: [] };
		},
		setPendingSales: (state, action) => {
			state.data = Array.isArray(action.payload) ? action.payload : [];
			writeLocalJson('ims:pending_sales', state.data);
		}
	},
	selectors: {
		selectPendingSales: (pendingSales) => pendingSales.data
	}
});

/**
 * Lazy load
 * */
 rootReducer.inject(pendingSalesSlice);
 const injectedSlice = pendingSalesSlice.injectInto(rootReducer);
 declare module '@/store/rootReducer' {
     export interface LazyLoadedSlices extends WithSlice<typeof pendingSalesSlice> {}
 }
 
 export const { addItem, removeItem, resetPendingSales } = pendingSalesSlice.actions;
export const { setPendingSales } = pendingSalesSlice.actions;
 
 export const { selectPendingSales } = injectedSlice.selectors;
 
 export type messageSliceType = typeof pendingSalesSlice;
 
 export default pendingSalesSlice.reducer;
 