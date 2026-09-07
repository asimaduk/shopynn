import { useEffect, useMemo, useState } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import _ from 'lodash';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import Typography from '@mui/material/Typography';
// import Button from '@mui/material/Button';
import toast from 'react-hot-toast';
import { EcommerceProduct, useDeleteProductCategoryMutation, useUpdateProductCategoryMutation } from '../ECommerceApi';

type CategoriesTableProps = {
	data: EcommerceProduct[];
	isLoading: boolean;
};

function CategoriesTable({ data: categories, isLoading }: CategoriesTableProps) {
	const [removeCategory] = useDeleteProductCategoryMutation();
	const [updateCategory] = useUpdateProductCategoryMutation();

	/** MRT + RTK Query can schedule updates before mount; render table only after client mount (material-react-table#200). */
	const [tableMountReady, setTableMountReady] = useState(false);
	useEffect(() => {
		setTableMountReady(true);
	}, []);

	const setCategoryActive = async (category: EcommerceProduct, active: boolean) => {
		try {
			await updateCategory({ id: category.id, active }).unwrap();
			toast.success(active ? 'Category activated' : 'Category deactivated');
		} catch {
			toast.error('Failed to update category');
		}
	};

	const columns = useMemo<MRT_ColumnDef<EcommerceProduct>[]>(
		() => [
			// {
			// 	accessorFn: (row) => row.featuredImageId,
			// 	id: 'featuredImageId',
			// 	header: '',
			// 	enableColumnFilter: false,
			// 	enableColumnDragging: false,
			// 	size: 64,
			// 	enableSorting: false,
			// 	Cell: ({ row }) => (
			// 		<div className="flex items-center justify-center">
			// 			{row.original?.images?.length > 0 && row.original.featuredImageId ? (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					src={_.find(row.original.images, { id: row.original.featuredImageId })?.url}
			// 					alt={row.original.name}
			// 				/>
			// 			) : (
			// 				<img
			// 					className="w-full max-h-9 max-w-9 block rounded-sm"
			// 					src="/assets/images/apps/ecommerce/product-image-placeholder.png"
			// 					alt={row.original.name}
			// 				/>
			// 			)}
			// 		</div>
			// 	)
			// },
			{
				accessorKey: 'name',
				header: 'Name',
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/inventory/categories/${row.original.id}/${createSlug(row.original.name)}`}
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
				accessorKey: 'description',
				header: 'Description',
				accessorFn: (row) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.description}</span>
						{/* {row.categories.map((item) => (
							<Chip
								key={item}
								className="text-sm"
								size="small"
								color="default"
								label={item}
							/>
						))} */}
					</div>
				)
			},
			{
				id: 'product_count',
				header: 'Products',
				accessorFn: (row) => Number(row.product_count ?? 0)
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

	function createSlug(slg) {		
		if(!slg) return "";
		let rtn = `${slg}`.toLowerCase();
		rtn = rtn.split(' ').join('-');
		return rtn;
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	if (!tableMountReady) {
		return <FuseLoading />;
	}

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={categories || []}
				columns={columns}
				initialState={{
					density: 'compact',
					showColumnFilters: false,
					showGlobalFilter: true,
				}}
				enableRowSelection={false}
				renderRowActionMenuItems={({ closeMenu, row, table }) => {
					const isActive = row.original.active !== false;
					return [
						<MenuItem
							key="toggle-active"
							onClick={() => {
								void setCategoryActive(row.original, !isActive);
								closeMenu();
								table.resetRowSelection();
							}}
						>
							<ListItemIcon>
								<FuseSvgIcon size={20}>
									{isActive ? 'heroicons-outline:no-symbol' : 'heroicons-outline:check-circle'}
								</FuseSvgIcon>
							</ListItemIcon>
							{isActive ? 'Deactivate' : 'Activate'}
						</MenuItem>,
						<MenuItem
							key="delete"
							onClick={() => {
								removeCategory(row.original.id);
								closeMenu();
								table.resetRowSelection();
							}}
						>
							<ListItemIcon>
								<FuseSvgIcon>heroicons-outline:trash</FuseSvgIcon>
							</ListItemIcon>
							Delete
						</MenuItem>
					];
				}}
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

export default CategoriesTable;
