'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import useUser from '@auth/useUser';
import { useSession } from 'next-auth/react';
import { useGetMeQuery, useUpdateProfileUserMutation } from '../ProfileApi';

export default function EditProfilePage() {
	const router = useRouter();
	const { data: user } = useUser();
	const { data: session } = useSession();
	const { data: me } = useGetMeQuery();
	const [updateUser] = useUpdateProfileUserMutation();

	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [branch, setBranch] = useState('');
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		setFirstName(me?.first_name || '');
		setLastName(me?.last_name || '');
		setEmail(me?.email || user?.email || '');
		setPhone(me?.phone || user?.phone || '');
		setBranch(me?.warehouse_name || user?.branch || (user?.warehouse as { name?: string })?.name || '');
	}, [me, user]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const targetId = typeof (session as any)?.user_id === 'string' ? (session as any).user_id : null;

		if (!targetId) {
			router.push('/apps/profile');
			return;
		}

		setSubmitting(true);
		try {
			await updateUser({
				id: targetId,
				body: {
					first_name: firstName,
					last_name: lastName,
					phone: phone || undefined
				}
			}).unwrap();
			router.push('/apps/profile');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col px-4 py-6">
				<Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<Box className="flex items-center gap-3">
						<Box
							className="flex items-center justify-center rounded-xl shrink-0"
							sx={{ width: 56, height: 56, bgcolor: 'primary.main', color: 'primary.contrastText' }}
						>
							<FuseSvgIcon size={28}>heroicons-outline:user-circle</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h4" fontWeight="bold">
								Edit profile
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Update your account information
							</Typography>
						</div>
					</Box>
					<Button
						component={Link}
						to="/apps/profile"
						variant="outlined"
						size="small"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to profile
					</Button>
				</Box>
				<div className="w-full flex justify-center">
					<Box className="max-w-2xl w-full">
					<Paper className="p-6 rounded-xl shadow-sm">
						<Box className="flex items-center gap-2 mb-4">
							<FuseSvgIcon size={24} color="action">heroicons-outline:identification</FuseSvgIcon>
							<Typography variant="subtitle1" fontWeight="600">
								Account details
							</Typography>
						</Box>
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<TextField
								label="First name"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								fullWidth
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:user</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="Last name"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								fullWidth
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:user</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="Email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled
								fullWidth
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:envelope</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="Phone"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								fullWidth
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:phone</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="Branch"
								value={branch}
								onChange={(e) => setBranch(e.target.value)}
								disabled
								fullWidth
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:building-office-2</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<Box className="flex gap-2 pt-2">
								<Button
									type="button"
									variant="outlined"
									onClick={() => router.push('/apps/profile')}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="contained"
									color="primary"
									disabled={submitting}
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
								>
									{submitting ? 'Saving…' : 'Save changes'}
								</Button>
							</Box>
						</form>
					</Paper>
					</Box>
				</div>
			</div>
		</>
	);
}
