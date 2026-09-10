'use client';

import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import toast from 'react-hot-toast';
import {
	useGetBroadcastAudienceQuery,
	useSendBroadcastMutation,
	type BroadcastSendResult
} from '../MarketingApi';

export default function BroadcastPage() {
	const [audience, setAudience] = useState<'myself' | 'all'>('myself');
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [channels, setChannels] = useState({ push: true, email: false, sms: false });
	const [createInApp, setCreateInApp] = useState(true);
	const [reviewOpen, setReviewOpen] = useState(false);
	const [lastResult, setLastResult] = useState<BroadcastSendResult | null>(null);

	const { data: counts, isFetching: loadingCounts } = useGetBroadcastAudienceQuery({ audience });
	const [sendBroadcast, { isLoading: sending }] = useSendBroadcastMutation();

	const canSend = useMemo(() => {
		const hasChannel = channels.push || channels.email || channels.sms;
		return hasChannel && title.trim().length > 0 && body.trim().length > 0;
	}, [channels, title, body]);

	const channelLabels = useMemo(() => {
		const list: string[] = [];
		if (channels.push) list.push('Push');
		if (channels.email) list.push('Email');
		if (channels.sms) list.push('SMS');
		return list;
	}, [channels]);

	const openReview = () => {
		if (!canSend || sending) return;
		setReviewOpen(true);
	};

	const closeReview = () => {
		if (sending) return;
		setReviewOpen(false);
	};

	const confirmSend = async () => {
		if (!canSend || sending) return;
		try {
			const result = await sendBroadcast({
				title: title.trim(),
				body: body.trim(),
				channels,
				audience,
				confirm_all: audience === 'all',
				create_in_app: createInApp
			}).unwrap();
			setLastResult(result);
			setReviewOpen(false);
			toast.success(
				audience === 'myself'
					? 'Sent to your account'
					: `Broadcast finished (${result.recipients} recipients)`
			);
		} catch (e: unknown) {
			const err = e as { data?: { message?: string } };
			toast.error(err?.data?.message || 'Broadcast failed');
		}
	};

	return (
		<div className="w-full px-4 pb-10 pt-6 md:px-8 sm:pt-8">
			<PageBreadcrumb className="mb-4" />
			<div className="mb-6">
				<Typography variant="h4" className="font-semibold">
					Broadcast
				</Typography>
				<Typography variant="body2" color="text.secondary" className="mt-1 max-w-2xl">
					Send a message to yourself or all active staff via push, email, and/or SMS.
				</Typography>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<Paper className="rounded-xl p-5 flex flex-col gap-4 shadow-sm">
					<div>
						<Typography variant="subtitle2" className="mb-2">
							Audience
						</Typography>
						<RadioGroup
							row
							value={audience}
							onChange={(e) => setAudience(e.target.value as 'myself' | 'all')}
						>
							<FormControlLabel value="myself" control={<Radio />} label="Myself only" />
							<FormControlLabel value="all" control={<Radio />} label="All active staff users" />
						</RadioGroup>
					</div>

					<div>
						<Typography variant="subtitle2" className="mb-2">
							Channels
						</Typography>
						<FormGroup row>
							<FormControlLabel
								control={
									<Checkbox
										checked={channels.push}
										onChange={(e) => setChannels((c) => ({ ...c, push: e.target.checked }))}
									/>
								}
								label="Push"
							/>
							<FormControlLabel
								control={
									<Checkbox
										checked={channels.email}
										onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))}
									/>
								}
								label="Email"
							/>
							<FormControlLabel
								control={
									<Checkbox
										checked={channels.sms}
										onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))}
									/>
								}
								label="SMS"
							/>
						</FormGroup>
						{channels.sms && counts && !counts.sms_configured ? (
							<Alert severity="warning" className="mt-2">
								SMS is not configured. Messages on this channel will be skipped.
							</Alert>
						) : null}
					</div>

					<TextField
						label="Title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						fullWidth
						required
						placeholder="Notification title"
					/>
					<TextField
						label="Message"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						fullWidth
						required
						multiline
						minRows={5}
						placeholder="Write your message"
					/>

					<FormControlLabel
						control={
							<Checkbox checked={createInApp} onChange={(e) => setCreateInApp(e.target.checked)} />
						}
						label="Also create in-app notification"
					/>

					<div className="flex justify-end">
						<Button
							variant="contained"
							color={audience === 'all' ? 'warning' : 'primary'}
							disabled={!canSend || sending}
							onClick={openReview}
						>
							{audience === 'myself' ? 'Review & send to me' : 'Review & broadcast'}
						</Button>
					</div>

					{lastResult ? (
						<Alert severity="success">
							Sent · {lastResult.recipients} recipient{lastResult.recipients === 1 ? '' : 's'}
							{channels.push
								? ` · push ${lastResult.push.success}/${lastResult.push.attempted}`
								: ''}
							{channels.email
								? ` · email ${lastResult.email.success}/${lastResult.email.attempted}`
								: ''}
							{channels.sms
								? ` · sms ${lastResult.sms.success}/${lastResult.sms.attempted}${
										lastResult.sms.skipped_unconfigured
											? ` (${lastResult.sms.skipped_unconfigured} skipped)`
											: ''
									}`
								: ''}
							{createInApp ? ` · in-app ${lastResult.in_app.created}` : ''}
						</Alert>
					) : null}
				</Paper>

				<Paper className="rounded-xl p-5 h-fit shadow-sm">
					<Typography variant="subtitle1" className="font-semibold mb-3">
						Audience reach
					</Typography>
					{loadingCounts && !counts ? (
						<Typography variant="body2" color="text.secondary">
							Loading…
						</Typography>
					) : (
						<ul className="m-0 list-none p-0 flex flex-col gap-2">
							<li className="flex justify-between gap-3">
								<span>Users</span>
								<strong>{counts?.recipients ?? 0}</strong>
							</li>
							<li className="flex justify-between gap-3">
								<span>Push tokens</span>
								<strong>{counts?.push ?? 0}</strong>
							</li>
							<li className="flex justify-between gap-3">
								<span>Emails</span>
								<strong>{counts?.email ?? 0}</strong>
							</li>
							<li className="flex justify-between gap-3">
								<span>Phones</span>
								<strong>{counts?.sms ?? 0}</strong>
							</li>
						</ul>
					)}
				</Paper>
			</div>

			<Dialog open={reviewOpen} onClose={closeReview} maxWidth="sm" fullWidth>
				<DialogTitle>Review broadcast</DialogTitle>
				<DialogContent className="flex flex-col gap-4 pt-2">
					{audience === 'all' ? (
						<Alert severity="warning">
							This will send to all active staff users ({counts?.recipients ?? 0} people · push{' '}
							{counts?.push ?? 0} · email {counts?.email ?? 0} · SMS {counts?.sms ?? 0}).
						</Alert>
					) : (
						<Alert severity="info">This will send only to your account.</Alert>
					)}

					<div>
						<Typography variant="caption" color="text.secondary">
							Channels
						</Typography>
						<Typography variant="body2">
							{channelLabels.join(', ') || 'None'}
							{createInApp ? ' · In-app notification' : ''}
						</Typography>
					</div>

					<Divider />

					<div>
						<Typography variant="caption" color="text.secondary">
							Title
						</Typography>
						<Typography variant="subtitle1" className="font-semibold whitespace-pre-wrap break-words">
							{title.trim()}
						</Typography>
					</div>

					<div>
						<Typography variant="caption" color="text.secondary">
							Message
						</Typography>
						<Typography variant="body1" className="whitespace-pre-wrap break-words mt-1">
							{body.trim()}
						</Typography>
					</div>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeReview} disabled={sending}>
						Edit
					</Button>
					<Button
						variant="contained"
						color={audience === 'all' ? 'warning' : 'primary'}
						onClick={confirmSend}
						disabled={sending}
					>
						{sending ? 'Sending…' : audience === 'myself' ? 'Confirm & send' : 'Confirm & broadcast'}
					</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}
