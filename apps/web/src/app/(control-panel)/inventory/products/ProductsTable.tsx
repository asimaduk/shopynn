import { useEffect, useMemo, useState } from 'react';
import useNavigate from '@fuse/hooks/useNavigate';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import { Dialog, DialogActions, DialogContent, DialogTitle, ListItemIcon, MenuItem, Paper, TextField } from '@mui/material';
import _ from 'lodash';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import Typography from '@mui/material/Typography';
import clsx from 'clsx';
import Button from '@mui/material/Button';
import ECommerceApi, { EcommerceProduct, useChangeProductPriceMutation, useDeleteECommerceProductsMutation, useToggleProductStatusMutation } from '../ECommerceApi';
import toast from 'react-hot-toast';
import store from '@/store/store';
import { URLS } from '@/configs/settingsConfig';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';

function ProductsTable() {
	const navigate = useNavigate();

	//let { data: _products, isLoading, refetch } = useGetECommerceProductsQuery(null,{refetchOnMountOrArgChange: true});
	const [removeProducts] = useDeleteECommerceProductsMutation();
	const [toggleProductStatus] = useToggleProductStatusMutation();
	const [changeProductPrice, { isLoading: changingPrice }] = useChangeProductPriceMutation();
	const [products, setProducts] = useState([]);
	const [rowCount, setRowCount] = useState(0);
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 10
	});
	const [globalFilter, setGlobalFilter] = useState('');
	const [loading, setLoading] = useState(true);
	const [priceDialogOpen, setPriceDialogOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<EcommerceProduct | null>(null);
	const [priceForm, setPriceForm] = useState({ unit_price: '', alt_price: '' });
	// useEffect(()=> {		
	// 	// console.log('_products',_products);
		
	// 	if(!isLoading) {
	// 		// setProducts(_products)
	// 	}
	// },[isLoading])

	useEffect(()=> {
		getProductsCount();
	},[])

	const getProductsCount = async () => {
		const promise = store.store.dispatch(ECommerceApi.endpoints.getECommerceProductsCount.initiate(null,{forceRefetch:true}));
        const { data } = await promise;    
		if(data.count) {
			setRowCount(data.count)
		}
	}
	
	useEffect(() => {
		//do something when the pagination state changes
		// console.log('table change pageIndex',pagination.pageIndex);

		fetchData(pagination.pageIndex, pagination.pageSize, globalFilter)
	}, [pagination.pageIndex, pagination.pageSize, globalFilter, rowCount]);

	const fetchData = async (pageIndex, pageSize, searchText?) => {
		const pageNumber = pageIndex + 1;

		// console.log('page info',{pageNumber, pageSize, searchText});
		
		setLoading(true); 
        const promise = store.store.dispatch(ECommerceApi.endpoints.getECommerceProductsWithPagination.initiate({pageNumber: searchText ? 1 : pageNumber, pageSize: searchText ? 10 : pageSize, searchText: searchText || ''},{forceRefetch:true}));
        const { data } = await promise;    
            		
        setProducts(data)        
        setLoading(false);
	}

	const openChangePriceDialog = (product: EcommerceProduct) => {
		setSelectedProduct(product);
		setPriceForm({
			unit_price: product?.unit_price != null ? String(product.unit_price) : '',
			alt_price: product?.alt_price != null ? String(product.alt_price) : ''
		});
		setPriceDialogOpen(true);
	};

	const handleSubmitPriceChange = async () => {
		if (!selectedProduct?.id) return;

		const unit = Number(priceForm.unit_price);
		const alt = Number(priceForm.alt_price);
		if (!Number.isFinite(unit) || unit < 0) {
			toast.error('Unit price must be a valid non-negative number.');
			return;
		}
		if (!Number.isFinite(alt) || alt < 0) {
			toast.error('Alt price must be a valid non-negative number.');
			return;
		}

		try {
			await changeProductPrice({
				id: selectedProduct.id,
				unit_price: unit,
				alt_price: alt
			}).unwrap();
			toast.success('Price updated.');
			setPriceDialogOpen(false);
			fetchData(pagination.pageIndex, pagination.pageSize, globalFilter);
		} catch {
			toast.error('Failed to update price.');
		}
	};

	const columns = useMemo<MRT_ColumnDef<EcommerceProduct>[]>(
		() => [
			{
				accessorFn: (row) => row.thumbnail,
				id: 'thumbnail',
				header: '',
				enableColumnFilter: false,
				enableColumnDragging: false,
				size: 64,
				enableSorting: false,
				Cell: ({ row }) => (
					<div className="flex items-center justify-center">
						{
							// row.original?.images?.length > 0 && 
							row.original.thumbnail ? (
							<img
								className="w-full max-h-9 max-w-9 block rounded-sm"
								// src={_.find(row.original.images, { id: row.original.featuredImageId })?.url}
								src={`${URLS.serverUrl}/images?id=${row.original.thumbnail}`}
								alt={row.original.name}
							/>
						) : (
							<img
								className="w-full max-h-9 max-w-9 block rounded-sm"
								src="/assets/images/apps/ecommerce/product-image-placeholder.png"
								alt={row.original.name}
							/>
						)}
					</div>
				)
			},
			{
				accessorKey: 'sku',
				header: 'Code / SKU',
				accessorFn: (row) => row.sku
			},
			{
				accessorKey: 'name',
				header: 'Name',
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/inventory/products/${row.original.slug}/view`}
						role="button"
						sx={{
							color: 'primary.main',
							fontWeight: 600,
							'&:hover': { color: 'primary.dark' }
						}}
					>
						<u>{row.original.name}</u>
					</Typography>
				)
			},
			{
				accessorKey: 'quantity',
				header: 'QTY',
				accessorFn: (row) => (
					<div className="flex items-center space-x-2">
						<span>{row.inventory || 0}</span>
						<i
							className={clsx(
								'inline-block w-2 h-2 rounded-sm',
								row.inventory <= 5 && 'bg-red',
								row.inventory > 5 && row.quantity <= 25 && 'bg-orange',
								row.inventory > 25 && 'bg-green'
							)}
						/>
					</div>
				)
			},
			{
				accessorKey: 'stores_quantities',
				header: 'Stock',
				accessorFn: (row) => (
					<div className="flex flex-wrap space-x-0.5">
						{row.stores_quantities?.map((item, i) => (
							<span key={i}>{item.name} ({item.quantity_available}){i<(row.stores_quantities.length-1)?',':''}</span>
						))}
					</div>
				)
			},
			// {
			// 	accessorKey: 'categories',
			// 	header: 'Category',
			// 	accessorFn: (row) => (
			// 		<div className="flex flex-wrap space-x-0.5">
			// 			{row.categories?.map((item) => (
			// 				<Chip
			// 					key={item}
			// 					className="text-sm"
			// 					size="small"
			// 					color="default"
			// 					label={item}
			// 				/>
			// 			))}
			// 		</div>
			// 	)
			// },
			{
				accessorKey: 'unit_price',
				header: 'Price',
				accessorFn: (row) => formatGhsCurrency(Number(row.unit_price ?? 0), 2, 2)
			},
			{
				accessorKey: 'reorder_quantity',
				header: 'Reorder Level',
				accessorFn: (row) => row.reorder_quantity
			},
			{
				accessorKey: 'active',
				header: 'Active',
				accessorFn: (row) => (
					<div className="flex items-center">
						{row.active ? (
							<FuseSvgIcon
								className="text-green-500"
								size={20}
							>
								heroicons-outline:check-circle
							</FuseSvgIcon>
						) : (
							<FuseSvgIcon
								className="text-red-500"
								size={20}
							>
								heroicons-outline:minus-circle
							</FuseSvgIcon>
						)}
					</div>
				)
			}
		],
		[]
	);

	// if (isLoading) {
	// 	return <FuseLoading />;
	// }

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			{loading && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
					<FuseLoading />
				</div>
			)}
			<DataTable
				columns={columns}
				data={products || []}
				manualPagination={true}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
					columnPinning: {
						left: ['mrt-row-expand', 'mrt-row-select'],
						right: ['mrt-row-actions']
					},
				}}
				rowCount={globalFilter ? 1 : rowCount}
				state={{ pagination }}
				onPaginationChange={ setPagination }
				onGlobalFilterChange={ setGlobalFilter }
				// muiPaginationProps={{
				// 	rowsPerPageOptions: [5,10,20,50]
				// }}
				enableRowSelection={false}
				renderRowActionMenuItems={({ closeMenu, row, table }) => [
					<MenuItem
						key={0}
						onClick={() => {
							closeMenu();
							navigate(`/inventory/products/${row.original.slug}/view`);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:eye</FuseSvgIcon>
						</ListItemIcon>
						Details
					</MenuItem>,
					<MenuItem
						key={1}
						onClick={() => {
							closeMenu();
							navigate(`/inventory/products/${row.original.slug}`);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:pencil-square</FuseSvgIcon>
						</ListItemIcon>
						Edit
					</MenuItem>,
					<MenuItem
						key={2}
						onClick={() => {
							if(row.original.active) {
								toggleProductStatus({id: row.original.id, status: false})
									.then(r=> toast.success('Update done.'))
									.catch(e=> toast.error('An error occurred.'))
								closeMenu();
								// table.resetRowSelection();
							}
							else {
								toggleProductStatus({id: row.original.id, status: true})
									.then(r=> toast.success('Update done.'))
									.catch(e=> toast.error('An error occurred.'))
								closeMenu();
							}

							fetchData(pagination.pageIndex, pagination.pageSize)
							// refetch()
							// 	.then(res=> {
							// 		if(res.data?.length > 0) {
							// 			setProducts(res.data)
							// 		}
							// 	})
							// 	.catch(e=> toast.error(`Failed to refresh page data.`))
						}}
					>
						{row.original.active ?
							<ListItemIcon>
								<FuseSvgIcon className="text-red-500">heroicons-outline:minus-circle</FuseSvgIcon>
							</ListItemIcon>
							:
							<ListItemIcon>
							<FuseSvgIcon className="text-green-500">heroicons-outline:check-circle</FuseSvgIcon>
						</ListItemIcon>
						}
						{row.original.active ? 'Deactivate':'Activate'}
					</MenuItem>,
					<MenuItem
						key={3}
						onClick={() => {
							closeMenu();
							navigate(`/inventory/transactions?product=${row.original.slug}&product_id=${row.original.id}&name=${row.original.name}`);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:list-bullet</FuseSvgIcon>
						</ListItemIcon>
						Transactions
					</MenuItem>
					,
					<MenuItem
						key={4}
						onClick={() => {
							closeMenu();
							openChangePriceDialog(row.original);
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:currency-dollar</FuseSvgIcon>
						</ListItemIcon>
						Change price
					</MenuItem>
					
				]}
				renderTopToolbarCustomActions={({ table }) => {
					const { rowSelection } = table.getState();

					if (Object.keys(rowSelection).length === 0) {
						return null;
					}

					return (
						<Button
							variant="contained"
							size="small"
							onClick={() => {
								const selectedRows = table.getSelectedRowModel().rows;
								removeProducts(selectedRows.map((row) => row.original.id));
								table.resetRowSelection();
							}}
							className="flex shrink min-w-9 ltr:mr-2 rtl:ml-2"
							color="secondary"
						>
							<FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
							<span className="hidden sm:flex mx-2">Delete selected items</span>
						</Button>
					);
				}}
			/>
			<Dialog open={priceDialogOpen} onClose={() => !changingPrice && setPriceDialogOpen(false)} maxWidth="xs" fullWidth>
				<DialogTitle>Change product price</DialogTitle>
				<DialogContent className="space-y-16">
					<TextField
						fullWidth
						label="Unit price"
						type="number"
						value={priceForm.unit_price}
						onChange={(e) => setPriceForm((prev) => ({ ...prev, unit_price: e.target.value }))}
						inputProps={{ min: 0, step: '0.01' }}
						InputLabelProps={{ shrink: true }}
						autoFocus
						className='mb-5 mt-2'
					/>
					<TextField
						fullWidth
						label="Alt price"
						type="number"
						value={priceForm.alt_price}
						onChange={(e) => setPriceForm((prev) => ({ ...prev, alt_price: e.target.value }))}
						inputProps={{ min: 0, step: '0.01' }}
						InputLabelProps={{ shrink: true }}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPriceDialogOpen(false)} disabled={changingPrice}>
						Cancel
					</Button>
					<Button onClick={handleSubmitPriceChange} variant="contained" disabled={changingPrice}>
						{changingPrice ? 'Saving...' : 'Save'}
					</Button>
				</DialogActions>
			</Dialog>
		</Paper>
	);
}

export default ProductsTable;
