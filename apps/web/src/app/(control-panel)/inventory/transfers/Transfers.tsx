'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import TransfersHeader from './TransfersHeader';
import TransfersTable from './TransfersTable';
import { useSearchParams } from 'next/navigation';
import ECommerceApi, { useGetProductTransfersQuery } from '../ECommerceApi';
import store from '@/store/store';
import { useEffect, useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import toast from 'react-hot-toast';

/**
 * The Transfers page.
 */
function Transfers() {
	const queryParams = useSearchParams();
	const productSlug = queryParams.get('product');
	const [transfers, setTransfers] = useState([]);
	const [loading, setLoading] = useState(false)

	let { data, isLoading } = useGetProductTransfersQuery(productSlug || '',{refetchOnMountOrArgChange: true});

	useEffect(()=> {		
		if(!isLoading) {
			setTransfers(data)
		}
	},[isLoading])

	const handleFilterByDate = async (dates) => {
		setLoading(true)
		try {
			const date_arg = `${dates.startDate}__${dates.endDate}`;
			const promise = store.store.dispatch(ECommerceApi.endpoints.getProductTransfersByDate.initiate(date_arg,{forceRefetch:true}));
			const { data: _data } = await promise; 

			// console.log('retn is',_data);
			setTransfers(_data);
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
				<TransfersHeader
					transfers={transfers}
					isLoading={isLoading || loading}
					handleFilterByDate={handleFilterByDate}
				/>
				<TransfersTable transfers={transfers.map(t=> ({...t, attendant: t.first_name + ' ' + t.last_name}))} />
			</div>
		</>
	);
}

export default Transfers;
