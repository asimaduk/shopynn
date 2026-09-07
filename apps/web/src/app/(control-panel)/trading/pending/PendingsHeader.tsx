import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import ConfirmDialog from '../newpurchase/ConfirmDialog';
import { useMemo, useState } from 'react';
import { useCreateSaleMutation } from '../TradingApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectPendingSales } from './pendingSalesSlice';
import { uploadAllPendingSales } from './pendingBatchUpload';

/**
 * The pending header.
 */
function PendingsHeader({
	setProcessing,
	isLoading = false
}: {
	setProcessing: (v: boolean) => void;
	isLoading?: boolean;
}) {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const [openConfirm, setOpenConfirm] = useState(false);
	const [createSale] = useCreateSaleMutation();
	const dispatch = useAppDispatch();
	const pendingSales = useAppSelector(selectPendingSales);

	const { pendingCount, totalGhs, itemQty } = useMemo(() => {
		let total = 0;
		let items = 0;
		for (const row of pendingSales) {
			const pl = row?.payload ?? row;
			total += Number(pl?.total_amount ?? 0);
			const products = pl?.products;
			if (Array.isArray(products)) {
				for (const line of products) {
					items += Number(line?.quantity ?? line?.order_quantity ?? 0) || 0;
				}
			}
		}
		return { pendingCount: pendingSales.length, totalGhs: total, itemQty: items };
	}, [pendingSales]);

	const uploadSales = async () => {
		if (!pendingSales.length) return;
		setProcessing(true);
		try {
			await uploadAllPendingSales(pendingSales, createSale, dispatch);
		} finally {
			setProcessing(false);
		}
	};
	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Pending Sales</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{pendingCount} {pendingCount === 1 ? 'sale' : 'sales'}
								<span className="mx-2 opacity-50">·</span>
								₵ {totalGhs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} total
								<span className="mx-2 opacity-50">·</span>
								{itemQty} {itemQty === 1 ? 'item' : 'items'}
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						className=""
						variant="contained"
						color="secondary"
						disabled={pendingSales.length==0}
						onClick={()=> setOpenConfirm(true)}
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
						<span className="mx-1 sm:mx-2">Upload</span>
					</Button>
				</motion.div>
			</div>

			<ConfirmDialog
				open={openConfirm}
				handleClose={(r)=> {
					// console.log('r',r);
					if(r) {
						uploadSales()
					}

					setOpenConfirm(false);
				}}
				leftText='Cancel'
				message='Your local sales will be uploaded.'
				rightText='Continue'
				title='Confirm Upload'
			/>
		</div>
	);
}

export default PendingsHeader;
