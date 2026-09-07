import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { Controller, useFormContext } from 'react-hook-form';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useGetWarehousesQuery } from '@/app/(control-panel)/setups/warehouses/WarehouseApi';

// import { Expense } from '../../../ExpenseApi';

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
				{/* <Controller
					control={control}
					name="expense_date"
					render={({ field: { value, onChange } }) => (
						<DateTimePicker
							value={new Date(value)}
							onChange={(val) => {
								// onChange(val?.toISOString());
								onChange(val);
							}}
							maxDate={new Date()}
							// className="mt-8 mb-4 w-full"
							className="mt-2 mb-4 mx-1"
							slotProps={{
								textField: {
									id: 'date',
									label: 'Expense date',
									InputLabelProps: {
										shrink: true
									},
									fullWidth: true,
									variant: 'outlined',
									error: !!errors.date,
									helperText: errors?.date?.message as string
								},
								actionBar: {
									actions: ['clear', 'today']
								}
							}}
							// slots={{
							// 	openPickerIcon: BirtdayIcon
							// }}
						/>
					)}
				/> */}

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
							error={!!errors.voucher}
							helperText={errors?.voucher?.message as string}
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
							// autoFocus
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
							// autoFocus
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
					defaultValue={[]}
					render={({ field: { onChange, value } }) => (
						<Autocomplete
							fullWidth
							className="mt-2 mb-4 mx-1"
							// multiple
							freeSolo
							options={['Defualt']}
							// value={value as EcommerceProduct['categories']}
							value={value}
							onChange={(event, newValue) => {
								onChange(newValue);
							}}
							renderInput={(params) => (
								<TextField
									{...params}
									placeholder="Select category"
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
					defaultValue={[]}
					render={({ field: { onChange, value } }) => (
						<Autocomplete
							fullWidth
							className="mt-2 mb-4 mx-1"
							// multiple
							// freeSolo
							options={warehouses?.map(w=>w.name)}
							// value={value as EcommerceProduct['categories']}
							value={value}
							onChange={(event, newValue) => {
								onChange(newValue);
							}}
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
						type="text"
						multiline
						rows={2}
						variant="outlined"
						fullWidth
					/>
				)}
			/>
		</div>
	);
}

export default BasicInfoTab;
