'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import PurchasesHeader from './PurchasesHeader';
import PurchasesTable from './PurchasesTable';
import TradingApi, { useGetAttendantsQuery, useGetPurchaseQuery } from '../TradingApi';
import { useEffect, useState } from 'react';
import store from '@/store/store';
// import ECommerceApi from '../../inventory/ECommerceApi';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetSuppliersQuery } from '../../setups/suppliers/SupplierApi';

/**
 * The Purchases page.
 */
function Purchases() {
	const queryParams = useSearchParams();
	const productSlug = queryParams.get('product');
	const [purchases, setPurchases] = useState([]);
	const [loading, setLoading] = useState(false)

	let { data, isLoading } = useGetPurchaseQuery(productSlug || '',{refetchOnMountOrArgChange: true});
	let { data: suppliers } = useGetSuppliersQuery(null, {refetchOnMountOrArgChange: true});
	let { data: attendants } = useGetAttendantsQuery(null, {refetchOnMountOrArgChange: true});

	useEffect(()=> {		
		if(!isLoading) {
			setPurchases(data)
		}
	},[isLoading])

	const handleFilter = async (dates, supplierId, attendantId) => {
		setLoading(true)
		try {
			let queryParams = `productSlug=${productSlug || ''}` 
			
			if(dates) {
				queryParams += `&startDate=${dates.startDate}&endDate=${dates.endDate}`
			} 

			if(supplierId) {
				queryParams += `&suppliedBy=${supplierId}`
			}

			if(attendantId) {
				queryParams += `&receivedBy=${attendantId}`
			}
			
			// console.log('queryParams',queryParams);
			
			const promise = store.store.dispatch(TradingApi.endpoints.getProductPurchasesByDate.initiate(queryParams,{forceRefetch:true}));
			const { data: _data } = await promise; 			

			setPurchases(_data);
			setLoading(false)
		} catch (error) {
			setLoading(false)
			toast.error('An error occurred. Please try again.')
		}
	}

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-col px-4">
				{(isLoading || loading) && (
					<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
						<FuseLoading />
					</div>
				)}
				<PurchasesHeader
					purchases={purchases}
					isLoading={isLoading || loading}
					attendants={attendants}
					suppliers={suppliers}
					handleFilter={handleFilter}
				/>
				<PurchasesTable purchases={purchases} />
			</div>
		</>
	);
}

export default Purchases;
