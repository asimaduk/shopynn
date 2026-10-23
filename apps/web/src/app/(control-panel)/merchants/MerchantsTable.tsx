import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import { Chip, Paper, MenuItem, ListItemIcon } from '@mui/material';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import type { AdminMerchantRow } from './MerchantApi';
import {
	AGENT_STATUS_COLOR,
	AGENT_STATUS_LABEL,
	agentTypeLabel,
	formatDateShort,
	managerDisplayName,
	userDisplayName
} from './merchantFormatters';
import { formatPhone } from '@/utils/formatContact';

export type MerchantRowAction = 'view' | 'approve' | 'reject' | 'team' | 'deactivate' | 'reactivate';

type MerchantsTableProps = {
	data: AdminMerchantRow[];
	isLoading: boolean;
	onAction: (action: MerchantRowAction, row: AdminMerchantRow) => void;
	busy: boolean;
	/** When true, omit outer Paper (use inside another container). */
	embedded?: boolean;
};

function MerchantsTable({ data, isLoading, onAction, busy, embedded }: MerchantsTableProps) {
	const columns = useMemo<MRT_ColumnDef<AdminMerchantRow>[]>(
		() => [
			{
				accessorKey: 'user',
				header: 'Agent',
				enableColumnFilter: false,
				muiTableHeadCellProps: { sx: { pl: 3 } },
				muiTableBodyCellProps: { sx: { pl: 3 } },
				accessorFn: (row) => userDisplayName(row),
				Cell: ({ row }) => (
					<div>
						<div className="font-medium">{userDisplayName(row.original)}</div>
						<div className="text-sm opacity-60">{row.original.email || formatPhone(row.original.phone)}</div>
					</div>
				)
			},
			{
				accessorKey: 'agent_type',
				header: 'Role',
				size: 130,
				accessorFn: (row) => agentTypeLabel(row.agent_type)
			},
			{
				accessorKey: 'manager',
				header: 'Manager / team',
				accessorFn: (row) =>
					row.agent_type === 'manager' ? `${row.team_size ?? 0} active agents` : managerDisplayName(row)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				size: 140,
				accessorFn: (row) => (row.status ? AGENT_STATUS_LABEL[row.status] : '—'),
				Cell: ({ row }) =>
					row.original.status ? (
						<Chip
							size="small"
							label={AGENT_STATUS_LABEL[row.original.status]}
							color={AGENT_STATUS_COLOR[row.original.status]}
							variant="outlined"
						/>
					) : (
						'—'
					)
			},
			{
				accessorKey: 'serving_count',
				header: 'Shops',
				size: 90,
				accessorFn: (row) => row.serving_count ?? 0
			},
			{
				accessorKey: 'awaiting_payment_count',
				header: 'Unpaid',
				size: 90,
				accessorFn: (row) => row.awaiting_payment_count ?? 0
			},
			{
				accessorKey: 'created_at',
				header: 'Added',
				size: 120,
				accessorFn: (row) => (row.created_at ? formatDateShort(row.created_at) : '—')
			}
		],
		[]
	);

	const menuItem = (key: MerchantRowAction, label: string, icon: string, row: AdminMerchantRow, closeMenu: () => void) => (
		<MenuItem
			key={key}
			disabled={busy && key !== 'view'}
			onClick={() => {
				closeMenu();
				onAction(key, row);
			}}
		>
			<ListItemIcon>
				<FuseSvgIcon size={20}>{icon}</FuseSvgIcon>
			</ListItemIcon>
			{label}
		</MenuItem>
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
			renderRowActionMenuItems={({ row, closeMenu }) => {
				const r = row.original;
				const items = [menuItem('view', 'View details', 'heroicons-outline:eye', r, closeMenu)];
				if (r.status === 'pending_approval') {
					items.push(menuItem('approve', 'Approve & send login', 'heroicons-outline:check-circle', r, closeMenu));
					items.push(menuItem('reject', 'Reject', 'heroicons-outline:x-circle', r, closeMenu));
				}
				if (r.status === 'active') {
					items.push(menuItem('team', 'Role & team', 'heroicons-outline:user-group', r, closeMenu));
					items.push(menuItem('deactivate', 'Deactivate', 'heroicons-outline:no-symbol', r, closeMenu));
				}
				if (r.status === 'deactivated') {
					items.push(menuItem('reactivate', 'Reactivate', 'heroicons-outline:arrow-path', r, closeMenu));
				}
				return items;
			}}
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
