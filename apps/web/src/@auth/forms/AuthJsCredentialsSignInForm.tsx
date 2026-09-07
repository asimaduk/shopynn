import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import _ from 'lodash';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@fuse/core/Link';
import Button from '@mui/material/Button';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { getSession, signIn } from 'next-auth/react';
import { Alert } from '@mui/material';
import toast from 'react-hot-toast';
import signinErrors from './signinErrors';
import FuseLoading from '@fuse/core/FuseLoading';
import useNavigate from '@fuse/hooks/useNavigate';
import { hasPermissionCodes } from '@auth/permissions';
import type { User } from '@auth/user';

/**
 * Form Validation Schema
 */
const schema = z.object({
	email: z.string().email('You must enter a valid email').min(1, 'You must enter an email'),
	password: z
		.string()
		.min(4, 'Password is too short - must be at least 4 characters.')
		.nonempty('Please enter your password.')
});

type FormType = {
	email: string;
	password: string;
	remember?: boolean;
};

const defaultValues = {
	email: '',
	password: '',
	remember: true
};

function AuthJsCredentialsSignInForm() {
	const navigate = useNavigate();
	const { control, formState, handleSubmit, setValue, setError } = useForm<FormType>({
		mode: 'onChange',
		defaultValues,
		resolver: zodResolver(schema)
	});

	const { isValid, dirtyFields, errors } = formState;
	const [processing, setProcessing] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	// useEffect(() => {
	// 	// setValue('email', '', {
	// 	// 	shouldDirty: true,
	// 	// 	shouldValidate: true
	// 	// });
	// 	// setValue('password', '', {
	// 	// 	shouldDirty: true,
	// 	// 	shouldValidate: true
	// 	// });
	// 	// setValue('email', 'admin@fusetheme.com', {
	// 	// 	shouldDirty: true,
	// 	// 	shouldValidate: true
	// 	// });
	// 	// setValue('password', '5;4+0IOx:\\Dy', {
	// 	// 	shouldDirty: true,
	// 	// 	shouldValidate: true
	// 	// });
	// }, [setValue]);

	async function onSubmit(formData: FormType) {
		const { email, password } = formData;
		setProcessing(true);
		const result = await signIn('credentials', {
			email,
			password,
			formType: 'signin',
			redirect: false
		});

		setProcessing(false);

		if (result?.code === 'password_expired') {
			toast.error('Your password has expired. Request a reset link below.');
			const q = new URLSearchParams({ email: formData.email.trim().toLowerCase() });
			navigate(`/forgot-password?${q.toString()}`);
			return false;
		}

		if (result?.error) {
			setError('root', { type: 'manual', message: signinErrors[result.error] ?? signinErrors.default });
			return false;
		}

		const session = await getSession();
		if (session?.requiresPasswordReset) {
			navigate('/reset-password');
			return true;
		}

		const callbackParam =
			typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('callbackUrl') : null;
		if (callbackParam && callbackParam.startsWith('/') && !callbackParam.startsWith('//')) {
			navigate(callbackParam);
			return true;
		}

		const db = session?.db as User | undefined;
		const merchantId = db?.merchant_id;
		if (merchantId && hasPermissionCodes(db, 'merchants.operate')) {
			navigate('/merchants');
			return true;
		}
		if (hasPermissionCodes(db, 'dashboard.view')) {
			navigate('/dashboards/analytics');
			return true;
		}
		if (hasPermissionCodes(db, ['merchants.operate', 'merchants.view'])) {
			navigate('/merchants');
			return true;
		}

		navigate('/');
		return true;
	}

	return (
		<form
			name="loginForm"
			noValidate
			className="mt-8 flex w-full flex-col justify-center"
			onSubmit={handleSubmit(onSubmit)}
		>
			{processing && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
                    <FuseLoading />
                </div>
			)}
			{errors?.root?.message && (
				<Alert
					className="mb-8"
					severity="error"
					sx={(theme) => ({
						backgroundColor: theme.palette.error.light,
						color: theme.palette.error.dark
					})}
				>
					{errors?.root?.message}
				</Alert>
			)}
			<Controller
				name="email"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Email"
						autoFocus
						type="email"
						autoComplete="email"
						error={!!errors.email}
						helperText={errors?.email?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>
			<Controller
				name="password"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Password"
						type={showPassword ? 'text' : 'password'}
						autoComplete="current-password"
						error={!!errors.password}
						helperText={errors?.password?.message}
						variant="outlined"
						required
						fullWidth
						slotProps={{
							input: {
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											aria-label={showPassword ? 'Hide password' : 'Show password'}
											onClick={() => setShowPassword((prev) => !prev)}
											edge="end"
										>
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								)
							}
						}}
					/>
				)}
			/>
			<div className="flex flex-col items-center justify-end sm:flex-row sm:justify-end mb-2">
				<Link
					className="text-sm font-medium"
					to="/forgot-password"
				>
					Forgot password?
				</Link>
			</div>
			<Button
				variant="contained"
				color="secondary"
				className="mt-4 w-full"
				aria-label="Sign in"
				disabled={_.isEmpty(dirtyFields) || !isValid}
				type="submit"
				size="large"
			>
				Sign in
			</Button>
		</form>
	);
}

export default AuthJsCredentialsSignInForm;
