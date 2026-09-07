import { useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Typography from '@mui/material/Typography';
import { useCreateSaleMutation } from '../TradingApi';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { removeItem, selectPendingSales, setPendingSales } from './pendingSalesSlice';
import toast from 'react-hot-toast';
import { URLS } from '@/configs/settingsConfig';

function safeString(v: any): string {
	if (typeof v === 'string') return v;
	if (v == null) return '';
	return String(v);
}

function getErrorCode(err: any): string {
	return safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
}

function getErrorMessage(err: any): string {
	return safeString(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Upload failed.');
}

function formatDateAndTime(date: string): string {
	return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLastAttempt(iso: string | null | undefined): string {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return '—';
	}
}

function ProductsTable() {
	const [processing, setProcessing] = useState(false);
	const pendingSales = useAppSelector(selectPendingSales);
	const [createSale] = useCreateSaleMutation();
	const dispatch = useAppDispatch();

	function uploadSingleSale(sale) {
		const record = sale?.payload ? sale : { id: sale?.id ?? Date.now(), payload: sale };
		const id = record.id;
		const nowIso = new Date().toISOString();
		// console.log('sale is',sale);
		// delete sale['customer'];
		// delete sale['id'];

		setProcessing(true)
		createSale(record.payload)
			.then(res=> {
				// console.log('res is',res);
				if(res.data) {
					toast.success('Sale uploaded successfully.')
					dispatch(removeItem({id}));
				}
				else {
					dispatch(setPendingSales(pendingSales.map((p) => {
						if ((p?.payload ? p.id : p?.id) !== id) return p;
						const r = p?.payload ? p : { id, payload: record.payload };
						return {
							...r,
							attempts: Number(r?.attempts ?? 0) + 1,
							last_attempt_at: nowIso,
							last_error_code: r?.last_error_code ?? 'UNKNOWN',
							last_error_message: r?.last_error_message ?? 'Upload failed.'
						};
					})));
					toast.error('An error occurred. Please re-upload.')
				}
			})
			.catch(err=> {
				// dispatch(showMessage({ message: `Error uploading sale item: ${err.message}. Please try again.`, variant: 'error' }))
				dispatch(setPendingSales(pendingSales.map((p) => {
					if ((p?.payload ? p.id : p?.id) !== id) return p;
					const r = p?.payload ? p : { id, payload: record.payload };
					return {
						...r,
						attempts: Number(r?.attempts ?? 0) + 1,
						last_attempt_at: nowIso,
						last_error_code: getErrorCode(err) || r?.last_error_code || null,
						last_error_message: getErrorMessage(err) || r?.last_error_message || null
					};
				})));
				toast.error(`Error uploading sale item: ${err.message}. Please try again.`);
			})
			.finally(()=> setProcessing(false))
	}
	
	const columns = useMemo<MRT_ColumnDef<any>[]>(
		() => [
			// {
			// 	accessorFn: (row) => row.id,
			// 	id: 'id',
			// 	header: '',
			// 	enableColumnFilter: false,
			// 	enableColumnDragging: false,
			// 	size: 64,
			// 	enableSorting: false,
			// 	Cell: ({ row }) => (
			// 		<div className="flex items-center justify-center">
			// 			{
			// 				// row.original?.images?.length > 0 && 
			// 				row.original.customer_thumbnail ? (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					// src={_.find(row.original.images, { id: row.original.featuredImageId })?.url}
			// 					src={`${URLS.serverUrl}/images?id=${row.original.customer_thumbnail}`}
			// 					alt={row.original.customer_thumbnail}
			// 				/>
			// 			) : (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					src="/assets/images/apps/ecommerce/product-image-placeholder.png"
			// 					alt={row.original.customer_thumbnail}
			// 				/>
			// 			)}
			// 		</div>
			// 	)
			// },
			{
				accessorKey: 'customer',
				header: 'Customer',
				muiTableHeadCellProps: { sx: { pl: 2.5 } },
				muiTableBodyCellProps: { sx: { pl: 2.5 } },
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return payload?.customer ?? '';
				}
			},
			{
				accessorKey: 'products',
				header: 'Quantity',
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return payload?.products?.reduce((acc, curr) => acc + Number(curr.quantity), 0) ?? 0;
				}
			},
			{
				accessorKey: 'total_amount',
				header: 'Total (GHS)',
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return `${Number(payload?.total_amount ?? 0).toFixed(2)}`;
				}
			},
			{
				accessorKey: 'discount_amount',
				header: 'Discount (GHS)',
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return `${Number(payload?.discount_amount ?? 0).toFixed(2)}`;
				}
			},
			{
				accessorKey: 'cashier',
				header: 'Cashier',
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return <span>{payload?.cashier ?? ''}</span>;
				}
			},
			{
				accessorKey: 'sale_date',
				header: 'Date',
				accessorFn: (row) => {
					const payload = (row as any)?.payload ?? row;
					return <span>{formatDateAndTime(payload?.sale_date ?? payload?.created_at) ?? ''}</span>;
				}
			},
			{
				id: 'attempts',
				header: 'Attempts',
				size: 88,
				muiTableHeadCellProps: { align: 'center' },
				muiTableBodyCellProps: { align: 'center' },
				accessorFn: (row) => Number((row as any)?.attempts ?? 0),
				Cell: ({ row }) => (
					<Typography variant="body2" component="span">
						{Number((row.original as any)?.attempts ?? 0)}
					</Typography>
				)
			},
			{
				id: 'last_attempt_at',
				header: 'Last attempt',
				size: 160,
				accessorFn: (row) => formatLastAttempt((row as any)?.last_attempt_at),
				Cell: ({ row }) => (
					<Typography variant="body2" color="text.secondary" noWrap title={String((row.original as any)?.last_attempt_at ?? '')}>
						{formatLastAttempt((row.original as any)?.last_attempt_at)}
					</Typography>
				)
			},
			{
				id: 'last_error_message',
				header: 'Last error',
				size: 220,
				accessorFn: (row) => String((row as any)?.last_error_message ?? ''),
				Cell: ({ row }) => {
					const msg = safeString((row.original as any)?.last_error_message);
					return (
						<Typography
							variant="body2"
							color={msg ? 'error' : 'text.secondary'}
							sx={{
								maxWidth: 280,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap'
							}}
							title={msg || undefined}
						>
							{msg || '—'}
						</Typography>
					);
				}
			}
		],
		[]
	);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			{processing && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
					<FuseLoading />
				</div>
			)}
			<DataTable
				data={pendingSales}
				columns={columns}
				enableRowSelection={false}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
					columnPinning: {
						left: ['mrt-row-expand', 'mrt-row-select'],
						right: ['mrt-row-actions']
					},
					pagination: {
						pageSize: 15,
						pageIndex: 0
					}
				}}
				muiTableProps={{
					size: 'small'
				}}
				renderRowActionMenuItems={({ closeMenu, row, table }) => [
					<MenuItem
						key={0}
						onClick={() => {
							uploadSingleSale(row.original);
							// removeSingleProduct(row.original.id);
							closeMenu();
							table.resetRowSelection();
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:arrow-up-on-square-stack</FuseSvgIcon>
						</ListItemIcon>
						Push
					</MenuItem>
				]}
				// renderTopToolbarCustomActions={({ table }) => {
				// 	const { rowSelection } = table.getState();

				// 	if (Object.keys(rowSelection).length === 0) {
				// 		return null;
				// 	}

				// 	return (
				// 		<Button
				// 			variant="contained"
				// 			size="small"
				// 			onClick={() => {
				// 				const selectedRows = table.getSelectedRowModel().rows;
				// 				removeProducts(selectedRows.map((row) => row.original.id));
				// 				table.resetRowSelection();
				// 			}}
				// 			className="flex shrink min-w-9 ltr:mr-2 rtl:ml-2"
				// 			color="secondary"
				// 		>
				// 			<FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
				// 			<span className="hidden sm:flex mx-2">Delete selected items</span>
				// 		</Button>
				// 	);
				// }}
			/>
		</Paper>
	);
}

export default ProductsTable;
