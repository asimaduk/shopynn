'use client';

import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from '@fuse/core/Link';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import _ from 'lodash';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import FormLabel from '@mui/material/FormLabel';
import { useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { authResetPassword } from '@auth/authApi';
import useNavigate from '@fuse/hooks/useNavigate';
import { signOut, useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

/** Matches mobile + `resetPasswordService`: `old_password` (current / temporary) + `password` (new). */
const schema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current or temporary password.'),
		password: z
			.string()
			.nonempty('Please enter your new password.')
			.min(8, 'Password must be at least 8 characters.'),
		passwordConfirm: z.string().nonempty('Please confirm your new password.')
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: 'New passwords do not match.',
		path: ['passwordConfirm']
	});

const defaultValues = {
	currentPassword: '',
	password: '',
	passwordConfirm: ''
};

function ResetPasswordPageForm() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const [processing, setProcessing] = useState(false);
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const { control, formState, handleSubmit, reset, getValues } = useForm({
		mode: 'onChange',
		defaultValues,
		resolver: zodResolver(schema)
	});

	const { isValid, dirtyFields, errors } = formState;

	async function onSubmit() {
		if (!session?.accessToken) {
			toast.error('Your session expired. Please sign in again.');
			navigate('/sign-in');
			return;
		}

		setProcessing(true);
		try {
			const v = getValues();
			const res = await authResetPassword(
				{ password: v.password, old_password: v.currentPassword },
				session.accessToken
			);
			const resJson = await res.json();

			if (resJson.status === 201) {
				toast.success('Your password has been changed successfully.');
				await signOut({ redirect: false });
				reset(defaultValues);
				navigate('/sign-in');
			} else {
				const msg =
					resJson.message ||
					resJson.data?.message ||
					resJson.error ||
					'Could not update password. Please try again.';
				toast.error(typeof msg === 'string' ? msg : 'Could not update password.');
			}
		} catch {
			toast.error('Something went wrong. Please try again.');
		} finally {
			setProcessing(false);
		}
	}

	const redirectToSignin = async (e: React.MouseEvent) => {
		e.preventDefault();
		await signOut({ redirect: false });
		reset(defaultValues);
		navigate('/sign-in');
	};

	const visibilityAdornment = (visible: boolean, onToggle: () => void) => (
		<InputAdornment position="end">
			<IconButton aria-label="Toggle password visibility" onClick={onToggle} edge="end" size="small">
				<FuseSvgIcon size={20}>{visible ? 'heroicons-outline:eye-slash' : 'heroicons-outline:eye'}</FuseSvgIcon>
			</IconButton>
		</InputAdornment>
	);

	return (
		<form
			name="resetPasswordForm"
			noValidate
			className="relative mt-4 flex w-full flex-col justify-center gap-4"
			onSubmit={handleSubmit(onSubmit)}
		>
			{processing && (
				<div
					className="absolute inset-0 z-[99] flex items-center justify-center"
					style={{ backgroundColor: 'rgba(0,0,0,.5)' }}
				>
					<FuseLoading />
				</div>
			)}

			<Alert severity="info" icon={<FuseSvgIcon size={22}>heroicons-outline:shield-exclamation</FuseSvgIcon>}>
				Use the password you currently sign in with (including a temporary password if you were sent
				one). Your new password must be at least 8 characters — use a mix of letters, numbers, and
				symbols where possible.
			</Alert>

			<Controller
				name="currentPassword"
				control={control}
				render={({ field }) => (
					<FormControl>
						<FormLabel htmlFor="currentPassword">Current password</FormLabel>
						<TextField
							{...field}
							id="currentPassword"
							type={showCurrent ? 'text' : 'password'}
							autoComplete="current-password"
							error={!!errors.currentPassword}
							helperText={errors?.currentPassword?.message}
							required
							fullWidth
							InputProps={{
								endAdornment: visibilityAdornment(showCurrent, () => setShowCurrent((s) => !s))
							}}
						/>
					</FormControl>
				)}
			/>

			<Controller
				name="password"
				control={control}
				render={({ field }) => (
					<FormControl>
						<FormLabel htmlFor="password">New password</FormLabel>
						<TextField
							{...field}
							id="password"
							type={showNew ? 'text' : 'password'}
							autoComplete="new-password"
							error={!!errors.password}
							helperText={errors?.password?.message}
							required
							fullWidth
							InputProps={{
								endAdornment: visibilityAdornment(showNew, () => setShowNew((s) => !s))
							}}
						/>
					</FormControl>
				)}
			/>

			<Controller
				name="passwordConfirm"
				control={control}
				render={({ field }) => (
					<FormControl>
						<FormLabel htmlFor="passwordConfirm">Confirm new password</FormLabel>
						<TextField
							{...field}
							id="passwordConfirm"
							type={showConfirm ? 'text' : 'password'}
							autoComplete="new-password"
							error={!!errors.passwordConfirm}
							helperText={errors?.passwordConfirm?.message}
							required
							fullWidth
							InputProps={{
								endAdornment: visibilityAdornment(showConfirm, () => setShowConfirm((s) => !s))
							}}
						/>
					</FormControl>
				)}
			/>

			<Button
				variant="contained"
				color="secondary"
				className="w-full"
				aria-label="Update password"
				disabled={_.isEmpty(dirtyFields) || !isValid}
				type="submit"
				size="medium"
			>
				Update password
			</Button>

			<Typography className="text-md font-medium" color="text.secondary">
				Return to{' '}
				<Link onClick={redirectToSignin} to="/sign-in">
					sign in
				</Link>
			</Typography>
		</form>
	);
}

export default ResetPasswordPageForm;
