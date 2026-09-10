'use client';

import { useMemo, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import toast from 'react-hot-toast';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import { formatDateShort } from '../../merchants/merchantFormatters';
import {
	useGetSiteChatsQuery,
	useReplyToSiteChatMutation,
	useUpdateSiteChatMutation,
	type SiteChatSessionRow
} from '../MarketingApi';
import SiteChatDetailDialog from './SiteChatDetailDialog';

export default function SiteChatsPage() {
	const { data: user } = useUser();
	const canRespond = hasFeatureAndPermission(user, 'site_chat.sessions.respond', undefined, 'site_chat.sessions.respond');

	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	const { data, isLoading, refetch } = useGetSiteChatsQuery({
		q: search.trim() || undefined,
		status: statusFilter || undefined
	});
	const [replyToChat, { isLoading: replying }] = useReplyToSiteChatMutation();
	const [updateChat] = useUpdateSiteChatMutation();

	const sessions = data?.sessions ?? [];

	const columns = useMemo<MRT_ColumnDef<SiteChatSessionRow>[]>(
		() => [
			{ accessorKey: 'name', header: 'Name' },
			{ accessorKey: 'email', header: 'Email' },
			{
				accessorKey: 'last_message_preview',
				header: 'Last message',
				Cell: ({ row }) => (
					<Typography variant="body2" className="line-clamp-2 max-w-md">
						{row.original.last_message_preview ?? '—'}
					</Typography>
				)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => {
					const s = row.original.status;
					const color = s === 'open' ? 'warning' : s === 'replied' ? 'success' : 'default';
					return <Chip size="small" label={s} color={color} />;
				}
			},
			{
				accessorKey: 'last_message_at',
				header: 'Last activity',
				Cell: ({ row }) => formatDateShort(row.original.last_message_at ?? row.original.created_at)
			}
		],
		[]
	);

	return (
		<>
			<GlobalStyles styles={{ '#root': { maxHeight: '100vh' } }} />
			<div className="w-full px-4 pt-6 md:px-8 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<Typography variant="h4" className="mb-1 font-semibold">
					Live chat
				</Typography>
				<Typography color="text.secondary" className="mb-6">
					Conversations from the Shopynn marketing site chat widget.
				</Typography>

				<Paper className="mb-4 flex flex-wrap gap-3 p-4" elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
					<TextField
						size="small"
						label="Search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						sx={{ minWidth: 220 }}
					/>
					<TextField
						select
						size="small"
						label="Status"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						sx={{ minWidth: 160 }}
					>
						<MenuItem value="">All</MenuItem>
						<MenuItem value="open">Open</MenuItem>
						<MenuItem value="replied">Replied</MenuItem>
						<MenuItem value="closed">Closed</MenuItem>
					</TextField>
				</Paper>

				<DataTable
					columns={columns}
					data={sessions}
					state={{ isLoading }}
					enableRowSelection={false}
					initialState={{ density: 'compact' }}
					muiTableBodyRowProps={({ row }) => ({
						onClick: () => {
							setSelectedId(row.original.id);
							setDialogOpen(true);
						},
						sx: { cursor: 'pointer' }
					})}
				/>

				<SiteChatDetailDialog
					open={dialogOpen}
					sessionId={selectedId}
					canRespond={canRespond}
					onClose={() => setDialogOpen(false)}
					replying={replying}
					onReply={async (message) => {
						if (!selectedId) return;
						try {
							await replyToChat({ id: selectedId, message }).unwrap();
							toast.success('Reply sent');
							refetch();
						} catch (e: unknown) {
							const err = e as { data?: { message?: string } };
							toast.error(err?.data?.message || 'Could not send reply');
							throw e;
						}
					}}
					onUpdateStatus={async (status, admin_notes) => {
						if (!selectedId) return;
						try {
							await updateChat({ id: selectedId, status, admin_notes }).unwrap();
							toast.success('Saved');
							refetch();
						} catch (e: unknown) {
							const err = e as { data?: { message?: string } };
							toast.error(err?.data?.message || 'Could not update');
							throw e;
						}
					}}
				/>
			</div>
		</>
	);
}
