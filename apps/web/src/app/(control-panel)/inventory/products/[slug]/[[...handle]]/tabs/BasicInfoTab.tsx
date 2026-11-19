import { useEffect, useMemo, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { alpha } from '@mui/material/styles';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useGetProductCategoriesQuery } from '../../../../ECommerceApi';
import { useGetWarehousesQuery } from '../../../../../setups/warehouses/WarehouseApi';
import useUser from '@auth/useUser';

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

type CategoryOption = { id: string | number; name: string };

function categoriesFormValueToOptions(raw: unknown, options: CategoryOption[]): CategoryOption[] {
	const ids = Array.isArray(raw) ? raw : [];
	return ids
		.map((id) => options.find((o) => String(o.id) === String(id)))
		.filter((o): o is CategoryOption => o != null);
}

function BasicInfoTab() {
	const routeParams = useParams<{ slug: string }>();
	const isNew = routeParams?.slug === 'new';
	const { data: user } = useUser();
	const homeStoreName = user?.warehouse?.name || 'your store';
	const { data: categories } = useGetProductCategoriesQuery(null, { refetchOnMountOrArgChange: true });
	const { data: warehouses = [] } = useGetWarehousesQuery(null, {
		skip: !isNew,
		refetchOnMountOrArgChange: true
	});
	const methods = useFormContext();
	const { control, formState, setValue, getValues } = methods;
	const { errors } = formState;
	const productType = useWatch({ control, name: 'product_type' });
	const allowsFractional = useWatch({ control, name: 'allows_fractional_qty' });
	const warehouseQuantities = useWatch({ control, name: 'warehouse_quantities' }) as
		| { warehouse_id?: string; quantity?: number | string }[]
		| undefined;

	const textFieldSx = {
		'& .MuiOutlinedInput-root': { borderRadius: 2 }
	};

	const warehouseOptions = useMemo(() => {
		if (!Array.isArray(warehouses)) return [];
		return warehouses
			.filter((w) => w != null && w.id != null)
			.map((w) => ({
				id: String(w.id),
				name: String(w.name || 'Store'),
				location: w.location ? String(w.location) : ''
			}));
	}, [warehouses]);

	const multiStore = warehouseOptions.length > 1;

	const categoryOptions = useMemo((): CategoryOption[] => {
		if (!Array.isArray(categories)) return [];
		return categories
			.filter((ct: any) => ct != null && ct.id != null && ct.name != null)
			.map((ct: any) => ({ id: ct.id, name: String(ct.name) }));
	}, [categories]);

	useEffect(() => {
		if (!isNew || warehouseOptions.length === 0) return;
		const existing = Array.isArray(getValues('warehouse_quantities'))
			? (getValues('warehouse_quantities') as { warehouse_id?: string; quantity?: number | string }[])
			: [];
		const byId = new Map(
			existing
				.filter((row) => row?.warehouse_id)
				.map((row) => [String(row.warehouse_id), Number(row.quantity) || 0])
		);
		const next = warehouseOptions.map((w) => ({
			warehouse_id: w.id,
			quantity: byId.has(w.id) ? Math.max(0, byId.get(w.id) || 0) : 0
		}));
		const sameLength = existing.length === next.length;
		const sameIds =
			sameLength && next.every((row, i) => String(existing[i]?.warehouse_id || '') === row.warehouse_id);
		if (!sameIds) {
			setValue('warehouse_quantities', next, { shouldDirty: false });
		}
	}, [isNew, warehouseOptions, getValues, setValue]);

	const setWarehouseQty = (warehouseId: string, raw: string) => {
		const current = Array.isArray(getValues('warehouse_quantities'))
			? ([...(getValues('warehouse_quantities') as { warehouse_id?: string; quantity?: number | string }[])] as {
					warehouse_id: string;
					quantity: number | string;
				}[])
			: warehouseOptions.map((w) => ({ warehouse_id: w.id, quantity: 0 }));
		const idx = current.findIndex((row) => String(row.warehouse_id) === warehouseId);
		const quantity =
			raw === '' ? '' : Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
		if (idx >= 0) {
			current[idx] = { warehouse_id: warehouseId, quantity };
		} else {
			current.push({ warehouse_id: warehouseId, quantity });
		}
		setValue('warehouse_quantities', current, { shouldDirty: true, shouldValidate: true });
		const total = current.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
		setValue('opening_quantity', total, { shouldDirty: true });
	};

	const qtyForWarehouse = (warehouseId: string) => {
		const row = (warehouseQuantities || []).find((r) => String(r?.warehouse_id || '') === warehouseId);
		return row?.quantity ?? 0;
	};

	useEffect(() => {
		if (productType !== 'fabric') return;
		const currentUnit = String(getValues('measurement_unit') || '').trim().toLowerCase();
		if (!currentUnit || currentUnit === 'units' || currentUnit === 'piece') {
			setValue('measurement_unit', 'yard', { shouldDirty: true });
			setValue('unit', 'yard', { shouldDirty: true });
		}
		if (!Boolean(getValues('allows_fractional_qty'))) {
			setValue('allows_fractional_qty', true, { shouldDirty: true });
		}
		const minOrderQty = Number(getValues('min_order_qty') || 0);
		if (!Number.isFinite(minOrderQty) || minOrderQty < 1) {
			setValue('min_order_qty', 1, { shouldDirty: true });
		}
		const qtyStep = Number(getValues('qty_step') || 0);
		if (!Number.isFinite(qtyStep) || qtyStep < 1) {
			setValue('qty_step', 1, { shouldDirty: true });
		}
	}, [productType, getValues, setValue]);

	return (
		<Box className="flex flex-col gap-4 sm:gap-5">
		<SectionCard title="Product details" icon="heroicons-outline:cube">
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: { xs: 2.5, sm: 3 }
				}}
			>
				<Box
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
								label="Name"
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
						name="sku"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ''}
								required
								label="Product code (SKU)"
								id="sku"
								variant="outlined"
								fullWidth
								sx={textFieldSx}
								error={!!errors.sku}
								helperText={errors?.sku?.message as string}
							/>
						)}
					/>

					<Controller
						name="product_type"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								select
								label="Product type"
								variant="outlined"
								fullWidth
								sx={textFieldSx}
								SelectProps={{ native: true }}
							>
								<option value="standard">Standard</option>
								<option value="fabric">Fabric</option>
								<option value="service">Service</option>
							</TextField>
						)}
					/>

					<Controller
						name="measurement_unit"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								select
								label="Measurement unit"
								variant="outlined"
								fullWidth
								sx={textFieldSx}
								SelectProps={{ native: true }}
							>
								<option value="units">Units</option>
								<option value="piece">Piece</option>
								<option value="yard">Yard</option>
								<option value="meter">Meter</option>
								<option value="kg">Kg</option>
								<option value="g">g</option>
								<option value="ltr">Ltr</option>
							</TextField>
						)}
					/>

					<Controller
						name="min_order_qty"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? 1}
								label="Minimum order quantity"
								type="number"
								variant="outlined"
								fullWidth
								inputProps={{ min: 1, step: 1 }}
								sx={textFieldSx}
							/>
						)}
					/>

					<Controller
						name="qty_step"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? 1}
								label="Quantity step"
								type="number"
								variant="outlined"
								fullWidth
								inputProps={{ min: 1, step: 1 }}
								sx={textFieldSx}
							/>
						)}
					/>

					<Controller
						name="reorder_quantity"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ''}
								required
								label="Re-order level"
								id="reorder_quantity"
								variant="outlined"
								fullWidth
								type="number"
								sx={textFieldSx}
								error={!!errors.reorder_quantity}
								helperText={errors?.reorder_quantity?.message as string}
							/>
						)}
					/>

					<Controller
						name="_tags"
						control={control}
						render={({ field }) => (
							<TextField
								{...field}
								value={field.value ?? ''}
								required
								label="Tags (comma-separated)"
								id="_tags"
								variant="outlined"
								fullWidth
								sx={textFieldSx}
								error={!!errors._tags}
								helperText={errors?._tags?.message as string}
							/>
						)}
					/>
				</Box>

				<Controller
					name="allows_fractional_qty"
					control={control}
					render={({ field }) => (
						<FormControlLabel
							control={
								<Switch
									checked={Boolean(field.value)}
									onChange={(_, checked) => field.onChange(checked)}
								/>
							}
							label="Allow fractional quantity for this product"
						/>
					)}
				/>
			</Box>
		</SectionCard>

		{isNew ? (
			<SectionCard title="Opening stock" icon="heroicons-outline:archive-box">
				<Box className="flex flex-col gap-3">
					<Typography variant="body2" color="text.secondary">
						{multiStore ? (
							<>
								Enter how many units you already have at each store. Leave 0 for stores with no stock
								yet. Ongoing restocks should still use Purchases or Adjustments.
							</>
						) : (
							<>
								Set how many units you already have at <strong>{homeStoreName}</strong>. Leave 0 if you
								will receive stock later via purchase. Ongoing restocks should still use Purchases or
								Adjustments.
							</>
						)}
					</Typography>

					{warehouseOptions.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							Loading stores…
						</Typography>
					) : (
						<Box className="flex flex-col gap-2">
							{multiStore ? (
								<Box className="flex items-center justify-between px-1">
									<Typography variant="caption" color="text.secondary">
										Store
									</Typography>
									<Typography variant="caption" color="text.secondary">
										Qty on hand
									</Typography>
								</Box>
							) : null}
							{warehouseOptions.map((w) => (
								<Box
									key={w.id}
									className="flex items-center gap-3"
									sx={{
										border: '1px solid',
										borderColor: 'divider',
										borderRadius: 2,
										px: 2,
										py: 1.5
									}}
								>
									<Box className="min-w-0 flex-1">
										<Typography variant="body2" fontWeight={600} noWrap>
											{w.name}
										</Typography>
										{w.location ? (
											<Typography variant="caption" color="text.secondary" noWrap display="block">
												{w.location}
											</Typography>
										) : null}
									</Box>
									<TextField
										value={qtyForWarehouse(w.id)}
										onChange={(e) => setWarehouseQty(w.id, e.target.value)}
										label={multiStore ? undefined : 'Quantity on hand'}
										type="number"
										variant="outlined"
										size="small"
										sx={{
											...textFieldSx,
											width: multiStore ? 120 : '100%',
											maxWidth: multiStore ? 140 : undefined,
											flexShrink: 0
										}}
										inputProps={{
											min: 0,
											step: allowsFractional ? 0.01 : 1,
											'aria-label': `Opening quantity for ${w.name}`
										}}
									/>
								</Box>
							))}
						</Box>
					)}
				</Box>
			</SectionCard>
		) : null}

		<SectionCard title="Description & categories" icon="heroicons-outline:document-text">
			<Box className="flex flex-col gap-4">
				<Controller
					name="description"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							required
							id="description"
							label="Description"
							type="text"
							multiline
							minRows={5}
							variant="outlined"
							fullWidth
							sx={textFieldSx}
						/>
					)}
				/>

				<Controller
					name="categories"
					control={control}
					render={({ field: { onChange, value } }) => (
						<Autocomplete<CategoryOption, true>
							multiple
							options={categoryOptions}
							value={categoriesFormValueToOptions(value, categoryOptions)}
							onChange={(_, newValue) => {
								onChange(newValue.map((c) => c.id));
							}}
							getOptionLabel={(option) => option.name}
							isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
							fullWidth
							renderInput={(params) => (
								<TextField
									{...params}
									placeholder="Select categories"
									label="Categories"
									variant="outlined"
									sx={textFieldSx}
									InputLabelProps={{ shrink: true }}
								/>
							)}
						/>
					)}
				/>
			</Box>
		</SectionCard>

		<SectionCard title="Pay over time" icon="heroicons-outline:banknotes">
			<Box className="flex flex-col gap-4">
				<Controller
					name="installment_enabled"
					control={control}
					render={({ field }) => (
						<FormControlLabel
							control={
								<Switch
									checked={Boolean(field.value)}
									onChange={(_, checked) => field.onChange(checked)}
								/>
							}
							label="Allow customers to pay over time (flexible partial payments)"
						/>
					)}
				/>
				<Controller
					name="installment_min_initial_percent"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							label="Minimum initial payment (%)"
							type="number"
							variant="outlined"
							fullWidth
							inputProps={{ min: 0, max: 100, step: 0.01 }}
							helperText="Optional down payment at checkout (e.g. 20 for 20%). Leave empty for no minimum."
							sx={textFieldSx}
						/>
					)}
				/>
				<Controller
					name="installment_min_payment_amount"
					control={control}
					render={({ field }) => (
						<TextField
							{...field}
							value={field.value ?? ''}
							label="Minimum partial payment (GHS)"
							type="number"
							variant="outlined"
							fullWidth
							inputProps={{ min: 0, step: 0.01 }}
							helperText="Smallest amount per payment after checkout. Optional."
							sx={textFieldSx}
						/>
					)}
				/>
			</Box>
		</SectionCard>
		</Box>
	);
}

export default BasicInfoTab;
