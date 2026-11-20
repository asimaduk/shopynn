'use client';

import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import toast from 'react-hot-toast';
import { useImportECommerceProductRowMutation } from '../../../ECommerceApi';
import useNavigate from '@fuse/hooks/useNavigate';

export type ImportRow = {
	name: string;
	sku: string;
	barcode: string;
	retail_price: string | number;
	wholesale_price: string | number;
	unit: string;
	/** Opening stock quantity */
	quantity: string | number;
	/** Store reference code or exact store name; blank = current store */
	store_code: string;
};

function createSlug(slg: string) {
	if (!slg) return '';
	let rtn = `${slg}`.toLowerCase();
	rtn = rtn.split(' ').join('-');
	return rtn;
}

function parseOpeningQty(raw: unknown): number {
	if (raw === '' || raw == null) return 0;
	const n = Number(raw);
	return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function mapSheetRows(json: Record<string, unknown>[]): ImportRow[] {
	return json.map((row) => ({
		name: (row.Name ?? row.name ?? '') as string,
		sku: (row.SKU ?? row.sku ?? '') as string,
		barcode: (row.Barcode ?? row.barcode ?? row['Bar Code'] ?? '') as string,
		retail_price: (row.Retail ?? row.RetailPrice ?? row.retail_price ?? row.Price ?? '') as string | number,
		wholesale_price: (row.Wholesale ?? row.WholesalePrice ?? row.wholesale_price ?? row['Wholesale Price'] ?? '') as
			| string
			| number,
		unit: (row.Unit ?? row.unit ?? 'pcs') as string,
		quantity: (row.Quantity ??
			row.quantity ??
			row['Opening Stock'] ??
			row['Opening stock'] ??
			row.opening_quantity ??
			0) as string | number,
		store_code: String(
			row.StoreCode ??
				row.store_code ??
				row['Store Code'] ??
				row.Store ??
				row.store ??
				row.Warehouse ??
				row.warehouse ??
				row.Reference ??
				row.reference_code ??
				''
		).trim()
	}));
}

function buildImportPayload(row: ImportRow, rowIndex: number): Record<string, unknown> {
	const name = String(row.name).trim();
	const slug = createSlug(name) || `import-${Date.now()}-${rowIndex}`;
	const unitPrice = parseFloat(String(row.retail_price)) || 0;
	const wholesaleRaw = row.wholesale_price;
	const altPrice =
		wholesaleRaw !== '' && wholesaleRaw != null ? parseFloat(String(wholesaleRaw)) || 0 : 0;
	const openingQty = parseOpeningQty(row.quantity);
	const sku = String(row.sku || '').trim();
	const storeCode = String(row.store_code || '').trim();

	return {
		name,
		description: '-',
		sku,
		unit_price: unitPrice,
		alt_price: altPrice,
		categories: [],
		tags: [],
		reorder_quantity: 0,
		slug,
		unit: String(row.unit || 'pcs').trim(),
		bar_code: String(row.barcode || '').trim() || null,
		opening_quantity: openingQty,
		store_code: storeCode || undefined
	};
}

type ProductBulkImportDialogProps = {
	open: boolean;
	onClose: () => void;
};

function ProductBulkImportDialog({ open, onClose }: ProductBulkImportDialogProps) {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [importRow] = useImportECommerceProductRowMutation();
	const [fileName, setFileName] = useState('');
	const [rows, setRows] = useState<ImportRow[]>([]);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [loading, setLoading] = useState(false);
	const [parsing, setParsing] = useState(false);

	const resetState = useCallback(() => {
		setFileName('');
		setRows([]);
		setSelected(new Set());
		if (fileInputRef.current) fileInputRef.current.value = '';
	}, []);

	const handleClose = () => {
		if (!loading) {
			resetState();
			onClose();
		}
	};

	const parseFile = useCallback((file: File) => {
		setParsing(true);
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = new Uint8Array(e.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: 'array' });
				const sheetName = workbook.SheetNames[0];
				const sheet = workbook.Sheets[sheetName];
				const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
				if (!Array.isArray(json) || json.length === 0) {
					toast.error('No rows were found in the selected file.');
					setRows([]);
					setSelected(new Set());
					return;
				}
				const mapped = mapSheetRows(json);
				setRows(mapped);
				setSelected(new Set(mapped.map((_, idx) => idx)));
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : 'Could not read the file.';
				toast.error(msg);
				setRows([]);
				setSelected(new Set());
			} finally {
				setParsing(false);
			}
		};
		reader.onerror = () => {
			toast.error('Could not read the file.');
			setParsing(false);
		};
		reader.readAsArrayBuffer(file);
	}, []);

	const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (ev) => {
		const file = ev.target.files?.[0];
		if (!file) return;
		const lower = file.name.toLowerCase();
		if (!['.xlsx', '.xls', '.csv'].some((ext) => lower.endsWith(ext))) {
			toast.error('Please select an Excel (.xlsx, .xls) or CSV file.');
			return;
		}
		setFileName(file.name);
		parseFile(file);
	};

	const toggleRow = (index: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	const selectAllToggle = () => {
		if (rows.length === 0) return;
		if (selected.size === rows.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(rows.map((_, i) => i)));
		}
	};

	const handleImport = async () => {
		if (rows.length === 0 || selected.size === 0) {
			toast.error('Select at least one product to import.');
			return;
		}
		setLoading(true);
		let created = 0;
		let stocked = 0;
		let failed = 0;
		let lastError = '';
		try {
			const indices = [...selected].sort((a, b) => a - b);
			for (const idx of indices) {
				const row = rows[idx];
				if (!row.name || row.retail_price === '' || row.retail_price == null) {
					continue;
				}
				const name = String(row.name).trim();
				if (!name) {
					continue;
				}
				const unitPrice = parseFloat(String(row.retail_price));
				if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
					continue;
				}
				if (!String(row.sku || '').trim()) {
					failed++;
					lastError = 'SKU is required on every row.';
					continue;
				}
				const payload = buildImportPayload(row, idx);
				try {
					const result = await importRow(payload).unwrap();
					if (result?.created) created++;
					else if ((result?.stock_added ?? 0) > 0) stocked++;
					else created++; // existing SKU with no stock change still counts as handled
				} catch (err: unknown) {
					failed++;
					const e = err as { data?: { message?: string }; message?: string };
					lastError = e?.data?.message || e?.message || lastError;
				}
			}
			const ok = created + stocked;
			if (ok > 0) {
				const parts = [
					created ? `${created} created` : null,
					stocked ? `${stocked} stocked at store` : null,
					failed ? `${failed} failed` : null
				].filter(Boolean);
				toast.success(`Import done${parts.length ? `: ${parts.join(', ')}` : ''}.`);
				resetState();
				onClose();
				navigate('/inventory/products');
			} else {
				toast.error(
					lastError ||
						(failed
							? 'No products were imported. Check required fields, store codes, and SKUs.'
							: 'Nothing to import.')
				);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="md"
			fullWidth
			scroll="paper"
		>
			<DialogTitle className="flex items-center gap-2">
				<FuseSvgIcon size={22}>heroicons-outline:arrow-up-tray</FuseSvgIcon>
				Import products from Excel
			</DialogTitle>
			<DialogContent dividers>
				<Typography variant="body2" color="text.secondary" className="mb-3">
					Columns: Name, SKU, Barcode, RetailPrice, WholesalePrice, Unit, Quantity, StoreCode. Name, SKU, and
					retail price are required. Quantity is optional opening stock. StoreCode is optional (store
					reference code or exact store name); blank uses your current store. Same SKU on another store row
					adds stock to that store instead of creating a duplicate product.
				</Typography>

				<Box
					sx={{
						border: 1,
						borderColor: 'divider',
						borderRadius: 1,
						overflow: 'hidden',
						mb: 2
					}}
				>
					<Table size="small" sx={{ '& td': { py: 0.75 } }}>
						<TableBody>
							{[
								{ col: 'Name', req: 'Yes', ex: 'Coca Cola 330ml' },
								{ col: 'SKU', req: 'Yes', ex: 'CC-330-01' },
								{ col: 'Barcode', req: 'No', ex: '8901234567890' },
								{ col: 'RetailPrice', req: 'Yes', ex: '5.50' },
								{ col: 'WholesalePrice', req: 'No', ex: '4.20' },
								{ col: 'Unit', req: 'No', ex: 'pcs' },
								{ col: 'Quantity', req: 'No', ex: '24' },
								{ col: 'StoreCode', req: 'No', ex: 'accra-main' }
							].map((r) => (
								<TableRow key={r.col}>
									<TableCell width="28%">{r.col}</TableCell>
									<TableCell width="18%">{r.req}</TableCell>
									<TableCell>{r.ex}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Box>

				<input
					ref={fileInputRef}
					type="file"
					accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
					className="hidden"
					onChange={onPickFile}
				/>

				<Button
					variant="outlined"
					color="secondary"
					startIcon={<FuseSvgIcon size={18}>heroicons-outline:cloud-arrow-up</FuseSvgIcon>}
					onClick={() => fileInputRef.current?.click()}
					disabled={loading || parsing}
				>
					{fileName ? 'Change file' : 'Choose file'}
				</Button>
				{fileName ? (
					<Typography variant="caption" display="block" className="mt-2" color="text.secondary">
						Selected: {fileName}
					</Typography>
				) : null}

				{(parsing || loading) && <LinearProgress className="mt-3" />}

				{rows.length > 0 && (
					<Box className="mt-3">
						<Box className="flex justify-between items-center mb-1">
							<Typography variant="body2" color="text.secondary">
								{selected.size} of {rows.length} selected
							</Typography>
							<Button size="small" onClick={selectAllToggle}>
								{selected.size === rows.length ? 'Deselect all' : 'Select all'}
							</Button>
						</Box>
						<TableContainer sx={{ maxHeight: 320 }}>
							<Table size="small" stickyHeader>
								<TableHead>
									<TableRow>
										<TableCell padding="checkbox" />
										<TableCell>Name</TableCell>
										<TableCell>SKU</TableCell>
										<TableCell align="right">Retail</TableCell>
										<TableCell align="right">Qty</TableCell>
										<TableCell>Store</TableCell>
										<TableCell>Unit</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{rows.map((row, index) => (
										<TableRow
											key={`row-${index}`}
											hover
											selected={selected.has(index)}
											onClick={() => toggleRow(index)}
											sx={{ cursor: 'pointer' }}
										>
											<TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
												<Checkbox
													checked={selected.has(index)}
													onChange={() => toggleRow(index)}
													size="small"
												/>
											</TableCell>
											<TableCell>{row.name || '—'}</TableCell>
											<TableCell>{row.sku || '—'}</TableCell>
											<TableCell align="right">{row.retail_price ?? '—'}</TableCell>
											<TableCell align="right">{row.quantity ?? 0}</TableCell>
											<TableCell>{row.store_code || 'Current'}</TableCell>
											<TableCell>{row.unit || 'pcs'}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					</Box>
				)}
			</DialogContent>
			<DialogActions className="px-4 pb-4">
				<Button onClick={handleClose} disabled={loading}>
					Cancel
				</Button>
				<Button
					variant="contained"
					color="secondary"
					disabled={loading || parsing || rows.length === 0 || selected.size === 0}
					onClick={handleImport}
				>
					Import selected
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default ProductBulkImportDialog;
