'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import FuseLoading from '@fuse/core/FuseLoading';
import type { SiteChatMessage } from '../MarketingApi';
import { useGetSiteChatQuery } from '../MarketingApi';

type Props = {
	open: boolean;
	sessionId: string | null;
	canRespond: boolean;
	onClose: () => void;
	onReply: (message: string) => Promise<void>;
	onUpdateStatus: (status: string, adminNotes: string) => Promise<void>;
	replying?: boolean;
};

function MessageBubble({ msg }: { msg: SiteChatMessage }) {
	const isStaff = msg.is_staff;
	return (
		<Box
			sx={{
				alignSelf: isStaff ? 'flex-start' : 'flex-end',
				maxWidth: '85%',
				px: 1.5,
				py: 1,
				borderRadius: 2,
				bgcolor: isStaff ? 'action.hover' : 'primary.main',
				color: isStaff ? 'text.primary' : 'primary.contrastText'
			}}
		>
			<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
				{msg.body}
			</Typography>
			<Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
				{isStaff ? msg.staff_name || 'Support' : 'Visitor'} · {new Date(msg.created_at).toLocaleString()}
			</Typography>
		</Box>
	);
}

export default function SiteChatDetailDialog({
	open,
	sessionId,
	canRespond,
	onClose,
	onReply,
	onUpdateStatus,
	replying
}: Props) {
	const { data, isLoading, refetch } = useGetSiteChatQuery(sessionId ?? '', { skip: !open || !sessionId });
	const [replyText, setReplyText] = useState('');
	const [adminNotes, setAdminNotes] = useState('');
	const [status, setStatus] = useState('open');

	const session = data?.session;
	const messages = data?.messages ?? [];

	useEffect(() => {
		if (!session) return;
		setAdminNotes(session.admin_notes ?? '');
		setStatus(session.status ?? 'open');
	}, [session]);

	const handleReply = async () => {
		if (!replyText.trim()) return;
		await onReply(replyText.trim());
		setReplyText('');
		refetch();
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>Live chat</DialogTitle>
			<DialogContent className="flex flex-col gap-4 pt-2">
				{isLoading ? (
					<FuseLoading />
				) : session ? (
					<>
						<Box className="flex flex-wrap items-center gap-2">
							<Typography variant="subtitle1" className="font-semibold">
								{session.name}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{session.email}
							</Typography>
							<Chip size="small" label={session.status} />
						</Box>

						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								gap: 1.5,
								maxHeight: 320,
								overflowY: 'auto',
								p: 1.5,
								borderRadius: 1,
								border: 1,
								borderColor: 'divider'
							}}
						>
							{messages.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									No messages.
								</Typography>
							) : (
								messages.map((m) => <MessageBubble key={m.id} msg={m} />)
							)}
						</Box>

						<TextField
							select
							size="small"
							label="Status"
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							fullWidth
						>
							<MenuItem value="open">Open</MenuItem>
							<MenuItem value="replied">Replied</MenuItem>
							<MenuItem value="closed">Closed</MenuItem>
						</TextField>
						<TextField
							label="Internal notes"
							value={adminNotes}
							onChange={(e) => setAdminNotes(e.target.value)}
							fullWidth
							multiline
							minRows={2}
						/>
						{canRespond ? (
							<TextField
								label="Reply (emailed to visitor and shown in widget)"
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								fullWidth
								multiline
								minRows={3}
							/>
						) : null}
					</>
				) : (
					<Typography color="text.secondary">Session not found.</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
				{session ? (
					<>
						<Button variant="outlined" onClick={() => onUpdateStatus(status, adminNotes)}>
							Save notes
						</Button>
						{canRespond ? (
							<Button variant="contained" disabled={replying || !replyText.trim()} onClick={handleReply}>
								Send reply
							</Button>
						) : null}
					</>
				) : null}
			</DialogActions>
		</Dialog>
	);
}
