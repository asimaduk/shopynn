import type { ReactNode } from 'react';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { Controller, useFormContext } from 'react-hook-form';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import type { Location } from '../../../../locations/LocationApi';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { WAREHOUSE_PRINTER_OPTIONS } from '../../../models/WarehouseModel';
import useUser from '@auth/useUser';
import { canManageCustomerSignupCodes, canManageSubscription } from '@auth/permissions';
import Link from '@fuse/core/Link';

type SectionCardProps = {
	title: string;
	icon: string;
	children: ReactNode;
};

function SectionCard({ title, icon, children }: SectionCardProps) {
	return (
		<Paper
			elevation={0}
			variant="outlined"
			sx={{
				borderRadius: 3,
				overflow: 'hidden',
				borderColor: 'divider'
			}}
		>
			<Box
				className="flex items-center gap-2 px-4 py-3"
				sx={{
					borderBottom: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.8)
				}}
			>
				<FuseSvgIcon size={22} color="action">
					{icon}
				</FuseSvgIcon>
				<Typography variant="subtitle1" fontWeight={700}>
					{title}
				</Typography>
			</Box>
			<Box className="p-4 sm:p-6">{children}</Box>
		</Paper>
	);
}

type BasicInfoTabProps = {
	locations?: Location[];
};

const REFERENCE_CODE_MIN_LENGTH = 6;
const REFERENCE_CODE_MAX_LENGTH = 80;

