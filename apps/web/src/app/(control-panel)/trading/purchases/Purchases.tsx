'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import PurchasesHeader from './PurchasesHeader';
import PurchasesTable from './PurchasesTable';
import TradingApi, { useGetAttendantsQuery, useGetPurchasesQuery, useGetProductPurchasesByDateQuery } from '../TradingApi';
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

	const listQuery = productSlug ? `productSlug=${encodeURIComponent(productSlug)}` : '';
	const { data: purchasesByDate, isLoading: loadingByDate } = useGetProductPurchasesByDateQuery(listQuery, {
		skip: !productSlug,
		refetchOnMountOrArgChange: true
	});
	const { data: allPurchases, isLoading: loadingAll } = useGetPurchasesQuery(undefined, {
		skip: !!productSlug,
		refetchOnMountOrArgChange: true
	});
	const data = productSlug ? purchasesByDate : allPurchases;
	const isLoading = productSlug ? loadingByDate : loadingAll;
	let { data: suppliers } = useGetSuppliersQuery(null, {refetchOnMountOrArgChange: true});
	let { data: attendants } = useGetAttendantsQuery(null, {refetchOnMountOrArgChange: true});

	useEffect(() => {
		if (!isLoading) {
			setPurchases(Array.isArray(data) ? data : data?.items ?? []);
		}
	}, [isLoading, data]);

	const handleFilter = async (dates, supplierId, attendantId) => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			params.set('productSlug', productSlug || '');

			if (dates?.startDate && dates?.endDate) {
				params.set('startDate', dates.startDate);
				params.set('endDate', dates.endDate);
			}

			if (supplierId) {
				params.set('suppliedBy', supplierId);
			}

			if (attendantId) {
				params.set('receivedBy', attendantId);
			}

			const promise = store.store.dispatch(
				TradingApi.endpoints.getProductPurchasesByDate.initiate(params.toString(), {
					forceRefetch: true
				})
			);
			const { data: _data, error } = await promise;

			if (error) {
				toast.error('An error occurred. Please try again.');
				return;
			}

			setPurchases(Array.isArray(_data) ? _data : _data?.items ?? []);
		} catch (error) {
			toast.error('An error occurred. Please try again.');
		} finally {
			setLoading(false);
		}
	};

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
