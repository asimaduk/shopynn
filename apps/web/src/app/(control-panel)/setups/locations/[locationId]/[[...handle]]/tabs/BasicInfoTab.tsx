import type { ReactNode } from 'react';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Controller, useFormContext } from 'react-hook-form';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

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

function BasicInfoTab() {
	const methods = useFormContext();
	const { control, formState } = methods;
	const { errors } = formState;

	const textFieldSx = {
		'& .MuiOutlinedInput-root': { borderRadius: 2 }
	};

	return (
		<SectionCard title="Location details" icon="heroicons-outline:map-pin">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Controller
					name="name"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							label="Location name"
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
			</div>

			<Controller
				name="notes"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						value={field.value ?? ''}
						className="mt-2"
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
		</SectionCard>
	);
}

export default BasicInfoTab;
