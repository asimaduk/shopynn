import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import FuseLoading from '@fuse/core/FuseLoading';
import {  Paper } from '@mui/material';
import _ from 'lodash';
// import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import Typography from '@mui/material/Typography';
// import Button from '@mui/material/Button';
import { Stock, useDeleteInventoryMutation, useGetInventoriesQuery } from '../ECommerceApi';

function TransfersTable() {
	const { data: inventories, isLoading } = useGetInventoriesQuery();
	// const [removeInventory] = useDeleteInventoryMutation();

	const columns = useMemo<MRT_ColumnDef<Stock>[]>(
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
				Cell: ({ row }) => (
					<Typography
						component={Link}
						to={`/inventory/stocks/${row.original.id}/${createSlug(row.original.name)}`}
						role="button"
					>
						<u>{row.original.name}</u>
					</Typography>
				)
			},
			{
				accessorKey: 'quantity',
				header: 'Quantity',
				accessorFn: (row) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.quantity}</span>
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
			// {
			// 	accessorKey: 'priceTaxIncl',
			// 	header: 'Price',
			// 	accessorFn: (row) => `$${row.priceTaxIncl}`
			// },
			// {
			// 	accessorKey: 'quantity',
			// 	header: 'Quantity',
			// 	accessorFn: (row) => (
			// 		<div className="flex items-center space-x-2">
			// 			<span>{row.quantity}</span>
			// 			<i
			// 				className={clsx(
			// 					'inline-block w-2 h-2 rounded-sm',
			// 					row.quantity <= 5 && 'bg-red',
			// 					row.quantity > 5 && row.quantity <= 25 && 'bg-orange',
			// 					row.quantity > 25 && 'bg-green'
			// 				)}
			// 			/>
			// 		</div>
			// 	)
			// },
			// {
			// 	accessorKey: 'active',
			// 	header: 'Active',
			// 	accessorFn: (row) => (
			// 		<div className="flex items-center">
			// 			{row.active ? (
			// 				<FuseSvgIcon
			// 					className="text-green-500"
			// 					size={20}
			// 				>
			// 					heroicons-outline:check-circle
			// 				</FuseSvgIcon>
			// 			) : (
			// 				<FuseSvgIcon
			// 					className="text-red-500"
			// 					size={20}
			// 				>
			// 					heroicons-outline:minus-circle
			// 				</FuseSvgIcon>
			// 			)}
			// 		</div>
			// 	)
			// }
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

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={[]}
				columns={columns}
				// renderRowActionMenuItems={({ closeMenu, row, table }) => [
				// 	<MenuItem
				// 		key={0}
				// 		onClick={() => {
				// 			removeInventory(row.original.id);
				// 			closeMenu();
				// 			table.resetRowSelection();
				// 		}}
				// 	>
				// 		<ListItemIcon>
				// 			<FuseSvgIcon>heroicons-outline:trash</FuseSvgIcon>
				// 		</ListItemIcon>
				// 		Delete
				// 	</MenuItem>
				// ]}
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

export default TransfersTable;
