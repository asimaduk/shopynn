'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Divider from '@mui/material/Divider';
import { Controller, useFormContext } from 'react-hook-form';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useRouter } from 'next/navigation';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import {
	useCreateExpenseMutation,
	type Expense
} from '../../ExpenseApi';
import { useGetWarehousesQuery } from '@/app/(control-panel)/setups/warehouses/WarehouseApi';

function SectionTitle({ icon, label }: { icon: string; label: string }) {
	return (
		<Box className="flex items-center gap-2 mb-3" sx={{ py: 0.5 }}>
			<Box className="rounded-lg flex items-center justify-center" sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}>
				<FuseSvgIcon size={18} color="primary">{icon}</FuseSvgIcon>
			</Box>
			<Typography variant="subtitle2" fontWeight="600" color="text.primary" letterSpacing="0.5px">
				{label}
			</Typography>
		</Box>
	);
}

/**
 * New expense view – redesigned with sections and clear hierarchy.
 */
function NewExpenseView() {
	const router = useRouter();
	const methods = useFormContext();
	const { control, formState, getValues } = methods;
	const { errors, isValid, dirtyFields } = formState;
	const { data: warehouses } = useGetWarehousesQuery();
	const [createExpense, { isLoading }] = useCreateExpenseMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const raw = getValues() as Expense & { warehouse_id?: string; expense_date?: Date | string | null };
		const expense_date = (() => {
			const val = raw.expense_date;
			if (val == null) return undefined;
			// @ts-expect-error val narrowed by val !== null in condition
			if (typeof val === 'object' && val !== null && 'toISOString' in val) return (val as Date).toISOString();
			return val != null ? String(val) : undefined;
		})();
		const pl = { ...raw, expense_date };
		pl.warehouse_id = warehouses?.find((w) => w.name === pl.warehouse)?.id ?? '';
		createExpense(pl)
			.unwrap()
			.then(() => router.push('/expenses'))
			.catch((err) => console.error(err));
	};

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col">
				{/* Header */}
				<Box className="w-full px-4 sm:px-6 py-5 border-b border-solid" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
					<Box className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<Box className="flex items-center gap-3">
							<Box
								className="flex items-center justify-center rounded-xl shrink-0"
								sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'primary.contrastText' }}
							>
								<FuseSvgIcon size={26}>heroicons-outline:banknotes</FuseSvgIcon>
							</Box>
							<div>
								<Typography variant="h5" fontWeight="bold" color="text.primary">
									New expense
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Record a new expense
								</Typography>
							</div>
						</Box>
						<Button
							component={Link}
							to="/expenses"
							variant="outlined"
							size="small"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
						>
							Back to expenses
						</Button>
					</Box>
				</Box>

				{/* Form */}
				<Box className="flex-1 px-4 sm:px-6 py-6">
					<Box className="max-w-3xl mx-auto">
						<Paper
							variant="outlined"
							className="rounded-xl overflow-hidden"
							sx={{ borderColor: 'divider', bgcolor: 'background.default' }}
						>
							<form onSubmit={handleSubmit} className="p-6 sm:p-8">
								{/* When & amount */}
								<SectionTitle icon="heroicons-outline:calendar-days" label="When & amount" />
								<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
									{/* <Controller
										control={control}
										name="expense_date"
										render={({ field: { value, onChange } }) => (
											<DateTimePicker
												value={value ? new Date(value as string | Date) : null}
												onChange={(val) => onChange(val)}
												maxDate={new Date()}
												slotProps={{
													textField: {
														label: 'Expense date',
														InputLabelProps: { shrink: true },
														fullWidth: true,
														variant: 'outlined',
														size: 'small',
														error: !!errors.expense_date,
														helperText: (errors?.expense_date?.message as string) ?? ''
													},
													actionBar: { actions: ['clear', 'today'] }
												}}
											/>
										)}
									/> */}
									<Controller
										name="amount"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Amount"
												type="number"
												required
												fullWidth
												variant="outlined"
												size="small"
												error={!!errors.amount}
												helperText={(errors?.amount?.message as string) ?? ''}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start">
															<FuseSvgIcon size={20} color="action">heroicons-outline:currency-dollar</FuseSvgIcon>
														</InputAdornment>
													)
												}}
											/>
										)}
									/>
								</Box>

								<Divider sx={{ my: 2.5 }} />

								{/* Reference & responsibility */}
								<SectionTitle icon="heroicons-outline:document-duplicate" label="Reference & responsibility" />
								<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
									<Controller
										name="voucher"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Voucher / reference"
												required
												fullWidth
												variant="outlined"
												size="small"
												error={!!errors.voucher}
												helperText={(errors?.voucher?.message as string) ?? ''}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start">
															<FuseSvgIcon size={20} color="action">heroicons-outline:document-duplicate</FuseSvgIcon>
														</InputAdornment>
													)
												}}
											/>
										)}
									/>
									<Controller
										name="expensed_by"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Expensed by"
												required
												fullWidth
												variant="outlined"
												size="small"
												error={!!errors.expensed_by}
												helperText={(errors?.expensed_by?.message as string) ?? ''}
												InputProps={{
													startAdornment: (
														<InputAdornment position="start">
															<FuseSvgIcon size={20} color="action">heroicons-outline:user</FuseSvgIcon>
														</InputAdornment>
													)
												}}
											/>
										)}
									/>
								</Box>

								<Divider sx={{ my: 2.5 }} />

								{/* Category & location */}
								<SectionTitle icon="heroicons-outline:tag" label="Category & location" />
								<Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
									<Controller
										name="category"
										control={control}
										defaultValue=""
										render={({ field: { onChange, value } }) => (
											<Autocomplete
												freeSolo
												options={['Default']}
												value={value ?? ''}
												onChange={(_e, newValue) => onChange(newValue ?? '')}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Category"
														placeholder="Select or type"
														variant="outlined"
														size="small"
														InputLabelProps={{ shrink: true }}
														InputProps={{
															...params.InputProps,
															startAdornment: (
																<>
																	<InputAdornment position="start">
																		<FuseSvgIcon size={20} color="action">heroicons-outline:tag</FuseSvgIcon>
																	</InputAdornment>
																	{params.InputProps.startAdornment}
																</>
															)
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
												options={warehouses?.map((w) => w.name) ?? []}
												value={value ?? ''}
												onChange={(_e, newValue) => onChange(newValue ?? '')}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Warehouse"
														placeholder="Select warehouse"
														variant="outlined"
														size="small"
														InputLabelProps={{ shrink: true }}
														InputProps={{
															...params.InputProps,
															startAdornment: (
																<>
																	<InputAdornment position="start">
																		<FuseSvgIcon size={20} color="action">heroicons-outline:building-office-2</FuseSvgIcon>
																	</InputAdornment>
																	{params.InputProps.startAdornment}
																</>
															)
														}}
													/>
												)}
											/>
										)}
									/>
								</Box>

								<Divider sx={{ my: 2.5 }} />

								{/* Description */}
								<SectionTitle icon="heroicons-outline:document-text" label="Description" />
								<Controller
									name="note"
									control={control}
									render={({ field }) => (
										<TextField
											{...field}
											label="Notes (optional)"
											placeholder="Add any details about this expense…"
											multiline
											rows={3}
											fullWidth
											variant="outlined"
											size="small"
											error={!!errors.note}
											helperText={(errors?.note?.message as string) ?? ''}
											sx={{ mb: 3 }}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
														<FuseSvgIcon size={20} color="action">heroicons-outline:document-text</FuseSvgIcon>
													</InputAdornment>
												)
											}}
										/>
									)}
								/>

								{/* Actions */}
								<Box
									className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4"
									sx={{ borderTop: 1, borderColor: 'divider', mt: 1 }}
								>
									<Button type="button" variant="outlined" size="medium" onClick={() => router.push('/expenses')}>
										Cancel
									</Button>
									<Button
										type="submit"
										variant="contained"
										color="primary"
										size="medium"
										disabled={Object.keys(dirtyFields).length === 0 || !isValid || isLoading}
										startIcon={<FuseSvgIcon size={18}>heroicons-outline:plus-circle</FuseSvgIcon>}
									>
										{isLoading ? 'Adding…' : 'Add expense'}
									</Button>
								</Box>
							</form>
						</Paper>
					</Box>
				</Box>
			</div>
		</>
	);
}

export default NewExpenseView;
