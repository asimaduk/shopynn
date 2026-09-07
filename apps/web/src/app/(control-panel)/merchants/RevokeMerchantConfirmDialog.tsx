import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type RevokeMerchantConfirmDialogProps = {
	open: boolean;
	merchantLabel: string;
	loading: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

export default function RevokeMerchantConfirmDialog({
	open,
	merchantLabel,
	loading,
	onClose,
	onConfirm
}: RevokeMerchantConfirmDialogProps) {
	return (
		<Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth scroll="paper">
			<DialogTitle>Remove merchant partner?</DialogTitle>
			<DialogContent dividers>
				<Typography variant="body1" className="mb-2">
					Remove merchant status for <strong>{merchantLabel}</strong>?
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Onboarded businesses will be unlinked from this merchant and all commission records for this merchant
					will be permanently deleted.
				</Typography>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={loading}>
					Cancel
				</Button>
				<Button onClick={onConfirm} color="warning" variant="contained" disabled={loading}>
					{loading ? 'Removing…' : 'Remove merchant'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
