import type { ReactNode } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
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

function PricingTab() {
	const methods = useFormContext();
	const { control } = methods;

	const textFieldSx = {
		'& .MuiOutlinedInput-root': { borderRadius: 2 }
	};

	return (
		<SectionCard title="Pricing" icon="heroicons-outline:tag">
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
					gap: { xs: 2.5, sm: 3 },
					alignItems: 'start'
				}}
			>
				<Controller
					name="unit_price"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							label="Retail price"
							id="unit_price"
							InputProps={{
								startAdornment: <InputAdornment position="start">₵</InputAdornment>
							}}
							type="number"
							variant="outlined"
							autoFocus
							fullWidth
							sx={textFieldSx}
						/>
					)}
				/>

				<Controller
					name="alt_price"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							label="Wholesale price"
							id="alt_price"
							InputProps={{
								startAdornment: <InputAdornment position="start">₵</InputAdornment>
							}}
							type="number"
							variant="outlined"
							fullWidth
							sx={textFieldSx}
						/>
					)}
				/>

				<Controller
					name="actual_cost"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							label="Actual cost (per unit)"
							id="actual_cost"
							helperText="Used for profit and COGS when purchase history is missing"
							InputProps={{
								startAdornment: <InputAdornment position="start">₵</InputAdornment>
							}}
							type="number"
							variant="outlined"
							fullWidth
							sx={{ ...textFieldSx, gridColumn: { md: '1 / -1' } }}
						/>
					)}
				/>
			</Box>
		</SectionCard>
	);
}

export default PricingTab;
