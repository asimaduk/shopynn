import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Paper, MenuItem, ListItemIcon } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import type { AdminMerchantRow } from './MerchantApi';
import { formatDateShort, formatMoney, userDisplayName } from './merchantFormatters';

type MerchantsTableProps = {
	data: AdminMerchantRow[];
	isLoading: boolean;
	onViewDetails: (row: AdminMerchantRow) => void;
	onRevoke: (row: AdminMerchantRow) => void;
	revoking: boolean;
	/** When true, omit outer Paper (use inside another container). */
	embedded?: boolean;
};

function MerchantsTable({
	data,
	isLoading,
	onViewDetails,
	onRevoke,
	revoking,
	embedded
}: MerchantsTableProps) {
	const columns = useMemo<MRT_ColumnDef<AdminMerchantRow>[]>(
		() => [
			{
				accessorKey: 'user',
				header: 'Merchant',
				enableColumnFilter: false,
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				accessorFn: (row) => userDisplayName(row),
				Cell: ({ row }) => (
					<span className="font-medium">{userDisplayName(row.original)}</span>
				)
			},
			{
				accessorKey: 'email',
				header: 'Email',
				accessorFn: (row) => row.email ?? '—'
			},
			{
				accessorKey: 'phone',
				header: 'Phone',
				accessorFn: (row) => row.phone ?? '—'
			},
			{
				accessorKey: 'default_commission_percent',
				header: 'Default %',
				size: 100,
				accessorFn: (row) =>
					row.default_commission_percent != null && row.default_commission_percent !== ''
						? formatMoney(row.default_commission_percent)
						: '—'
			},
			{
				accessorKey: 'onboarded_count',
				header: 'Businesses',
				size: 110,
				accessorFn: (row) => row.onboarded_count ?? 0
			},
			{
				accessorKey: 'created_at',
				header: 'Date added',
				accessorFn: (row) => (row.created_at ? formatDateShort(row.created_at) : '—')
			}
		],
		[]
	);

	const table = (
		<DataTable
			data={data}
			columns={columns}
			initialState={{
				density: 'compact',
				showColumnFilters: false,
				showGlobalFilter: true
			}}
			state={{ isLoading }}
			enableRowSelection={false}
			enableRowActions
			renderRowActionMenuItems={({ row, closeMenu }) => [
				<MenuItem
					key="view"
					onClick={() => {
						closeMenu();
						onViewDetails(row.original);
					}}
				>
					<ListItemIcon>
						<FuseSvgIcon size={20}>heroicons-outline:eye</FuseSvgIcon>
					</ListItemIcon>
					View details
				</MenuItem>,
				<MenuItem
					key="revoke"
					disabled={revoking}
					onClick={() => {
						closeMenu();
						onRevoke(row.original);
					}}
				>
					<ListItemIcon>
						<FuseSvgIcon size={20}>heroicons-outline:no-symbol</FuseSvgIcon>
					</ListItemIcon>
					Revoke merchant
				</MenuItem>
			]}
		/>
	);

	if (embedded) {
		return <div className="flex flex-col flex-auto min-h-0 w-full">{table}</div>;
	}

	return (
		<Paper
			className="flex flex-col flex-auto shadow-1 rounded-t-lg overflow-hidden rounded-b-none w-full h-full"
			elevation={0}
		>
			{table}
		</Paper>
	);
}

export default MerchantsTable;
