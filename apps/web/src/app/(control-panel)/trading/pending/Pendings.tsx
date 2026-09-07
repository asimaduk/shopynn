'use client';

import FuseLoading from '@fuse/core/FuseLoading';
import GlobalStyles from '@mui/material/GlobalStyles';
import React from 'react';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { useCreateSaleMutation } from '../TradingApi';
import PendingsHeader from './PendingsHeader';
import PendingsTable from './PendingsTable';
import { uploadAllPendingSales } from './pendingBatchUpload';
import { selectPendingSales } from './pendingSalesSlice';

/** Avoid overlapping mount-triggered uploads (e.g. React Strict Mode double mount). */
let pendingMountBatchInFlight = false;

/**
 * The Pendings page.
 */
function Pendings() {
	const [processing, setProcessing] = React.useState(false);
	const dispatch = useAppDispatch();
	const pendingSales = useAppSelector(selectPendingSales);
	const [createSale] = useCreateSaleMutation();
	const mountAutoUploadStarted = React.useRef(false);

	React.useEffect(() => {
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		if (!pendingSales.length) return;
		if (mountAutoUploadStarted.current) return;
		if (pendingMountBatchInFlight) return;

		mountAutoUploadStarted.current = true;
		pendingMountBatchInFlight = true;
		const snapshot = [...pendingSales];

		void (async () => {
			try {
				setProcessing(true);
				await uploadAllPendingSales(snapshot, createSale, dispatch);
			} finally {
				setProcessing(false);
				pendingMountBatchInFlight = false;
			}
		})();
	}, [pendingSales, pendingSales.length, createSale, dispatch]);

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
				{processing && (
					<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
						<FuseLoading />
					</div>
				)}
				<PendingsHeader setProcessing={setProcessing} isLoading={processing} />
				<PendingsTable />
			</div>
		</>
	);
}

export default Pendings;
