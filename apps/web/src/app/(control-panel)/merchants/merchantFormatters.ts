import type {
	AdminMerchantRow,
	AgentStatus,
	CommissionLifecycle,
	MerchantCommissionRow,
	PayoutStatus
} from './MerchantApi';

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

export const COMMISSION_LIFECYCLE_LABEL: Record<CommissionLifecycle, string> = {
	held: 'On hold',
	payable: 'Payable',
	in_payout: 'In payout',
	paid: 'Paid',
	cancelled: 'Cancelled'
};

export const COMMISSION_LIFECYCLE_COLOR: Record<CommissionLifecycle, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
	held: 'default',
	payable: 'info',
	in_payout: 'warning',
	paid: 'success',
	cancelled: 'error'
};

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
	pending_approval: 'Awaiting approval',
	processing: 'Processing',
	paid: 'Paid',
	failed: 'Failed',
	rejected: 'Rejected'
};

export const PAYOUT_STATUS_COLOR: Record<PayoutStatus, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
	pending_approval: 'warning',
	processing: 'info',
	paid: 'success',
	failed: 'error',
	rejected: 'default'
};

export const MOMO_NETWORK_LABEL: Record<string, string> = {
	mtn: 'MTN',
	vodafone: 'Telecel',
	airteltigo: 'AirtelTigo'
};

export function commissionKindLabel(c: Pick<MerchantCommissionRow, 'commission_kind' | 'source_agent_first_name' | 'source_agent_last_name'>) {
	if (c.commission_kind === 'override') {
		const who = [c.source_agent_first_name, c.source_agent_last_name].filter(Boolean).join(' ');
		return who ? `Team override · ${who}` : 'Team override';
	}
	return c.commission_kind === 'residual' ? 'Renewal' : 'Onboarding';
}

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
