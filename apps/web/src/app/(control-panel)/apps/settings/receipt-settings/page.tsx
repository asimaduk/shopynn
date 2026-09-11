'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import { useGetReceiptSettingsQuery, useUpdateReceiptSettingsMutation } from '../../../parity/ParityApi';
import {
	getPrintAgentHealthUrl,
	getPrintAgentPrintUrl,
	loadPrintAgentConfig,
	normalizePrintAgentHost,
	normalizePrintAgentPort,
	savePrintAgentConfig
} from '@/utils/printAgent';

type SectionCardProps = {
	title: string;
	subtitle?: string;
	icon: string;
	children: ReactNode;
	action?: ReactNode;
};

function SectionCard({ title, subtitle, icon, children, action }: SectionCardProps) {
	return (
		<Paper
			elevation={0}
			variant="outlined"
			sx={{
				borderRadius: 3,
				overflow: 'hidden',
				borderColor: 'divider'
			}}
		>
			<Box
				className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
				sx={{
					borderBottom: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) =>
						alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.85)
				}}
			>
				<Box className="flex min-w-0 items-start gap-2.5">
					<Box
						className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
						sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }}
					>
						<FuseSvgIcon size={20} color="primary">
							{icon}
						</FuseSvgIcon>
					</Box>
					<Box className="min-w-0">
						<Typography variant="subtitle1" fontWeight={700}>
							{title}
						</Typography>
						{subtitle ? (
							<Typography variant="body2" color="text.secondary" className="mt-0.5">
								{subtitle}
							</Typography>
						) : null}
					</Box>
				</Box>
				{action}
			</Box>
			<Box className="p-4 sm:p-5">{children}</Box>
		</Paper>
	);
}

type AgentStatus = 'idle' | 'testing' | 'ok' | 'ok-no-printer' | 'error';

