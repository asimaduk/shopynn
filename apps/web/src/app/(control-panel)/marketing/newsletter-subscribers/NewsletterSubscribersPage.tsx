'use client';

import { useMemo, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import toast from 'react-hot-toast';
import { formatDateShort } from '../../merchants/merchantFormatters';
import {
	useGetNewsletterSubscribersQuery,
	useUpdateNewsletterSubscriberMutation,
	type NewsletterSubscriber
} from '../MarketingApi';

export default function NewsletterSubscribersPage() {
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('');

	const { data, isLoading, refetch } = useGetNewsletterSubscribersQuery({
		q: search.trim() || undefined,
		status: statusFilter || undefined
	});
	const [updateSubscriber] = useUpdateNewsletterSubscriberMutation();

	const subscribers = data?.subscribers ?? [];

	const columns = useMemo<MRT_ColumnDef<NewsletterSubscriber>[]>(
		() => [
			{ accessorKey: 'email', header: 'Email' },
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.status}
						color={row.original.status === 'active' ? 'success' : 'default'}
					/>
				)
			},
			{ accessorKey: 'source', header: 'Source' },
			{
				accessorKey: 'subscribed_at',
				header: 'Subscribed',
				Cell: ({ row }) => formatDateShort(row.original.subscribed_at)
			}
		],
		[]
	);

	const handleToggle = async (row: NewsletterSubscriber) => {
		const next = row.status === 'active' ? 'unsubscribed' : 'active';
		try {
			await updateSubscriber({ id: row.id, status: next }).unwrap();
			toast.success(next === 'active' ? 'Subscriber reactivated' : 'Subscriber unsubscribed');
			refetch();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string } };
			toast.error(err?.data?.message || 'Could not update subscriber');
		}
	};

	return (
		<>
			<GlobalStyles styles={{ '#root': { maxHeight: '100vh' } }} />
			<div className="w-full px-4 md:px-8">
				<PageBreadcrumb className="mb-4" />
				<Typography variant="h4" className="mb-1 font-semibold">
					Newsletter subscribers
				</Typography>
				<Typography color="text.secondary" className="mb-6">
					Emails collected from your public marketing site subscribe form.
				</Typography>

				<Paper className="mb-4 flex flex-wrap gap-3 p-4" elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
					<TextField
						size="small"
						label="Search email"
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
						<MenuItem value="active">Active</MenuItem>
						<MenuItem value="unsubscribed">Unsubscribed</MenuItem>
					</TextField>
					<Box className="flex items-center">
						<Typography variant="body2" color="text.secondary">
							{subscribers.length} subscriber{subscribers.length === 1 ? '' : 's'}
						</Typography>
					</Box>
				</Paper>

				<DataTable
					columns={columns}
					data={subscribers}
					state={{ isLoading }}
					enableRowActions
					renderRowActionMenuItems={({ row, closeMenu }) => [
						<MenuItem
							key="toggle"
							onClick={() => {
								closeMenu();
								handleToggle(row.original);
							}}
						>
							{row.original.status === 'active' ? 'Unsubscribe' : 'Reactivate'}
						</MenuItem>
					]}
				/>
			</div>
		</>
	);
}
