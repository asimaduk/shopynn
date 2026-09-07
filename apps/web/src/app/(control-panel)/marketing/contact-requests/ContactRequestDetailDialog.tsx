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
import type { ContactRequestReply } from '../MarketingApi';
import { useGetContactRequestQuery } from '../MarketingApi';

type Props = {
	open: boolean;
	requestId: string | null;
	canRespond: boolean;
	onClose: () => void;
	onReply: (message: string) => Promise<void>;
	onUpdateStatus: (status: string, adminNotes: string) => Promise<void>;
	replying?: boolean;
};

export default function ContactRequestDetailDialog({
	open,
	requestId,
	canRespond,
	onClose,
	onReply,
	onUpdateStatus,
	replying
}: Props) {
	const { data, isLoading, refetch } = useGetContactRequestQuery(requestId ?? '', { skip: !open || !requestId });
	const [replyText, setReplyText] = useState('');
	const [adminNotes, setAdminNotes] = useState('');
	const [status, setStatus] = useState('open');

	const request = data?.request;
	const replies = data?.replies ?? [];

	useEffect(() => {
		if (!request) return;
		setAdminNotes(request.admin_notes ?? '');
		setStatus(request.status ?? 'open');
	}, [request]);

	const handleReply = async () => {
		if (!replyText.trim()) return;
		await onReply(replyText.trim());
		setReplyText('');
		refetch();
	};

	const handleSaveMeta = async () => {
		await onUpdateStatus(status, adminNotes);
		refetch();
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>Contact request</DialogTitle>
			<DialogContent className="flex flex-col gap-4 pt-2">
				{isLoading ? (
					<FuseLoading />
				) : request ? (
					<>
						<Box className="flex flex-wrap items-center gap-2">
							<Typography variant="subtitle1" className="font-semibold">
								{request.name}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{request.email}
							</Typography>
							<Chip size="small" label={request.status} />
						</Box>
						<PaperMessage message={request.message} createdAt={request.created_at} />
						{replies.map((r) => (
							<ReplyBubble key={r.id} reply={r} />
						))}
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
								label="Reply by email"
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								fullWidth
								multiline
								minRows={4}
								placeholder="Your reply will be emailed to the visitor."
							/>
						) : null}
					</>
				) : (
					<Typography color="text.secondary">Request not found.</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
				{request ? (
					<>
						<Button variant="outlined" onClick={handleSaveMeta}>
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

function PaperMessage({ message, createdAt }: { message: string; createdAt: string }) {
	return (
		<Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
			<Typography variant="caption" color="text.secondary" className="block mb-1">
				{new Date(createdAt).toLocaleString()}
			</Typography>
			<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
				{message}
			</Typography>
		</Box>
	);
}

function ReplyBubble({ reply }: { reply: ContactRequestReply }) {
	const who = reply.is_staff
		? [reply.first_name, reply.last_name].filter(Boolean).join(' ') || 'Staff'
		: 'Visitor';
	return (
		<Box sx={{ p: 2, borderRadius: 2, bgcolor: reply.is_staff ? 'primary.light' : 'action.selected', opacity: 0.95 }}>
			<Typography variant="caption" color="text.secondary" className="block mb-1">
				{who} · {new Date(reply.created_at).toLocaleString()}
			</Typography>
			<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
				{reply.message}
			</Typography>
		</Box>
	);
}
