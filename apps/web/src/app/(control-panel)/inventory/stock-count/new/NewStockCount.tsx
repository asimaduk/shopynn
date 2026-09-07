'use client';

import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSnackbar } from 'notistack';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useGetWarehousesQuery } from 'src/app/(control-panel)/setups/warehouses/WarehouseApi';
import NewStockCountHeader from './NewStockCountHeader';
import {
	useCreateStockCountMutation,
	useGetProductsForStockCountQuery,
	type StockCountProductLine
} from '../StockCountApi';

/** productId -> actual count input value (string for controlled input) */
type ActualCountState = Record<string, string>;

function filterProducts(products: StockCountProductLine[], search: string): StockCountProductLine[] {
	const q = search.trim().toLowerCase();
	if (!q) return products;
	return products.filter(
		(p) =>
			p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
	);
}

export default function NewStockCount() {
	const router = useRouter();
	const { enqueueSnackbar } = useSnackbar();
	const { data: warehouses = [], isLoading: warehousesLoading } = useGetWarehousesQuery();
	const [warehouseId, setWarehouseId] = useState('');
	const [reference, setReference] = useState('');
	const [notes, setNotes] = useState('');
	const [search, setSearch] = useState('');
	const [actualCounts, setActualCounts] = useState<ActualCountState>({});

	const {
		data: products = [],
		isLoading: productsLoading,
		isFetching: productsFetching,
		error: productsError
	} = useGetProductsForStockCountQuery(
		{ warehouse_id: warehouseId },
		{ skip: !warehouseId }
	);

	const [createStockCount, { isLoading: saving }] = useCreateStockCountMutation();

	useEffect(() => {
		setActualCounts({});
		setSearch('');
	}, [warehouseId]);

	const filteredProducts = useMemo(
		() => filterProducts(products, search),
		[products, search]
	);

	const uniqueProductTotal = useMemo(
		() => new Set(products.map((p) => p.id).filter(Boolean)).size,
		[products]
	);
	const uniqueFilteredTotal = useMemo(
		() => new Set(filteredProducts.map((p) => p.id).filter(Boolean)).size,
		[filteredProducts]
	);

	const handleActualChange = (productId: string, value: string) => {
		setActualCounts((prev) => ({ ...prev, [productId]: value }));
	};

	const linesWithCount = useMemo(() => {
		return filteredProducts
			.map((p) => {
				const raw = actualCounts[p.id] ?? '';
				const actual = raw === '' ? null : parseInt(raw, 10);
				if (actual === null || Number.isNaN(actual) || actual < 0) return null;
				return { product: p, actualCount: actual };
			})
			.filter((x): x is { product: StockCountProductLine; actualCount: number } => x !== null);
	}, [filteredProducts, actualCounts]);

	const handleUpload = async () => {
		if (!warehouseId) return;
		if (linesWithCount.length === 0) {
			enqueueSnackbar('Enter at least one actual count before uploading.', { variant: 'warning' });
			return;
		}
		try {
			await createStockCount({
				warehouse_id: warehouseId,
				reference_number: reference.trim() || undefined,
				notes: notes.trim() || undefined,
				status: 'Completed',
				items: linesWithCount.map(({ product, actualCount }) => ({
					product_id: product.id,
					inventory_id: product.inventoryId,
					expected_quantity: product.currentStock,
					counted_quantity: actualCount
				}))
			}).unwrap();
			enqueueSnackbar('Stock count saved.', { variant: 'success' });
			router.push('/inventory/stock-count');
		} catch (e) {
			const msg = e && typeof e === 'object' && 'data' in e ? String((e as { data?: unknown }).data) : String(e);
			enqueueSnackbar(msg || 'Could not save stock count.', { variant: 'error' });
		}
	};

	const productsBusy = productsLoading || productsFetching;
	const warehouseNameById = useMemo(() => {
		const m = new Map<string, string>();
		warehouses.forEach((w) => m.set(w.id, w.name));
		return m;
	}, [warehouses]);

	return (
		<div className="w-full h-full flex flex-col px-4">
			<NewStockCountHeader />
			<Paper className="shadow-sm rounded-xl overflow-hidden">
				<div className="p-4 flex flex-col gap-4 border-b border-gray-200">
					<div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 flex-wrap">
						<TextField
							select
							label="Warehouse"
							value={warehouseId}
							onChange={(e) => setWarehouseId(e.target.value)}
							variant="outlined"
							size="small"
							required
							disabled={warehousesLoading}
							sx={{ minWidth: 200 }}
						>
							{warehouses.map((w) => (
								<MenuItem key={w.id} value={w.id}>
									{w.name}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Reference (optional)"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
							variant="outlined"
							size="small"
							sx={{ minWidth: 180 }}
						/>
						<TextField
							label="Notes (optional)"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							variant="outlined"
							size="small"
							fullWidth
							multiline
							minRows={1}
							sx={{ flex: 1, minWidth: 200 }}
						/>
					</div>
					<div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Search products by name or SKU…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							disabled={!warehouseId || productsBusy}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<FuseSvgIcon size={20}>heroicons-outline:magnifying-glass</FuseSvgIcon>
									</InputAdornment>
								)
							}}
							sx={{ maxWidth: 360 }}
						/>
						<Typography variant="body2" color="text.secondary" className="sm:ml-auto flex items-center gap-2 flex-wrap">
							{productsBusy && warehouseId ? (
								<>
									<CircularProgress size={16} />
									Loading products…
								</>
							) : warehouseId ? (
								<>
									<strong className="text-foreground font-semibold">{uniqueFilteredTotal}</strong>
									{search.trim() && uniqueFilteredTotal !== uniqueProductTotal ? (
										<> of {uniqueProductTotal} </>
									) : null}{' '}
									unique product{uniqueProductTotal !== 1 ? 's' : ''}
									{search.trim() ? ' (filtered)' : ''}
									{warehouseNameById.get(warehouseId) ? (
										<span className="opacity-80"> · {warehouseNameById.get(warehouseId)}</span>
									) : null}
								</>
							) : null}
						</Typography>
					</div>
					{productsError && warehouseId && (
						<Typography color="error" variant="body2">
							Could not load products for this warehouse. Try again or pick another warehouse.
						</Typography>
					)}
				</div>
				<Table size="medium">
					<TableHead>
						<TableRow>
							<TableCell>Product</TableCell>
							<TableCell align="right">System stock</TableCell>
							<TableCell align="right" sx={{ minWidth: 160 }}>
								Actual count
							</TableCell>
							<TableCell align="right">Variance</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{filteredProducts.map((product) => {
							const raw = actualCounts[product.id] ?? '';
							const actual =
								raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
							const variance =
								actual !== null ? actual - product.currentStock : null;
							return (
								<TableRow key={product.id} hover>
									<TableCell>
										<Typography className="font-medium">{product.name}</Typography>
										<Typography variant="caption" color="text.secondary">
											{product.sku}
										</Typography>
									</TableCell>
									<TableCell align="right">{product.currentStock}</TableCell>
									<TableCell align="right">
										<TextField
											type="number"
											size="small"
											placeholder="Enter count"
											value={raw}
											onChange={(e) => handleActualChange(product.id, e.target.value)}
											inputProps={{ min: 0, step: 1 }}
											variant="outlined"
											sx={{ width: 120 }}
											disabled={!warehouseId || productsBusy}
										/>
									</TableCell>
									<TableCell align="right">
										{variance !== null ? (
											<Typography
												className={
													variance > 0
														? 'text-green-600'
														: variance < 0
															? 'text-red-600'
															: ''
												}
											>
												{variance > 0 ? `+${variance}` : variance}
											</Typography>
										) : (
											'—'
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				{!warehouseId && (
					<div className="p-8 text-center">
						<Typography color="text.secondary">
							Select a warehouse to load products for counting.
						</Typography>
					</div>
				)}
				{warehouseId && !productsBusy && !productsError && filteredProducts.length === 0 && (
					<div className="p-8 text-center">
						<Typography color="text.secondary">
							{search.trim()
								? 'No products match your search.'
								: 'No products returned for this warehouse.'}
						</Typography>
					</div>
				)}
				<div className="p-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
					<Button
						type="button"
						variant="outlined"
						onClick={() => router.push('/inventory/stock-count')}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="contained"
						color="primary"
						disabled={!warehouseId || saving || productsBusy}
						onClick={() => void handleUpload()}
						startIcon={
							<FuseSvgIcon size={20}>heroicons-outline:arrow-up-tray</FuseSvgIcon>
						}
					>
						{saving
							? 'Saving…'
							: linesWithCount.length > 0
								? `Upload (${linesWithCount.length} counted)`
								: 'Upload'}
					</Button>
				</div>
			</Paper>
		</div>
	);
}
