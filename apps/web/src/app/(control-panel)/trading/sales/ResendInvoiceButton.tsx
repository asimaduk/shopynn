'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';
import { useSendSaleInvoiceMutation } from '../TradingApi';

type ResendInvoiceButtonProps = {
	saleId: string;
	invoiceNumber?: string;
	customerName?: string;
	customerEmail?: string;
	size?: 'small' | 'medium';
};

export default function ResendInvoiceButton({
	saleId,
	invoiceNumber,
	customerName,
	customerEmail,
	size = 'small'
}: ResendInvoiceButtonProps) {
	const { data: user } = useUser();
	const [sendSaleInvoice, { isLoading }] = useSendSaleInvoiceMutation();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const canResend = hasPermissionCodes(user, 'sales.share_receipt');
	if (!canResend || !saleId) return null;

	const handleConfirmSend = async () => {
		setConfirmOpen(false);
		try {
			const result = await sendSaleInvoice({
				saleId,
				email: customerEmail?.trim() || undefined
			}).unwrap();
			toast.success(`Invoice resent to ${result.sent_to}`);
		} catch (err: unknown) {
			const message =
				(err as { data?: { message?: string }; message?: string })?.data?.message ||
				(err as { message?: string })?.message ||
				'Could not resend invoice.';
			toast.error(message);
		}
	};

	return (
		<>
			<Tooltip title="Resend invoice email">
				<span>
					<IconButton
						size={size}
						color="primary"
						disabled={isLoading}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setConfirmOpen(true);
						}}
						aria-label="Resend invoice"
					>
						{isLoading ? (
							<CircularProgress size={18} color="inherit" />
						) : (
							<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>
						)}
					</IconButton>
				</span>
			</Tooltip>

			<Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
				<DialogTitle>Resend invoice</DialogTitle>
				<DialogContent>
					<Typography variant="body2" color="text.secondary">
						Send invoice <strong>{invoiceNumber || saleId}</strong>
						{customerName ? ` to ${customerName}` : ''}
						{customerEmail ? ` (${customerEmail})` : ' — customer email required on file or in sale details.'}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirmOpen(false)} color="inherit">
						Cancel
					</Button>
					<Button variant="contained" color="primary" onClick={handleConfirmSend} disabled={isLoading}>
						Resend
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