function suggestReferenceCode(warehouseName: string) {
	const base = warehouseName
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	let code = `${base || 'STORE'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
	while (code.length < REFERENCE_CODE_MIN_LENGTH) {
		code += Math.random().toString(36).slice(2, 3).toUpperCase();
	}
	return code.slice(0, REFERENCE_CODE_MAX_LENGTH);
}

function BasicInfoTab({ locations = [] }: BasicInfoTabProps) {
	const methods = useFormContext();
	const { control, formState, setValue, watch } = methods;
	const { errors } = formState;
	const warehouseName = watch('name');
	const { data: authUser } = useUser();
	const canCustomerSignupCodes = canManageCustomerSignupCodes(authUser);
	const canUpgrade = canManageSubscription(authUser);

	const textFieldSx = {
		'& .MuiOutlinedInput-root': { borderRadius: 2 }
	};

	const locationOptions = locations.map((l) => (l.name != null ? String(l.name) : '')).filter(Boolean);

	return (
		<SectionCard title="Warehouse details" icon="heroicons-outline:building-storefront">
			<Box
				component="div"
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: { xs: 2.5, sm: 3 }
				}}
			>
			<Box
				component="div"
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
					gap: { xs: 2.5, sm: 3 },
					alignItems: 'start'
				}}
			>
				<Controller
					name="name"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							label="Warehouse name"
							autoFocus
							id="name"
							variant="outlined"
							fullWidth
							sx={textFieldSx}
							error={!!errors.name}
							helperText={errors?.name?.message as string}
						/>
					)}
				/>

				<Controller
					name="manager"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							label="Manager / contact"
							id="manager"
							variant="outlined"
							fullWidth
							sx={textFieldSx}
							error={!!errors.manager}
							helperText={errors?.manager?.message as string}
						/>
					)}
				/>

				<Controller
					name="phone"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							label="Phone"
							id="phone"
							variant="outlined"
							fullWidth
							sx={textFieldSx}
							error={!!errors.phone}
							helperText={errors?.phone?.message as string}
						/>
					)}
				/>

				<Controller
					name="address"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							label="Address"
							id="address"
							variant="outlined"
							fullWidth
							sx={textFieldSx}
							error={!!errors.address}
							helperText={errors?.address?.message as string}
						/>
					)}
				/>
			</Box>

			<Box
				component="div"
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
					gap: { xs: 2.5, sm: 3 },
					alignItems: 'start'
				}}
			>
				<Controller
					name="location"
					control={control}
					render={({ field: { onChange, value, ref } }) => {
						const strValue = typeof value === 'string' ? value : value != null ? String(value) : '';
						return (
							<Autocomplete
								fullWidth
								freeSolo
								options={locationOptions}
								value={strValue}
								inputValue={strValue}
								onChange={(_, newValue) => {
									onChange(newValue ?? '');
								}}
								onInputChange={(_, inputValue) => {
									onChange(inputValue);
								}}
								renderInput={(params) => (
									<TextField
										{...params}
										inputRef={ref}
										label="Location (city / town)"
										placeholder="Select or type a location name"
										variant="outlined"
										required
										error={!!errors.location}
										helperText={
											(errors?.location?.message as string) ||
											'Choose from existing locations or type a name'
										}
										sx={textFieldSx}
										InputLabelProps={{ shrink: true }}
									/>
								)}
							/>
						);
					}}
				/>

				<Controller
					name="printer_type"
					control={control}
					render={({ field }) => (
						<FormControl fullWidth sx={textFieldSx} error={!!errors.printer_type}>
							<InputLabel id="printer_type-label">Label / receipt printer</InputLabel>
							<Select
								{...field}
								labelId="printer_type-label"
								id="printer_type"
								label="Label / receipt printer"
								value={field.value ?? 'any'}
							>
								{WAREHOUSE_PRINTER_OPTIONS.map((opt) => (
									<MenuItem key={opt.value} value={opt.value}>
										{opt.label}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
				/>
			</Box>

			{canCustomerSignupCodes ? (
				<Controller
					name="reference_code"
					control={control}
					render={({ field }) => (
						<Box>
							<TextField
								{...field}
								value={field.value ?? ''}
								onChange={(e) => field.onChange(String(e.target.value).toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
								label="Customer signup code"
								id="reference_code"
								variant="outlined"
								fullWidth
								sx={textFieldSx}
								placeholder="e.g. MAIN-STORE-A1B2"
								error={!!errors.reference_code}
								helperText={
									(errors?.reference_code?.message as string) ||
									'Customers enter this when signing up as a Customer (6–80 characters). Leave blank to auto-generate on create.'
								}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<Tooltip title="Generate code">
												<IconButton
													size="small"
													onClick={() =>
														setValue('reference_code', suggestReferenceCode(String(warehouseName ?? '')), {
															shouldDirty: true,
															shouldValidate: true
														})
													}
													edge="end"
												>
													<FuseSvgIcon size={18}>heroicons-outline:arrow-path</FuseSvgIcon>
												</IconButton>
											</Tooltip>
											<Tooltip title="Copy code">
												<IconButton
													size="small"
													onClick={() => {
														const code = String(field.value ?? '').trim();
														if (code) navigator.clipboard?.writeText(code);
													}}
													edge="end"
												>
													<FuseSvgIcon size={18}>heroicons-outline:clipboard-document</FuseSvgIcon>
												</IconButton>
											</Tooltip>
										</InputAdornment>
									)
								}}
							/>
						</Box>
					)}
				/>
			) : (
				<Alert severity="info" variant="outlined">
					<Typography variant="subtitle2" className="font-semibold">
						Premium: Customer signup codes
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mt-1">
						Per-store signup codes for customer accounts are included on the Premium plan (customer online ordering).
					</Typography>
					{canUpgrade ? (
						<Button component={Link} href="/apps/profile" variant="contained" color="primary" size="small" className="mt-3">
							View Premium plan
						</Button>
					) : (
						<Typography variant="caption" color="text.secondary" className="mt-2 block">
							Ask your account owner to upgrade to Premium.
						</Typography>
					)}
				</Alert>
			)}

			<Controller
				name="minimum_order_amount"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						value={field.value ?? 0}
						onChange={(e) => {
							const raw = e.target.value;
							if (raw === '' || raw === '.') {
								field.onChange(0);
								return;
							}
							const n = Number(raw);
							field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
						}}
						label="Minimum order amount (GHS)"
						id="minimum_order_amount"
						type="number"
						inputProps={{ min: 0, step: 0.01 }}
						variant="outlined"
						fullWidth
						sx={textFieldSx}
						error={!!errors.minimum_order_amount}
						helperText={
							(errors?.minimum_order_amount?.message as string) ||
							'Reject customer checkout when order total is below this amount. Use 0 for no minimum.'
						}
					/>
				)}
			/>

			<Controller
				name="notes"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						value={field.value ?? ''}
						id="notes"
						label="Notes"
						type="text"
						multiline
						minRows={4}
						variant="outlined"
						fullWidth
						sx={textFieldSx}
						placeholder="Optional description or internal remarks"
					/>
				)}
			/>
			</Box>
		</SectionCard>
	);
}

export default BasicInfoTab;
