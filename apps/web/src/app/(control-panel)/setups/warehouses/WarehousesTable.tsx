import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { ListItemIcon, MenuItem, Paper } from '@mui/material';
import { Warehouse } from './WarehouseApi';
import { WAREHOUSE_PRINTER_OPTIONS } from './models/WarehouseModel';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useNavigate from '@fuse/hooks/useNavigate';

type WarehousesTableProps = {
	data: Warehouse[];
	isLoading: boolean;
};

function WarehousesTable({ data: warehouses, isLoading }: WarehousesTableProps) {
	const navigate = useNavigate();

	const columns = useMemo<MRT_ColumnDef<Warehouse>[]>(
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
				accessorFn: (row) => row.name ?? '',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.name}</span>
					</div>
				)
			},
			{
				accessorKey: 'manager',
				header: 'Manager',
				accessorFn: (row) => row.manager ?? 'N/A',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.manager ?? 'N/A'}</span>
					</div>
				)
			},
			{
				accessorKey: 'phone',
				header: 'Phone',
				accessorFn: (row) => row.phone ?? 'N/A',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.phone ?? 'N/A'}</span>
					</div>
				)
			},
			{
				accessorKey: 'address',
				header: 'Address',
				accessorFn: (row) => row.address ?? 'N/A',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.address ?? 'N/A'}</span>
					</div>
				)
			},
			{
				accessorKey: 'location',
				header: 'Location/Town',
				accessorFn: (row) => row.location ?? 'N/A',
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.location ?? 'N/A'}</span>
					</div>
				)
			},
			{
				accessorKey: 'printer_type',
				header: 'Printer',
				accessorFn: (row) => {
					const v = row.printer_type;
					const label = WAREHOUSE_PRINTER_OPTIONS.find((o) => o.value === v)?.label;
					return label ?? 'Any / not specified';
				},
				Cell: ({ row }) => {
					const v = row.original.printer_type;
					const label = WAREHOUSE_PRINTER_OPTIONS.find((o) => o.value === v)?.label;
					return (
						<div className="flex flex-wrap space-x-0.5">
							<span>{label ?? 'Any / not specified'}</span>
						</div>
					);
				}
			},
			{
				accessorKey: 'created_at',
				header: 'Date Added',
				accessorFn: (row) => (row.created_at ? new Date(row.created_at).toDateString() : 'N/A'),
				Cell: ({ row }) => (
					<div className="flex flex-wrap space-x-0.5">
						<span>{row.original.created_at ? new Date(row.original.created_at).toDateString() : 'N/A'}</span>
					</div>
				)
			}
		],
		[]
	);

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			<DataTable
				data={warehouses}
				columns={columns}
				state={{ isLoading }}
				initialState={{ density: 'compact' }}
				enableRowSelection={false}
				globalFilterFn="contains"
				renderRowActionMenuItems={({ closeMenu, row, table }) => [
					<MenuItem
						key={0}
						onClick={() => {
							navigate(`/setups/warehouses/${row.original.id}`);
							closeMenu();
						}}
					>
						<ListItemIcon>
							<FuseSvgIcon>heroicons-outline:pencil</FuseSvgIcon>
						</ListItemIcon>
						Edit
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
				// 				removewarehouses(selectedRows.map((row) => row.original.id));
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

export default WarehousesTable;
