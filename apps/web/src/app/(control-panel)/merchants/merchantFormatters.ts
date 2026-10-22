import type { AdminMerchantRow, AgentStatus } from './MerchantApi';

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
	pending_approval: 'Awaiting approval',
	active: 'Active',
	rejected: 'Rejected',
	deactivated: 'Deactivated'
};

export const AGENT_STATUS_COLOR: Record<AgentStatus, 'warning' | 'success' | 'default' | 'error'> = {
	pending_approval: 'warning',
	active: 'success',
	rejected: 'error',
	deactivated: 'default'
};

export function agentTypeLabel(type: string | null | undefined) {
	return type === 'manager' ? 'Agent manager' : 'Field agent';
}

export function managerDisplayName(m: Pick<AdminMerchantRow, 'manager_first_name' | 'manager_last_name'>) {
	return [m.manager_first_name, m.manager_last_name].filter(Boolean).join(' ').trim() || '—';
}

export function formatMoney(v: string | number | null | undefined) {
	const n = Number(v);
	if (!Number.isFinite(n)) return '—';
	return n.toFixed(2);
}

export function formatDate(iso: string | null | undefined) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function formatDateShort(iso: string | null | undefined) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	} catch {
		return iso;
	}
}

export function userDisplayName(m: Pick<AdminMerchantRow, 'first_name' | 'last_name' | 'email' | 'phone' | 'user_id'>) {
	const n = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
	return n || m.email || m.phone || m.user_id;
}
