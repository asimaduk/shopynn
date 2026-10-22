import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { type AdminMerchantRow, type AgentType, useUpdateMerchantAdminMutation } from './MerchantApi';
import { userDisplayName } from './merchantFormatters';

type AgentTeamDialogProps = {
	agent: AdminMerchantRow | null;
	allAgents: AdminMerchantRow[];
	onClose: () => void;
};

/** Admin: switch an agent between field agent / agent manager and pick their manager. */
export default function AgentTeamDialog({ agent, allAgents, onClose }: AgentTeamDialogProps) {
	const [agentType, setAgentType] = useState<AgentType>('agent');
	const [managerId, setManagerId] = useState('');
	const [update, { isLoading }] = useUpdateMerchantAdminMutation();

	useEffect(() => {
		if (agent) {
			setAgentType(agent.agent_type === 'manager' ? 'manager' : 'agent');
			setManagerId(agent.manager_id ?? '');
		}
	}, [agent]);

	const managers = useMemo(
		() => allAgents.filter((m) => m.agent_type === 'manager' && m.status === 'active' && m.id !== agent?.id),
		[allAgents, agent?.id]
	);

	const handleSave = async () => {
		if (!agent) return;
		try {
			await update({
				merchantId: agent.id,
				agent_type: agentType,
				manager_id: agentType === 'manager' ? null : managerId || null
			}).unwrap();
			toast.success('Agent updated.');
			onClose();
		} catch (e: unknown) {
			const err = e as { data?: { message?: string }; error?: string };
			toast.error(err?.data?.message || err?.error || 'Update failed');
		}
	};

	return (
		<Dialog open={Boolean(agent)} onClose={isLoading ? undefined : onClose} maxWidth="xs" fullWidth>
			<DialogTitle>Role & team — {agent ? userDisplayName(agent) : ''}</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-2">
				<TextField
					select
					label="Role"
					size="small"
					value={agentType}
					onChange={(e) => setAgentType(e.target.value as AgentType)}
					fullWidth
					sx={{ mt: 1 }}
				>
					<MenuItem value="agent">Field agent</MenuItem>
					<MenuItem value="manager">Agent manager</MenuItem>
				</TextField>
				{agentType === 'agent' ? (
					<TextField
						select
						label="Manager"
						size="small"
						value={managerId}
						onChange={(e) => setManagerId(e.target.value)}
						fullWidth
						helperText={managers.length === 0 ? 'No active agent managers yet.' : undefined}
					>
						<MenuItem value="">No manager (reports to Shopynn)</MenuItem>
						{managers.map((m) => (
							<MenuItem key={m.id} value={m.id}>
								{userDisplayName(m)}
							</MenuItem>
						))}
					</TextField>
				) : (
					<Typography variant="body2" color="text.secondary">
						Agent managers can recruit field agents (you approve them), see their team&apos;s shops and
						earnings, and move shops between team members.
					</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleSave} variant="contained" disabled={isLoading}>
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
}
