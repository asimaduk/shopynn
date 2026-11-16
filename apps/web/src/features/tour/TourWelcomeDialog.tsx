'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import TourMapGraphic from './TourMapGraphic';

type Props = {
	open: boolean;
	onStart: () => void;
	onDontShowAgain: () => void;
	onDismiss: () => void;
	onExited?: () => void;
};

export default function TourWelcomeDialog({
	open,
	onStart,
	onDontShowAgain,
	onDismiss,
	onExited
}: Props) {
	return (
		<Dialog open={open} onClose={onDismiss} fullWidth maxWidth="xs" TransitionProps={{ onExited }}>
			<DialogTitle sx={{ pb: 1 }}>Take a quick tour?</DialogTitle>
			<DialogContent>
				<TourMapGraphic className="mb-4" />
				<Typography variant="body2" color="text.secondary">
					A short walkthrough of sales, inventory, purchases, customers, staff, and settings. You can replay
					it anytime from Take a tour in the side menu.
				</Typography>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
				<Button color="inherit" onClick={onDontShowAgain}>
					Don&apos;t show again
				</Button>
				<div className="flex gap-2 ml-auto">
					<Button onClick={onDismiss}>Not now</Button>
					<Button variant="contained" onClick={onStart}>
						Start tour
					</Button>
				</div>
			</DialogActions>
		</Dialog>
	);
}
