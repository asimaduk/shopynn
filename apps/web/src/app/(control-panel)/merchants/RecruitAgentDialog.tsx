import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { useRecruitTeamAgentMutation } from './MerchantApi';

type RecruitAgentDialogProps = {
	open: boolean;
	onClose: () => void;
};

/** Agent manager: propose a new field agent for Shopynn to approve. */
export default function RecruitAgentDialog({ open, onClose }: RecruitAgentDialogProps) {
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [recruit, { isLoading }] = useRecruitTeamAgentMutation();

	useEffect(() => {
		if (!open) {
			setFirstName('');
			setLastName('');
			setEmail('');
			setPhone('');
		}
	}, [open]);

	const handleSubmit = async () => {
		if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
			toast.error('All fields are required.');
			return;
		}
		try {
			await recruit({
				first_name: firstName.trim(),
				last_name: lastName.trim(),
				email: email.trim(),
				phone: phone.trim()
			}).unwrap();
			toast.success('Recruit submitted for approval.');
			onClose();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Could not submit recruit');
		}
	};

	return (
		<Dialog open={open} onClose={isLoading ? undefined : onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Recruit a field agent</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-1">
				<Typography variant="body2" color="text.secondary">
					Shopynn reviews every new agent. Once approved, they get an email with their login and join your
					team.
				</Typography>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<TextField
						label="First name"
						size="small"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
						required
						fullWidth
					/>
					<TextField
						label="Last name"
						size="small"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
						required
						fullWidth
					/>
				</div>
				<TextField
					label="Email"
					type="email"
					size="small"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					fullWidth
					autoComplete="off"
				/>
				<TextField
					label="Phone"
					size="small"
					value={phone}
					onChange={(e) => setPhone(e.target.value)}
					required
					fullWidth
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
					Submit for approval
				</Button>
			</DialogActions>
		</Dialog>
	);
}
