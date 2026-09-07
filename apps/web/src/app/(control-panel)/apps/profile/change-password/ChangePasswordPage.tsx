'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';

export default function ChangePasswordPage() {
	const router = useRouter();
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (newPassword !== confirmPassword) return;
		setSubmitting(true);
		// TODO: call change-password API
		setTimeout(() => {
			setSubmitting(false);
			router.push('/apps/profile');
		}, 500);
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
							<FuseSvgIcon size={28}>heroicons-outline:key</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h4" fontWeight="bold">
								Change password
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Update your account password
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
					<Box className="max-w-md w-full">
					<Paper className="p-6 rounded-xl shadow-sm">
						<Box className="flex items-center gap-2 mb-4">
							<FuseSvgIcon size={24} color="action">heroicons-outline:lock-closed</FuseSvgIcon>
							<Typography variant="subtitle1" fontWeight="600">
								Password details
							</Typography>
						</Box>
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<TextField
								label="Current password"
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								fullWidth
								required
								autoComplete="current-password"
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:key</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="New password"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								fullWidth
								required
								autoComplete="new-password"
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:lock-open</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<TextField
								label="Confirm new password"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								fullWidth
								required
								autoComplete="new-password"
								error={newPassword !== '' && newPassword !== confirmPassword}
								helperText={
									newPassword !== '' && newPassword !== confirmPassword
										? 'Passwords do not match'
										: ''
								}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:check-circle</FuseSvgIcon>
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
									disabled={
										submitting ||
										!currentPassword ||
										!newPassword ||
										newPassword !== confirmPassword
									}
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:key</FuseSvgIcon>}
								>
									{submitting ? 'Updating…' : 'Update password'}
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
