'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import apiFetch from '@/utils/apiFetch';
import { StepUpRequest, subscribeStepUp } from '@/utils/stepUp';

async function postStepUp(path: string, body: Record<string, unknown>) {
	const session = await getSession();
	const res = await apiFetch(`/api/users/me/step-up/${path}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${session?.accessToken}` },
		body: JSON.stringify(body)
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json?.message || 'Something went wrong. Try again.');
	return json?.data || {};
}

/** Code prompt shown before withdrawals and payout changes. */
export default function StepUpHost() {
	const [request, setRequest] = useState<StepUpRequest | null>(null);
	const [destination, setDestination] = useState('');
	const [code, setCode] = useState('');
	const [sending, setSending] = useState(false);
	const [verifying, setVerifying] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => subscribeStepUp(setRequest), []);

	const sendCode = useCallback(async () => {
		setSending(true);
		setError('');
		try {
			const data = await postStepUp('send-otp', {});
			setDestination(String(data.destination || ''));
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSending(false);
		}
	}, []);

	useEffect(() => {
		if (!request) return;
		setCode('');
		setDestination('');
		setError('');
		void sendCode();
	}, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	const confirm = async () => {
		if (!request || !/^\d{6}$/.test(code) || verifying) return;
		setVerifying(true);
		setError('');
		try {
			const data = await postStepUp('verify', { otp: code });
			request.finish(data);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setVerifying(false);
		}
	};

	return (
		<Dialog
			open={Boolean(request)}
			onClose={() => request?.finish(null)}
			maxWidth="xs"
			fullWidth
		>
			<DialogTitle>Confirm it&apos;s you</DialogTitle>
			<DialogContent>
				<Typography
					variant="body2"
					color="text.secondary"
				>
					{destination ? `We sent a 6-digit code to ${destination}.` : 'Sending a 6-digit code…'} Enter it to
					continue with this payout action.
				</Typography>
				<TextField
					autoFocus
					fullWidth
					value={code}
					onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
					onKeyDown={(e) => {
						if (e.key === 'Enter') void confirm();
					}}
					placeholder="000000"
					error={Boolean(error)}
					helperText={error || ' '}
					slotProps={{
						htmlInput: {
							inputMode: 'numeric',
							autoComplete: 'one-time-code',
							maxLength: 6,
							style: { textAlign: 'center', fontSize: 24, letterSpacing: 8 }
						}
					}}
					className="mt-4"
				/>
				<Button
					size="small"
					disabled={sending}
					onClick={() => void sendCode()}
				>
					{sending ? <CircularProgress size={16} /> : 'Send a new code'}
				</Button>
			</DialogContent>
			<DialogActions className="px-6 pb-4">
				<Button
					onClick={() => request?.finish(null)}
					className="rounded-full"
				>
					Cancel
				</Button>
				<Button
					variant="contained"
					className="rounded-full"
					disabled={code.length !== 6 || verifying}
					onClick={() => void confirm()}
				>
					{verifying ? <CircularProgress size={18} /> : 'Confirm'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
