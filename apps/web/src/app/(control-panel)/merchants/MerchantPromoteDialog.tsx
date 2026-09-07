import { useEffect, useMemo, useState } from 'react';
import useUser from '@auth/useUser';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import toast from 'react-hot-toast';
import {
	usePromoteMerchantMutation,
	useGetEligibleMerchantUsersQuery,
	type EligibleMerchantUserOption
} from './MerchantApi';

function eligibleUserLabel(u: EligibleMerchantUserOption) {
	const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
	const email = u.email?.trim() || '';
	const phone = u.phone?.trim() || '';
	if (name && email) return `${name} · ${email}`;
	if (name && phone) return `${name} · ${phone}`;
	if (name) return name;
	if (email) return email;
	if (phone) return phone;
	return 'Unnamed user';
}

function eligibleUserPhoneLine(u: EligibleMerchantUserOption) {
	const p = u.phone?.trim();
	return p || '—';
}

const filterEligibleUsers = createFilterOptions<EligibleMerchantUserOption>({
	stringify: (option) =>
		[option.first_name, option.last_name, option.email, option.phone]
			.filter(Boolean)
			.map((s) => String(s).trim())
			.join(' ')
});

type MerchantPromoteDialogProps = {
	open: boolean;
	onClose: () => void;
};

export default function MerchantPromoteDialog({ open, onClose }: MerchantPromoteDialogProps) {
	const [tab, setTab] = useState(0);
	const [selectedUser, setSelectedUser] = useState<EligibleMerchantUserOption | null>(null);
	const [percent, setPercent] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const { data: authUser } = useUser();

	const { data: eligibleData, isLoading: loadingUsers, isError: eligibleError } =
		useGetEligibleMerchantUsersQuery(undefined, {
			skip: !open,
			refetchOnMountOrArgChange: true
		});
	const eligibleUsers = useMemo(() => {
		const list = eligibleData?.users ?? [];
		const selfEmail = authUser?.email?.trim();
		if (!selfEmail) return list;
		return list.filter((u) => u.email?.trim() !== selfEmail);
	}, [eligibleData?.users, authUser?.email]);

	const [promoteMerchant, { isLoading }] = usePromoteMerchantMutation();

	useEffect(() => {
		if (!open) {
			setTab(0);
			setSelectedUser(null);
			setPercent('');
			setFirstName('');
			setLastName('');
			setEmail('');
			setPhone('');
		}
	}, [open]);

	const handleSubmit = async () => {
		const commission = percent.trim() === '' ? null : Number(percent);
		if (
			percent.trim() !== '' &&
			(commission === null || Number.isNaN(commission) || commission < 0 || commission > 100)
		) {
			toast.error('Commission % must be between 0 and 100.');
			return;
		}

		if (tab === 0) {
			if (!selectedUser?.id) {
				toast.error('Select a user.');
				return;
			}
			try {
				await promoteMerchant({
					user_id: selectedUser.id,
					default_commission_percent: commission
				}).unwrap();
				toast.success('Merchant record created.');
				onClose();
			} catch (e: unknown) {
				const err = e as { data?: { message?: string }; error?: string };
				toast.error(err?.data?.message || err?.error || 'Promote failed');
			}
			return;
		}

		if (!firstName.trim() || !lastName.trim()) {
			toast.error('First and last name are required.');
			return;
		}
		if (!email.trim()) {
			toast.error('Email is required.');
			return;
		}
		if (!phone.trim()) {
			toast.error('Phone is required.');
			return;
		}

		try {
			await promoteMerchant({
				create_user: {
					first_name: firstName.trim(),
					last_name: lastName.trim(),
					email: email.trim(),
					phone: phone.trim()
				},
				default_commission_percent: commission
			}).unwrap();
			toast.success('Field agent created. A temporary password was sent to their email.');
			onClose();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Create failed');
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onClose();
		}
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Add field agent</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-1">
				<Tabs value={tab} onChange={(_, v) => setTab(v)} className="mb-1 min-h-[48px]">
					<Tab label="Existing user" />
					<Tab label="New user" />
				</Tabs>
				{tab === 0 ? (
					<Autocomplete
						fullWidth
						options={eligibleUsers}
						filterOptions={filterEligibleUsers}
						loading={loadingUsers}
						value={selectedUser}
						onChange={(_, value) => setSelectedUser(value)}
						isOptionEqualToValue={(a, b) => a.id === b.id}
						getOptionLabel={(option) => eligibleUserLabel(option)}
						noOptionsText={
							eligibleError
								? 'Could not load users.'
								: loadingUsers
									? 'Loading…'
									: 'No users left — everyone may already be a merchant.'
						}
						renderOption={(props, option) => (
							<li {...props} key={option.id}>
								<div className="flex flex-col py-0.5">
									<Typography variant="body2">{eligibleUserLabel(option)}</Typography>
									<Typography variant="caption" color="text.secondary">
										Phone: {eligibleUserPhoneLine(option)}
									</Typography>
								</div>
							</li>
						)}
						renderInput={(params) => (
							<TextField
								{...params}
								label="User"
								placeholder="Search by name, email, or phone"
								size="small"
								InputProps={{
									...params.InputProps,
									endAdornment: (
										<>
											{loadingUsers ? (
												<CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
											) : null}
											{params.InputProps.endAdornment}
										</>
									)
								}}
							/>
						)}
					/>
				) : (
					<Box className="flex flex-col gap-2">
						<Typography variant="body2" color="text.secondary">
							A new field agent will be created, and a temporary password will be sent to their email.
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
					</Box>
				)}
				<TextField
					fullWidth
					size="small"
					label="Default commission % (optional)"
					value={percent}
					onChange={(e) => setPercent(e.target.value)}
				/>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button
					onClick={handleSubmit}
					variant="contained"
					disabled={isLoading || (tab === 0 && !selectedUser)}
				>
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
}
