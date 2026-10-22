import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type DeactivateAgentDialogProps = {
	open: boolean;
	agentLabel: string;
	/** Who receives the agent's shops; null means Shopynn support. */
	handOverTo: string | null;
	isManager?: boolean;
	loading: boolean;
	onClose: () => void;
	onConfirm: (reason: string) => void;
};

export default function DeactivateAgentDialog({
	open,
	agentLabel,
	handOverTo,
	isManager,
	loading,
	onClose,
	onConfirm
}: DeactivateAgentDialogProps) {
	const [reason, setReason] = useState('');

	useEffect(() => {
		if (!open) setReason('');
	}, [open]);

	return (
		<Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth scroll="paper">
			<DialogTitle>Deactivate agent?</DialogTitle>
			<DialogContent dividers className="flex flex-col gap-3">
				<Typography variant="body1">
					Deactivate <strong>{agentLabel}</strong>? They will no longer be able to onboard or collect
					payments.
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Their shops move to <strong>{handOverTo || 'Shopynn support'}</strong>, and future commission on
					those shops goes there too. Commission they have already earned is kept.
					{isManager ? ' Their team members will report directly to Shopynn until you assign a new manager.' : ''}
				</Typography>
				<TextField
					label="Reason (optional)"
					size="small"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					fullWidth
					multiline
					minRows={2}
					inputProps={{ maxLength: 500 }}
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={loading}>
					Cancel
				</Button>
				<Button onClick={() => onConfirm(reason.trim())} color="warning" variant="contained" disabled={loading}>
					{loading ? 'Deactivating…' : 'Deactivate'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
