import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import _ from 'lodash';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import { signIn } from 'next-auth/react';
import FormHelperText from '@mui/material/FormHelperText';
import { Alert, InputLabel, MenuItem, Select } from '@mui/material';
import signinErrors from './signinErrors';
import FuseLoading from '@fuse/core/FuseLoading';
import { useState } from 'react';

/**
 * Form Validation Schema
 */
const schema = z
	.object({
		businessName: z.string().nonempty('You must enter your business name'),
		email: z.string().email('You must enter a valid email').nonempty('You must enter an email'),
		phone: z.string().min(10,'You must enter a valid phone').nonempty('You must enter a phone number'),
		username: z.string().min(5,'You must enter a valid username').nonempty('You must enter a username'),
		referral: z.string(),
		firstname: z.string().min(3,'You must enter a valid first name').nonempty('You must enter a first name'),
		lastname: z.string().min(3,'You must enter a valid last name').nonempty('You must enter a last name'),
		product_categorization: z.string({message:'Product type required'}),
		// password: z
		// 	.string()
		// 	.nonempty('Please enter your password.')
		// 	.min(8, 'Password is too short - should be 8 chars minimum.'),
		// passwordConfirm: z.string().nonempty('Password confirmation is required'),
		acceptTermsConditions: z.boolean().refine((val) => val === true, 'The terms and conditions must be accepted.')
	})
	// .refine((data) => data.password === data.passwordConfirm, {
	// 	message: 'Passwords must match',
	// 	path: ['passwordConfirm']
	// });

const defaultValues = {
	businessName: '',
	email: '',
	phone: '',
	firstname: '',
	lastname: '',
	username: '',
	product_categorization: '',
	referral: '',
	acceptTermsConditions: false
};

export type FormType = {
	businessName: string;
	email: string;
	phone: string;
	firstname: string;
	lastname: string;
	username: string;
	product_categorization: string;
	referral: string;
};

const productTypes = [
    // { value: '', label: 'Select a fruit' },
    { value: 'apple', label: 'Beverages Depot (Bel Aquah, Storm)' },
    { value: 'banana', label: 'Pharmacy (Blood tonic, Syringe)' },
];

function AuthJsCredentialsSignUpForm() {
	const [processing, setProcessing] = useState(false)
	const { control, formState, handleSubmit, setError } = useForm({
		mode: 'onChange',
		defaultValues,
		resolver: zodResolver(schema)
	});

	const { isValid, dirtyFields, errors } = formState;

	async function onSubmit(formData: FormType) {
		setProcessing(true)
		const { businessName, email, firstname, lastname } = formData;
		console.log('data...',formData);

		setTimeout(() => {
			setProcessing(false)
		}, 5000);
		return
		
		const result = await signIn('credentials', {
			businessName,
			email,
			firstname,
			formType: 'signup',
			redirect: false
		});

		if (result?.error) {
			setError('root', { type: 'manual', message: signinErrors[result.error] });
			return false;
		}

		return true;
	}

	return (
		<form
			name="registerForm"
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
				name="businessName"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Business name"
						autoFocus
						type="name"
						error={!!errors.businessName}
						helperText={errors?.businessName?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>
			<Controller
				name="email"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Email"
						type="email"
						error={!!errors.email}
						helperText={errors?.email?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>

			<div className='flex justify-between mb-6'>
				<Controller
					name="firstname"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mr-1"
							label="First name"
							// type="password"
							error={!!errors.firstname}
							helperText={errors?.firstname?.message}
							variant="outlined"
							required
							fullWidth
						/>
					)}
				/>
				<Controller
					name="lastname"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="ml-1"
							label="Last name"
							// type="password"
							error={!!errors.lastname}
							helperText={errors?.lastname?.message}
							variant="outlined"
							required
							fullWidth
						/>
					)}
				/>
			</div>

			<Controller
				name="phone"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Phone"
						type="number"
						error={!!errors.phone}
						helperText={errors?.phone?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>

			<Controller
				name="username"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Username"
						type="text"
						error={!!errors.username}
						helperText={errors?.username?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>

			<Controller
				name="product_categorization"
				control={control}
				// rules={{ required: 'Please select a fruit.' }} // Add validation rules here
				render={({ field }) => (
					<FormControl className="mb-6">
						<InputLabel id="product-type">Select business type</InputLabel>
						<Select
							{...field} // Spreads onChange, onBlur, value, and name
							id="productType"
							labelId="product-type"
							variant='outlined'
							// value={producty}
							label="Select business type"
							required
						>
							{productTypes.map((option) => (
								<MenuItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				)}
			/>

			<Controller
				name="referral"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Referral Code"
						type="text"
						error={!!errors.referral}
						helperText={errors?.referral?.message}
						variant="outlined"
						fullWidth
					/>
				)}
			/>

			<Controller
				name="acceptTermsConditions"
				control={control}
				render={({ field }) => (
					<FormControl error={!!errors.acceptTermsConditions}>
						<FormControlLabel
							label="I agree with Terms and Privacy Policy"
							control={
								<Checkbox
									size="small"
									{...field}
								/>
							}
						/>
						<FormHelperText>{errors?.acceptTermsConditions?.message}</FormHelperText>
					</FormControl>
				)}
			/>
			<Button
				variant="contained"
				color="secondary"
				className="mt-6 w-full"
				aria-label="Register"
				disabled={_.isEmpty(dirtyFields) || !isValid}
				type="submit"
				size="large"
			>
				Create your free account
			</Button>
		</form>
	);
}

export default AuthJsCredentialsSignUpForm;
