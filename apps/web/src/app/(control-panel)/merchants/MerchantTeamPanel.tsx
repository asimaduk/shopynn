'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import toast from 'react-hot-toast';
import {
	type MerchantRecord,
	type OnboardedTenantRow,
	type TeamMemberRow,
	useDeactivateTeamAgentMutation,
	useGetMyTeamQuery,
	useGetMyTeamTenantsQuery,
	useReassignTeamTenantMutation
} from './MerchantApi';
import DeactivateAgentDialog from './DeactivateAgentDialog';
import RecruitAgentDialog from './RecruitAgentDialog';
import { AGENT_STATUS_COLOR, AGENT_STATUS_LABEL, formatDate, formatMoney, userDisplayName } from './merchantFormatters';

type MerchantTeamPanelProps = {
	manager: MerchantRecord;
	managerName: string;
	view: 'members' | 'shops';
};

function errorMessage(e: unknown, fallback: string) {
	const err = e as { data?: { message?: string }; error?: string };
	return err?.data?.message || err?.error || fallback;
}

/** Agent manager: their team members and the shops the team looks after. */
export default function MerchantTeamPanel({ manager, managerName, view }: MerchantTeamPanelProps) {
	const { data: teamData, isLoading: loadingTeam } = useGetMyTeamQuery(undefined, { refetchOnMountOrArgChange: true });
	const { data: shopsData, isLoading: loadingShops } = useGetMyTeamTenantsQuery(undefined, {
		refetchOnMountOrArgChange: true
	});
	const members = teamData?.members ?? [];
	const shops = shopsData?.tenants ?? [];

	const [recruitOpen, setRecruitOpen] = useState(false);
	const [deactivateTarget, setDeactivateTarget] = useState<TeamMemberRow | null>(null);
	const [reassignShop, setReassignShop] = useState<OnboardedTenantRow | null>(null);
	const [reassignTo, setReassignTo] = useState('');

	const [deactivate, { isLoading: deactivating }] = useDeactivateTeamAgentMutation();
	const [reassign, { isLoading: reassigning }] = useReassignTeamTenantMutation();

	const assignable = useMemo(
		() => [
			{ id: manager.id, label: `${managerName} (you)` },
			...members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, label: userDisplayName(m) }))
		],
		[manager.id, managerName, members]
	);

	const handleDeactivate = async (reason: string) => {
		if (!deactivateTarget) return;
		try {
			const res = await deactivate({ merchantId: deactivateTarget.id, reason }).unwrap();
			toast.success(`Agent deactivated. ${res.shops_moved} shop(s) moved to you.`);
			setDeactivateTarget(null);
		} catch (e) {
			toast.error(errorMessage(e, 'Could not deactivate agent'));
		}
	};

	const handleReassign = async () => {
		if (!reassignShop || !reassignTo) return;
		try {
			await reassign({ tenantId: reassignShop.id, merchant_id: reassignTo }).unwrap();
			toast.success('Shop reassigned.');
			setReassignShop(null);
		} catch (e) {
			toast.error(errorMessage(e, 'Could not reassign shop'));
		}
	};

	if ((view === 'members' && loadingTeam) || (view === 'shops' && (loadingShops || loadingTeam))) {
		return (
			<Box className="flex min-h-[200px] items-center justify-center p-8">
				<FuseLoading />
			</Box>
		);
	}

	return (
		<>
			{view === 'members' ? (
				<>
					<Box className="flex items-center justify-between px-4 py-3">
						<Typography color="text.secondary" variant="body2">
							New recruits need Shopynn approval before they can sign in.
						</Typography>
						<Button
							variant="contained"
							color="secondary"
							size="small"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:user-plus</FuseSvgIcon>}
							onClick={() => setRecruitOpen(true)}
						>
							Recruit agent
						</Button>
					</Box>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Agent</TableCell>
								<TableCell>Phone</TableCell>
								<TableCell>Status</TableCell>
								<TableCell align="right">Shops</TableCell>
								<TableCell align="right">Awaiting payment</TableCell>
								<TableCell align="right">Pending</TableCell>
								<TableCell align="right">Paid</TableCell>
								<TableCell align="right">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{members.map((m) => (
								<TableRow key={m.id} hover>
									<TableCell>
										<div className="font-medium">{userDisplayName(m)}</div>
										<Typography variant="caption" color="text.secondary">
											{m.email ?? ''}
										</Typography>
									</TableCell>
									<TableCell>{m.phone ?? '—'}</TableCell>
									<TableCell>
										<Chip
											size="small"
											label={m.status ? AGENT_STATUS_LABEL[m.status] : '—'}
											color={m.status ? AGENT_STATUS_COLOR[m.status] : 'default'}
											variant="outlined"
										/>
									</TableCell>
									<TableCell align="right">{m.serving_count ?? 0}</TableCell>
									<TableCell align="right">{m.awaiting_payment_count ?? 0}</TableCell>
									<TableCell align="right">GHS {formatMoney(m.pending_commission_ghs)}</TableCell>
									<TableCell align="right">GHS {formatMoney(m.paid_commission_ghs)}</TableCell>
									<TableCell align="right">
										{m.status === 'active' ? (
											<Button size="small" color="warning" onClick={() => setDeactivateTarget(m)}>
												Deactivate
											</Button>
										) : (
											'—'
										)}
									</TableCell>
								</TableRow>
							))}
							{members.length === 0 && (
								<TableRow>
									<TableCell colSpan={8}>
										<Typography color="text.secondary">
											No agents on your team yet. Recruit your first agent to get started.
										</Typography>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</>
			) : (
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Business</TableCell>
							<TableCell>Phone</TableCell>
							<TableCell>Agent</TableCell>
							<TableCell>Subscription</TableCell>
							<TableCell>Created</TableCell>
							<TableCell align="right">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{shops.map((t) => (
							<TableRow key={t.id} hover>
								<TableCell>
									<div className="font-medium">{t.name ?? '—'}</div>
									{t.awaiting_first_payment ? (
										<Chip size="small" label="Awaiting first payment" color="warning" variant="outlined" />
									) : null}
								</TableCell>
								<TableCell>{t.phone ?? '—'}</TableCell>
								<TableCell>
									{t.agent_merchant_id === manager.id
										? 'You'
										: [t.agent_first_name, t.agent_last_name].filter(Boolean).join(' ') || '—'}
								</TableCell>
								<TableCell>{t.subscription_name ?? '—'}</TableCell>
								<TableCell>{formatDate(t.created_at)}</TableCell>
								<TableCell align="right">
									<Button
										size="small"
										variant="outlined"
										onClick={() => {
											setReassignShop(t);
											setReassignTo(t.agent_merchant_id ?? '');
										}}
									>
										Reassign
									</Button>
								</TableCell>
							</TableRow>
						))}
						{shops.length === 0 && (
							<TableRow>
								<TableCell colSpan={6}>
									<Typography color="text.secondary">Your team has no shops yet.</Typography>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			)}

			<RecruitAgentDialog open={recruitOpen} onClose={() => setRecruitOpen(false)} />

			<DeactivateAgentDialog
				open={deactivateTarget != null}
				agentLabel={deactivateTarget ? userDisplayName(deactivateTarget) : ''}
				handOverTo={`${managerName} (you)`}
				loading={deactivating}
				onClose={() => setDeactivateTarget(null)}
				onConfirm={handleDeactivate}
			/>

			<Dialog open={reassignShop != null} onClose={reassigning ? undefined : () => setReassignShop(null)} maxWidth="xs" fullWidth>
				<DialogTitle>Reassign {reassignShop?.name ?? 'shop'}</DialogTitle>
				<DialogContent className="flex flex-col gap-2 pt-2">
					<Typography variant="body2" color="text.secondary">
						{reassignShop?.awaiting_first_payment
							? 'This shop has not paid yet. Whoever you choose is credited when it pays.'
							: 'Future renewal commission for this shop goes to the agent you choose.'}
					</Typography>
					<TextField
						select
						label="Agent"
						size="small"
						value={reassignTo}
						onChange={(e) => setReassignTo(e.target.value)}
						fullWidth
						sx={{ mt: 1 }}
					>
						{assignable.map((a) => (
							<MenuItem key={a.id} value={a.id}>
								{a.label}
							</MenuItem>
						))}
					</TextField>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setReassignShop(null)} disabled={reassigning}>
						Cancel
					</Button>
					<Button
						onClick={handleReassign}
						variant="contained"
						disabled={reassigning || !reassignTo || reassignTo === reassignShop?.agent_merchant_id}
					>
						Reassign
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
