'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import FuseLoading from '@fuse/core/FuseLoading';
import { authForgotPassword } from '@auth/authApi';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
	const searchParams = useSearchParams();
	const [email, setEmail] = useState('');
	const [processing, setProcessing] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		const fromQuery = searchParams.get('email')?.trim();
		if (fromQuery) {
			setEmail(fromQuery);
		}
	}, [searchParams]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = email.trim();
		if (!trimmed) {
			toast.error('Please enter your email');
			return;
		}
		setProcessing(true);
		try {
			const res = await authForgotPassword(trimmed);
			const data = await res.json();
			if (res.ok && (data.status === 200 || data.status === 201)) {
				setSubmitted(true);
				toast.success('If an account exists, we\'ve sent a reset link to your email.');
			} else {
				toast.error(data?.error ?? data?.message ?? 'Something went wrong. Please try again.');
			}
		} catch {
			toast.error('Failed to send reset email. Please try again.');
		} finally {
			setProcessing(false);
		}
	};

	return (
		<div className="flex min-w-0 flex-1 flex-col items-center justify-center min-h-full w-full p-4">
			<Paper className="w-full max-w-md px-4 py-6 sm:rounded-xl sm:p-12 sm:shadow-sm">
				<CardContent className="w-full max-w-80 mx-auto p-0">
					<Box className="flex flex-col items-center text-center mb-6">
						<img className="w-12" src="/assets/images/logo/ims.svg" alt="logo" />
						<Typography className="mt-2 text-xl font-bold" component="span">
							Shopynn
						</Typography>
					</Box>

					<Typography className="text-4xl font-extrabold leading-[1.25] tracking-tight">
						Forgot password?
					</Typography>
					{!submitted && (
						<Typography color="text.secondary" className="mt-1">
							Enter your email and we&apos;ll send you a temporary password by email.
							This password will expire in 30 minutes. Please change your password as soon as you receive it.
						</Typography>
					)}

					{processing && (
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								backgroundColor: 'rgba(0,0,0,.5)',
								zIndex: 99
							}}
						>
							<FuseLoading />
						</div>
					)}

					{!submitted ? (
						<form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
							<TextField
								label="Email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								fullWidth
								autoComplete="email"
								autoFocus
								variant="outlined"
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<FuseSvgIcon size={20} color="action">heroicons-outline:envelope</FuseSvgIcon>
										</InputAdornment>
									)
								}}
							/>
							<Button
								variant="contained"
								color="secondary"
								type="submit"
								size="large"
								fullWidth
								disabled={processing || !email.trim()}
							>
								Send temporary password
							</Button>
						</form>
					) : (
						<Box className="mt-8">
							<Typography color="text.secondary" className="mb-4">
								Check your inbox for a temporary password. If you don&apos;t see it, check your spam folder.
								This password will expire in 30 minutes. Please change your password as soon as you receive it.
							</Typography>
							<Button component={Link} to="/sign-in" variant="outlined" fullWidth>
								Back to sign in
							</Button>
						</Box>
					)}

					<Typography className="mt-6 text-sm" color="text.secondary">
						Remember your password? <Link to="/sign-in" className="font-medium">Sign in</Link>
					</Typography>
				</CardContent>
			</Paper>
		</div>
	);
}
