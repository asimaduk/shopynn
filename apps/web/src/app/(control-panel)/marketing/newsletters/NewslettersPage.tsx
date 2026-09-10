'use client';

import { useMemo, useState } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { type MRT_ColumnDef } from 'material-react-table';
import DataTable from 'src/components/data-table/DataTable';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import toast from 'react-hot-toast';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';
import { formatDateShort } from '../../merchants/merchantFormatters';
import {
	useCreateNewsletterCampaignMutation,
	useGetNewsletterCampaignsQuery,
	useSendNewsletterCampaignMutation,
	useUpdateNewsletterCampaignMutation,
	type NewsletterCampaign
} from '../MarketingApi';
import NewsletterCampaignDialog from './NewsletterCampaignDialog';

export default function NewslettersPage() {
	const { data: user } = useUser();
	const canSend = hasPermissionCodes(user, 'newsletter.campaigns.send');

	const { data, isLoading, refetch } = useGetNewsletterCampaignsQuery();
	const [createCampaign, { isLoading: creating }] = useCreateNewsletterCampaignMutation();
	const [updateCampaign, { isLoading: updating }] = useUpdateNewsletterCampaignMutation();
	const [sendCampaign, { isLoading: sending }] = useSendNewsletterCampaignMutation();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [selected, setSelected] = useState<NewsletterCampaign | null>(null);

	const campaigns = data?.campaigns ?? [];

	const columns = useMemo<MRT_ColumnDef<NewsletterCampaign>[]>(
		() => [
			{ accessorKey: 'subject', header: 'Subject' },
			{
				accessorKey: 'status',
				header: 'Status',
				Cell: ({ row }) => (
					<Chip
						size="small"
						label={row.original.status}
						color={row.original.status === 'sent' ? 'success' : 'default'}
					/>
				)
			},
			{ accessorKey: 'recipient_count', header: 'Recipients' },
			{
				accessorKey: 'sent_at',
				header: 'Sent',
				Cell: ({ row }) => (row.original.sent_at ? formatDateShort(row.original.sent_at) : '—')
			},
			{
				accessorKey: 'created_at',
				header: 'Created',
				Cell: ({ row }) => formatDateShort(row.original.created_at)
			}
		],
		[]
	);

	const openNew = () => {
		setSelected(null);
		setDialogOpen(true);
	};

	const openCampaign = (row: NewsletterCampaign) => {
		setSelected(row);
		setDialogOpen(true);
	};

	const handleSave = async (payload: { subject: string; body_html: string; body_text: string }) => {
		try {
			if (selected) {
				const res = await updateCampaign({ id: selected.id, ...payload }).unwrap();
				setSelected(res.campaign);
				toast.success('Draft saved');
			} else {
				const res = await createCampaign(payload).unwrap();
				setSelected(res.campaign);
				toast.success('Draft created');
			}
			refetch();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string } };
			toast.error(err?.data?.message || 'Could not save newsletter');
			throw e;
		}
	};

	const handleSend = async () => {
		if (!selected) return;
		if (!window.confirm('Send this newsletter to all active subscribers? This cannot be undone.')) return;
		try {
			const res = await sendCampaign(selected.id).unwrap();
			setSelected(res.campaign);
			toast.success(`Sent to ${res.sentCount} of ${res.totalSubscribers} subscribers`);
			refetch();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string } };
			toast.error(err?.data?.message || 'Could not send newsletter');
		}
	};

	return (
		<>
			<GlobalStyles styles={{ '#root': { maxHeight: '100vh' } }} />
			<div className="w-full px-4 pt-6 md:px-8 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<Typography variant="h4" className="font-semibold">
							Newsletters
						</Typography>
						<Typography color="text.secondary">
							Compose and send marketing emails to subscribers.
						</Typography>
					</div>
					{canSend ? (
						<Button variant="contained" color="primary" startIcon={<FuseSvgIcon>heroicons-outline:plus</FuseSvgIcon>} onClick={openNew}>
							New newsletter
						</Button>
					) : null}
				</div>

				<Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
					<DataTable
						columns={columns}
						data={campaigns}
						state={{ isLoading }}
						enableRowSelection={false}
						initialState={{ density: 'compact' }}
						muiTableBodyRowProps={({ row }) => ({
							onClick: () => openCampaign(row.original),
							sx: { cursor: 'pointer' }
						})}
					/>
				</Paper>

				<NewsletterCampaignDialog
					open={dialogOpen}
					campaign={selected}
					canSend={canSend}
					onClose={() => setDialogOpen(false)}
					onSave={handleSave}
					onSend={handleSend}
					saving={creating || updating}
					sending={sending}
				/>
			</div>
		</>
	);
}
