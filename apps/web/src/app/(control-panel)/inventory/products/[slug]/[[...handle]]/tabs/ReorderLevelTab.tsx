import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { Controller, useFormContext } from 'react-hook-form';

/**
 * The pricing tab.
 */
function ReorderLevelTab() {
	const methods = useFormContext();
	const { control } = methods;

	return (
		<div>
			<Controller
				name="unit_price"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Unit Price"
						id="unit_price"
						InputProps={{
							startAdornment: <InputAdornment position="start">₵</InputAdornment>
						}}
						type="number"
						variant="outlined"
						autoFocus
						fullWidth
					/>
				)}
			/>

			<Controller
				name="alt_price"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Alt. Price"
						id="alt_price"
						InputProps={{
							startAdornment: <InputAdornment position="start">₵</InputAdornment>
						}}
						type="number"
						variant="outlined"
						fullWidth
					/>
				)}
			/>

			{/* <Controller
				name="taxRate"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Tax Rate"
						id="taxRate"
						InputProps={{
							startAdornment: <InputAdornment position="start">$</InputAdornment>
						}}
						type="number"
						variant="outlined"
						fullWidth
					/>
				)}
			/>

			<Controller
				name="comparedPrice"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Compared Price"
						id="comparedPrice"
						InputProps={{
							startAdornment: <InputAdornment position="start">$</InputAdornment>
						}}
						type="number"
						variant="outlined"
						fullWidth
						helperText="Add a compare price to show next to the real price"
					/>
				)}
			/> */}
		</div>
	);
}

export default ReorderLevelTab;
