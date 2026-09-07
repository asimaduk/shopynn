import { createSlice, WithSlice } from '@reduxjs/toolkit';
import rootReducer from '@/store/rootReducer';
import { EcommerceProduct, ProductCategory } from '../../inventory/ECommerceApi';
import { readLocalJson, writeLocalJson } from '../offlineStorage';

type initialStateProps = {
	held: any[];
    products: EcommerceProduct[];
    categories: ProductCategory[];
    customers: any[]
};

const initialState: initialStateProps = {
	held: readLocalJson<any[]>('ims:held_sales', []),
    products: [],
    categories: [],
    customers: []
};

export const newSaleSlice = createSlice({
	name: 'newsales',
	initialState,
	reducers: {
		addHeldItem: (state, action) => { 
            let d = [];     
            if(state.held.length > 0) {
                let isExisting = false;            
                d = state.held.map(h=> {                    
                    if(h.customer && (h.customer == action.payload.customer)) {
                        isExisting = true;
                        return action.payload;
                    }
                    return h;
                });

                if(!isExisting) {                    
                    d.unshift(action.payload);
                }
            }
            else {
                d = [action.payload, ...state.held.map(d=> d)];
            }            
            state.held = d;
            writeLocalJson('ims:held_sales', state.held);
		},
		removeHeldItem: (state, action) => {
			const d = state.held.filter(d=> d.id != action.payload.id);            
            state.held = d;
            writeLocalJson('ims:held_sales', state.held);
		},
        setProducts: (state, action) => {state.products = action.payload},
        setCategories: (state, action) => {state.categories = action.payload},
        setCustomers: (state, action) => {state.customers = action.payload}
		// resetHeldSales: () => initialState
	},
	selectors: {
		selectHeldSales: (newSale) => newSale.held,
        selectProducts: (newSale) => newSale.products,
        selectCategories: (newSale) => newSale.categories,
        selectCustomers: (newSale) => newSale.customers
	}
});

/**
 * Lazy load
 * */
 rootReducer.inject(newSaleSlice);
 const injectedSlice = newSaleSlice.injectInto(rootReducer);
 declare module '@/store/rootReducer' {
     export interface LazyLoadedSlices extends WithSlice<typeof newSaleSlice> {}
 }
 
 export const { addHeldItem, removeHeldItem, setProducts, setCategories, setCustomers } = newSaleSlice.actions; //resetHeldSales
 
 export const { selectHeldSales, selectProducts, selectCategories, selectCustomers } = injectedSlice.selectors;
 
 export type messageSliceType = typeof newSaleSlice;
 
 export default newSaleSlice.reducer;
 