'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import SalesHeader from './SalesHeader';
import SalesTable from './SalesTable';
import TradingApi, { useGetSaleQuery, useGetAttendantsQuery } from '../TradingApi';
import { useEffect, useRef, useState } from 'react';
import store from '@/store/store';
// import ECommerceApi from '../../inventory/ECommerceApi';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import FuseLoading from '@fuse/core/FuseLoading';

/**
 * The Sales page.
 */
function Sales() {
	const queryParams = useSearchParams();
	const productSlug = queryParams.get('product');
	const soldByParam = queryParams.get('soldBy');
	const soldByNameParam = queryParams.get('soldByName');
	const soldByInitialDoneRef = useRef(false);
	const [sales, setSales] = useState([]);
	const [loading, setLoading] = useState(false);

	let { data, isLoading } = useGetSaleQuery(productSlug || '', { refetchOnMountOrArgChange: true });
	let { data: attendants } = useGetAttendantsQuery(null, { refetchOnMountOrArgChange: true });

	useEffect(() => {
		soldByInitialDoneRef.current = false;
	}, [soldByParam]);

	useEffect(() => {
		if (isLoading) return;
		if (soldByParam) {
			if (soldByInitialDoneRef.current) return;
			soldByInitialDoneRef.current = true;
			void (async () => {
				setLoading(true);
				try {
					let qs = `productSlug=${productSlug || ''}&soldBy=${encodeURIComponent(soldByParam)}`;
					const promise = store.store.dispatch(
						TradingApi.endpoints.getProductSalesByDate.initiate(qs, { forceRefetch: true })
					);
					const { data: filtered } = await promise;
					setSales(filtered ?? []);
				} catch {
					toast.error('An error occurred. Please try again.');
				} finally {
					setLoading(false);
				}
			})();
			return;
		}
		setSales(data ?? []);
	}, [isLoading, data, soldByParam, productSlug]);

	const handleFilter = async (dates, attendantId) => {
		setLoading(true)
		try {
			let queryParams = `productSlug=${productSlug || ''}` 
			
			if(dates) {
				queryParams += `&startDate=${dates.startDate}&endDate=${dates.endDate}`
			} 

			if(attendantId) {
				queryParams += `&soldBy=${attendantId}`
			}
			
			// console.log('queryParams',queryParams);
			
			const promise = store.store.dispatch(TradingApi.endpoints.getProductSalesByDate.initiate(queryParams,{forceRefetch:true}));
			const { data: _data } = await promise; 

			setSales(_data);
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
				<SalesHeader
					sales={sales}
					isLoading={isLoading || loading}
					attendants={attendants}
					handleFilter={handleFilter}
					soldByDisplayName={soldByNameParam}
				/>
				<SalesTable sales={sales} />
			</div>
		</>
	);
}

export default Sales;
