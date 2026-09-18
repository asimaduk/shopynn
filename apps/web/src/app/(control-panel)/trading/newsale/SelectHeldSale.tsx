'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeHeldItem, selectHeldSales } from './newSaleSlice';

export interface SelectHeldSaleProps {
	id: string;
	keepMounted: boolean;
	value: string;
	open: boolean;
	onClose: (value?: string) => void;
	onHoldSelect: (value?: Record<string, unknown>) => void;
}

function calcHeldTotal(sale: { currentOrder?: { order_quantity?: number; unit_price?: number; alt_price?: number }[] }) {
	const lines = Array.isArray(sale?.currentOrder) ? sale.currentOrder : [];
	return lines.reduce((sum, line) => {
		const qty = Number(line.order_quantity) || 0;
		const unit = Number(line.unit_price) || 0;
		return sum + qty * unit;
	}, 0);
}

function formatHeldTime(id: unknown) {
	const n = Number(id);
	if (!Number.isFinite(n) || n <= 0) return '';
	try {
		return new Date(n).toLocaleString(undefined, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return '';
	}
}

function SelectHeldSale(props: SelectHeldSaleProps) {
	const dispatch = useAppDispatch();
	const { onClose, onHoldSelect, open, ...other } = props;
	const heldSales = useAppSelector(selectHeldSales);
	const list = Array.isArray(heldSales) ? heldSales : [];
	const isEmpty = list.length === 0;

	const handleCancel = () => {
		onClose();
	};

	const openHeldItems = (itm: Record<string, unknown>) => {
		onHoldSelect({ ...itm });
	};

	const handleRemove = (e: React.MouseEvent, sale: { id?: unknown }) => {
		e.stopPropagation();
		dispatch(removeHeldItem(sale));
	};

	return (
		<Dialog
			sx={{ '& .MuiDialog-paper': { width: '100%', maxWidth: 440 } }}
			maxWidth="xs"
			open={open}
			onClose={handleCancel}
			{...other}
		>
			<DialogTitle sx={{ pb: 1 }}>
				<Stack spacing={0.5}>
					<Typography component="span" variant="h6" fontWeight={700}>
						Held sales
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{isEmpty
							? 'Parked orders will show up here'
							: `${list.length} held sale${list.length === 1 ? '' : 's'} — tap one to resume`}
					</Typography>
				</Stack>
			</DialogTitle>
			<DialogContent dividers sx={{ px: 0, py: 0, minHeight: 220 }}>
				{isEmpty ? (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							textAlign: 'center',
							px: 3,
							py: 6,
							gap: 1.5
						}}
					>
						<Box
							sx={{
								width: 56,
								height: 56,
								borderRadius: '5px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								bgcolor: 'grey.100',
								border: '1px solid',
								borderColor: 'grey.300',
								mb: 0.5
							}}
						>
							<FuseSvgIcon size={28} color="action">
								heroicons-outline:pause-circle
							</FuseSvgIcon>
						</Box>
						<Typography variant="subtitle1" fontWeight={700}>
							No held sales
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
							When you tap <strong>Hold</strong> on an order, it is saved here so you can resume it
							later.
						</Typography>
					</Box>
				) : (
					<Stack divider={<Divider flexItem />}>
						{list.map((sale, i) => {
							const itemCount = Array.isArray(sale?.currentOrder) ? sale.currentOrder.length : 0;
							const total = calcHeldTotal(sale);
							const when = formatHeldTime(sale?.id);
							const customerLabel = sale?.customer || 'Walk In';

							return (
								<Box
									key={sale?.id ?? i}
									onClick={() => openHeldItems(sale)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											openHeldItems(sale);
										}
									}}
									role="button"
									tabIndex={0}
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1.5,
										width: '100%',
										textAlign: 'left',
										px: 2.5,
										py: 1.75,
										cursor: 'pointer',
										'&:hover': { bgcolor: 'action.hover' }
									}}
								>
									<IconButton
										size="small"
										aria-label="Remove held sale"
										onClick={(e) => handleRemove(e, sale)}
										sx={{
											borderRadius: '5px',
											border: '1px solid',
											borderColor: 'grey.300',
											color: 'text.secondary'
										}}
									>
										<FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
									</IconButton>

									<Box
										sx={{
											width: 40,
											height: 40,
											borderRadius: '5px',
											flexShrink: 0,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											bgcolor: 'grey.100',
											border: '1px solid',
											borderColor: 'grey.300'
										}}
									>
										<FuseSvgIcon size={18} color="action">
											heroicons-outline:user
										</FuseSvgIcon>
									</Box>

									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Typography variant="subtitle2" fontWeight={700} noWrap>
											{customerLabel}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{itemCount} item{itemCount === 1 ? '' : 's'}
											{when ? ` · ${when}` : ''}
										</Typography>
									</Box>

									<Stack alignItems="flex-end" spacing={0.25} sx={{ flexShrink: 0 }}>
										<Typography variant="subtitle2" fontWeight={700}>
											GH₵ {total.toFixed(2)}
										</Typography>
										<FuseSvgIcon size={18} color="action">
											heroicons-outline:chevron-right
										</FuseSvgIcon>
									</Stack>
								</Box>
							);
						})}
					</Stack>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 2.5, py: 1.5 }}>
				<Button
					onClick={handleCancel}
					variant="outlined"
					color="inherit"
					sx={{
						borderRadius: '5px',
						borderColor: 'grey.400',
						textTransform: 'none',
						fontWeight: 600
					}}
				>
					Close
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default SelectHeldSale;
