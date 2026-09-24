'use client';

import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { useCreateSaleMutation } from 'src/app/(control-panel)/trading/TradingApi';
import { uploadAllPendingSales } from 'src/app/(control-panel)/trading/pending/pendingBatchUpload';
import { selectPendingSales } from 'src/app/(control-panel)/trading/pending/pendingSalesSlice';

/**
 * Sticky banner when offline. On reconnect, auto-flushes pending sales.
 */
export default function OfflineBanner() {
	const [offline, setOffline] = useState(
		() => typeof navigator !== 'undefined' && !navigator.onLine
	);
	const dispatch = useAppDispatch();
	const pendingSales = useAppSelector(selectPendingSales);
	const [createSale] = useCreateSaleMutation();
	const pendingRef = useRef(pendingSales);
	const createSaleRef = useRef(createSale);
	const dispatchRef = useRef(dispatch);
	pendingRef.current = pendingSales;
	createSaleRef.current = createSale;
	dispatchRef.current = dispatch;

	useEffect(() => {
		const flush = () => {
			if (typeof navigator !== 'undefined' && !navigator.onLine) return;
			const snapshot = [...pendingRef.current];
			if (!snapshot.length) return;
			void uploadAllPendingSales(snapshot, createSaleRef.current, dispatchRef.current);
		};

		const on = () => {
			setOffline(false);
			flush();
		};
		const off = () => setOffline(true);
		window.addEventListener('online', on);
		window.addEventListener('offline', off);
		setOffline(!navigator.onLine);
		return () => {
			window.removeEventListener('online', on);
			window.removeEventListener('offline', off);
		};
	}, []);

	if (!offline) return null;

	return (
		<Alert
			severity="warning"
			variant="filled"
			icon={<FuseSvgIcon size={22}>heroicons-outline:wifi</FuseSvgIcon>}
			sx={{
				position: 'sticky',
				top: 0,
				zIndex: (theme) => theme.zIndex.drawer + 2,
				borderRadius: 0,
				justifyContent: 'center',
				'& .MuiAlert-message': { fontWeight: 600 }
			}}
		>
			You’re offline — sales will sync when you’re back online. Cash / credit OK; MoMo needs network.
		</Alert>
	);
}
