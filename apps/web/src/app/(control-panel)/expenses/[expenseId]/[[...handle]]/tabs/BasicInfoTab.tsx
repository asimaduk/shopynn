import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';
import { Controller, useFormContext } from 'react-hook-form';
import { format } from 'date-fns';
import { useGetWarehousesQuery } from '@/app/(control-panel)/setups/warehouses/WarehouseApi';

const CATEGORY_OPTIONS = ['Transport', 'Utilities', 'Rent', 'Salaries', 'Supplies', 'Maintenance', 'Logistics', 'Other'];

/**
 * The basic info tab.
 */
function BasicInfoTab() {
	const methods = useFormContext();
	const { data: warehouses } = useGetWarehousesQuery();

	const { control, formState } = methods;
	const { errors } = formState;

	return (
		<div>
			<div className="flex -mx-1">
				<Controller
					name="expense_date"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ? String(field.value).slice(0, 10) : ''}
							className="mt-2 mb-4 mx-1"
							required
							label="Expense date"
							type="date"
							id="expense_date"
							variant="outlined"
							fullWidth
							InputLabelProps={{ shrink: true }}
							inputProps={{ max: format(new Date(), 'yyyy-MM-dd') }}
							error={!!errors.expense_date}
							helperText={errors?.expense_date?.message as string}
						/>
					)}
				/>

				<Controller
					name="amount"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							required
							label="Amount"
							type="number"
							autoFocus
							id="amount"
							variant="outlined"
							fullWidth
							InputProps={{ startAdornment: <InputAdornment position="start">GHS</InputAdornment> }}
							inputProps={{ min: 0, step: '0.01' }}
							error={!!errors.amount}
							helperText={errors?.amount?.message as string}
						/>
					)}
				/>

				<Controller
					name="voucher"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							required
							label="Voucher"
							id="voucher"
							variant="outlined"
							fullWidth
							error={!!errors.voucher}
							helperText={errors?.voucher?.message as string}
						/>
					)}
				/>

				<Controller
					name="expensed_by"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							className="mt-2 mb-4 mx-1"
							required
							label="Expensed By"
							id="expensed_by"
							variant="outlined"
							fullWidth
							error={!!errors.expensed_by}
							helperText={errors?.expensed_by?.message as string}
						/>
					)}
				/>
			</div>

			<div className="flex -mx-1">
				<Controller
					name="category"
					control={control}
					defaultValue=""
					render={({ field: { onChange, value } }) => (
						<Autocomplete
							fullWidth
							className="mt-2 mb-4 mx-1"
							freeSolo
							options={CATEGORY_OPTIONS}
							value={value ?? ''}
							inputValue={value ?? ''}
							onChange={(_event, newValue) => onChange(newValue ?? '')}
							onInputChange={(_event, newInputValue) => onChange(newInputValue)}
							renderInput={(params) => (
								<TextField
									{...params}
									placeholder="Select or type a category"
									label="Categories"
									variant="outlined"
									InputLabelProps={{
										shrink: true
									}}
								/>
							)}
						/>
					)}
				/>

				<Controller
					name="warehouse"
					control={control}
					defaultValue=""
					render={({ field: { onChange, value } }) => (
						<Autocomplete
							fullWidth
							className="mt-2 mb-4 mx-1"
							options={warehouses?.map((w) => w.name) ?? []}
							value={value || null}
							onChange={(_event, newValue) => onChange(newValue ?? '')}
							renderInput={(params) => (
								<TextField
									{...params}
									placeholder="Select warehouse"
									label="Warehouse"
									variant="outlined"
									InputLabelProps={{
										shrink: true
									}}
								/>
							)}
						/>
					)}
				/>
			</div>

			<Controller
				name="note"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mt-2 mb-4"
						id="note"
						label="Description"
						required
						type="text"
						multiline
						rows={2}
						variant="outlined"
						fullWidth
						error={!!errors.note}
						helperText={(errors?.note?.message as string) ?? 'At least 5 characters'}
					/>
				)}
			/>
		</div>
	);
}

export default BasicInfoTab;