export default function ReceiptSettingsPage() {
	const { data, isLoading: loadingSettings } = useGetReceiptSettingsQuery();
	const [updateReceiptSettings, { isLoading: saving }] = useUpdateReceiptSettingsMutation();
	const initialCompany = useMemo(() => data?.receiptCompanyName || '', [data]);

	const [companyName, setCompanyName] = useState(initialCompany);
	const [printHost, setPrintHost] = useState('127.0.0.1');
	const [printPort, setPrintPort] = useState('3001');
	const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
	const [statusMessage, setStatusMessage] = useState('');
	const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		setCompanyName(initialCompany);
	}, [initialCompany]);

	useEffect(() => {
		const cfg = loadPrintAgentConfig();
		setPrintHost(cfg.host);
		setPrintPort(String(cfg.port));
	}, []);

	const markDirty = () => {
		setDirty(true);
		setSaveMessage(null);
	};

	const onSave = async (e: React.FormEvent) => {
		e.preventDefault();
		const host = normalizePrintAgentHost(printHost);
		if (!host) {
			setSaveMessage({ type: 'error', text: 'Enter the LAN IP of the computer running Shopynn Print.' });
			return;
		}

		try {
			await updateReceiptSettings({ receiptCompanyName: companyName.trim() }).unwrap();
			const saved = savePrintAgentConfig({ host, port: printPort });
			setPrintHost(saved.host);
			setPrintPort(String(saved.port));
			setDirty(false);
			setSaveMessage({ type: 'success', text: 'Invoice & receipt settings saved.' });
		} catch (err) {
			setSaveMessage({
				type: 'error',
				text: err instanceof Error ? err.message : 'Could not save settings.'
			});
		}
	};

	const onTestPrintAgent = async () => {
		const host = normalizePrintAgentHost(printHost);
		if (!host) {
			setAgentStatus('error');
			setStatusMessage('Enter a host / IP before testing.');
			return;
		}

		const cfg = savePrintAgentConfig({ host, port: printPort });
		setPrintHost(cfg.host);
		setPrintPort(String(cfg.port));
		setAgentStatus('testing');
		setStatusMessage('');

		try {
			const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
			const timer = window.setTimeout(() => controller?.abort(), 5000);
			const res = await fetch(getPrintAgentHealthUrl(cfg), {
				method: 'GET',
				signal: controller?.signal
			});
			window.clearTimeout(timer);
			const body = (await res.json().catch(() => ({}))) as {
				message?: string;
				printer_connected?: boolean;
			};

			if (!res.ok) {
				setAgentStatus('error');
				setStatusMessage(body.message || `Agent returned HTTP ${res.status}.`);
				return;
			}

			if (body.printer_connected) {
				setAgentStatus('ok');
				setStatusMessage('Connected — USB printer detected.');
			} else {
				setAgentStatus('ok-no-printer');
				setStatusMessage('Connected — agent is reachable, but no USB printer was detected yet.');
			}
		} catch (err) {
			const aborted = err instanceof DOMException && err.name === 'AbortError';
			setAgentStatus('error');
			setStatusMessage(
				aborted
					? 'Timed out. Check Wi‑Fi, firewall, and that Shopynn Print is running on this host.'
					: err instanceof Error
						? err.message
						: 'Could not reach the print agent.'
			);
		}
	};

	const statusChip =
		agentStatus === 'ok' ? (
			<Chip size="small" color="success" label="Printer ready" />
		) : agentStatus === 'ok-no-printer' ? (
			<Chip size="small" color="warning" label="Agent OK" />
		) : agentStatus === 'error' ? (
			<Chip size="small" color="error" label="Not reachable" />
		) : agentStatus === 'testing' ? (
			<Chip size="small" label="Testing…" />
		) : (
			<Chip size="small" variant="outlined" label="Not tested" />
		);

	const endpointPreview = getPrintAgentPrintUrl({
		host: normalizePrintAgentHost(printHost) || '127.0.0.1',
		port: normalizePrintAgentPort(printPort)
	});

	return (
		<PermissionGate
			requiredPermissions={['receipt_settings.view', 'settings.view']}
			fallback={
				<FeatureUnavailable
					title="Invoice & Receipt"
					message="You do not have access to receipt settings."
				/>
			}
		>
			<Box
				component="form"
				onSubmit={onSave}
				className="flex w-full max-w-3xl flex-col gap-6"
			>
				<Box>
					<Typography className="text-xl font-semibold">Invoice & Receipt</Typography>
					<Typography color="text.secondary" className="mt-1">
						Configure how invoices and thermal receipts appear, and connect the on‑prem print agent.
					</Typography>
				</Box>

				{saveMessage ? (
					<Alert
						severity={saveMessage.type}
						onClose={() => setSaveMessage(null)}
						sx={{ borderRadius: 2 }}
					>
						{saveMessage.text}
					</Alert>
				) : null}

				<SectionCard
					title="Receipt branding"
					subtitle="Shown on printed invoices and thermal receipts."
					icon="heroicons-outline:document-text"
				>
					<TextField
						fullWidth
						label="Company name on receipt"
						placeholder="e.g. Shopynn Test Store"
						value={companyName}
						disabled={loadingSettings || saving}
						onChange={(e) => {
							setCompanyName(e.target.value);
							markDirty();
						}}
						helperText="Leave blank to use your store name from account settings."
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<FuseSvgIcon size={20}>heroicons-outline:building-storefront</FuseSvgIcon>
								</InputAdornment>
							)
						}}
					/>
				</SectionCard>

				<SectionCard
					title="Thermal print agent"
					subtitle="Shopynn Print runs on the checkout PC with the USB printer."
					icon="heroicons-outline:printer"
					action={statusChip}
				>
					<Box
						className="mb-5 rounded-xl p-4"
						sx={{
							bgcolor: (theme) => alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
							border: '1px solid',
							borderColor: (theme) => alpha(theme.palette.info.main, 0.2)
						}}
					>
						<Typography variant="subtitle2" fontWeight={700} className="mb-2">
							Quick setup
						</Typography>
						<Box component="ol" className="m-0 list-decimal space-y-1.5 pl-4 text-sm" sx={{ color: 'text.secondary' }}>
							<li>Install and start Shopynn Print on the PC with the USB thermal printer.</li>
							<li>Enter that PC’s LAN IP below (same Wi‑Fi/LAN as this browser).</li>
							<li>Test connection, then save. Use 127.0.0.1 only when browsing on that same PC.</li>
						</Box>
					</Box>

					<Box className="grid gap-4 sm:grid-cols-[1fr_140px]">
						<TextField
							fullWidth
							label="Host / IP"
							placeholder="192.168.1.50"
							value={printHost}
							disabled={saving || agentStatus === 'testing'}
							onChange={(e) => {
								setPrintHost(e.target.value);
								setAgentStatus('idle');
								setStatusMessage('');
								markDirty();
							}}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<FuseSvgIcon size={20}>heroicons-outline:computer-desktop</FuseSvgIcon>
									</InputAdornment>
								)
							}}
						/>
						<TextField
							fullWidth
							label="Port"
							value={printPort}
							disabled={saving || agentStatus === 'testing'}
							onChange={(e) => {
								setPrintPort(e.target.value.replace(/[^0-9]/g, ''));
								setAgentStatus('idle');
								setStatusMessage('');
								markDirty();
							}}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<FuseSvgIcon size={18}>heroicons-outline:hashtag</FuseSvgIcon>
									</InputAdornment>
								)
							}}
						/>
					</Box>

					<Typography variant="caption" color="text.secondary" className="mt-3 block font-mono">
						Endpoint: {endpointPreview}
					</Typography>

					{statusMessage ? (
						<Alert
							severity={
								agentStatus === 'ok'
									? 'success'
									: agentStatus === 'ok-no-printer'
										? 'warning'
										: agentStatus === 'error'
											? 'error'
											: 'info'
							}
							className="mt-4"
							sx={{ borderRadius: 2 }}
						>
							{statusMessage}
						</Alert>
					) : null}

					<Box className="mt-4 flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outlined"
							onClick={onTestPrintAgent}
							disabled={agentStatus === 'testing' || saving}
							startIcon={
								<FuseSvgIcon size={18}>
									{agentStatus === 'testing'
										? 'heroicons-outline:arrow-path'
										: 'heroicons-outline:signal'}
								</FuseSvgIcon>
							}
						>
							{agentStatus === 'testing' ? 'Testing…' : 'Test connection'}
						</Button>
					</Box>
				</SectionCard>

				<Divider />

				<Box className="flex flex-wrap items-center justify-between gap-3">
					<Typography variant="body2" color="text.secondary">
						{dirty ? 'You have unsaved changes.' : 'All changes are saved.'}
					</Typography>
					<Button
						type="submit"
						variant="contained"
						color="secondary"
						disabled={saving || !dirty}
						startIcon={
							<FuseSvgIcon size={18}>
								{saving ? 'heroicons-outline:arrow-path' : 'heroicons-outline:check'}
							</FuseSvgIcon>
						}
					>
						{saving ? 'Saving…' : 'Save settings'}
					</Button>
				</Box>
			</Box>
		</PermissionGate>
	);
}
