import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { Controller, useFormContext } from 'react-hook-form';

/**
 * The shipping tab.
 */
function ShippingTab() {
	const methods = useFormContext();
	const { control } = methods;

	return (
		<div>
			<div className="flex -mx-1">
				<Controller
					name="width"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							label="Width"
							autoFocus
							id="width"
							variant="outlined"
							fullWidth
						/>
					)}
				/>

				<Controller
					name="height"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							label="Height"
							id="height"
							variant="outlined"
							fullWidth
						/>
					)}
				/>

				<Controller
					name="depth"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							label="Depth"
							id="depth"
							variant="outlined"
							fullWidth
						/>
					)}
				/>
			</div>

			<Controller
				name="weight"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Weight"
						id="weight"
						variant="outlined"
						fullWidth
					/>
				)}
			/>
			<Controller
				name="extraShippingFee"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						label="Extra Shipping Fee"
						id="extraShippingFee"
						variant="outlined"
						InputProps={{
							startAdornment: <InputAdornment position="start">$</InputAdornment>
						}}
						fullWidth
					/>
				)}
			/>
		</div>
	);
}

export default ShippingTab;
