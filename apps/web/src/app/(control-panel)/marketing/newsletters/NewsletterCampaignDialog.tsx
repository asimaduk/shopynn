'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { NewsletterCampaign } from '../MarketingApi';

type Props = {
	open: boolean;
	campaign: NewsletterCampaign | null;
	canSend: boolean;
	onClose: () => void;
	onSave: (payload: { subject: string; body_html: string; body_text: string }) => Promise<void>;
	onSend: () => Promise<void>;
	saving?: boolean;
	sending?: boolean;
};

export default function NewsletterCampaignDialog({
	open,
	campaign,
	canSend,
	onClose,
	onSave,
	onSend,
	saving,
	sending
}: Props) {
	const [subject, setSubject] = useState('');
	const [bodyText, setBodyText] = useState('');
	const isSent = campaign?.status === 'sent';

	useEffect(() => {
		if (!open) return;
		setSubject(campaign?.subject ?? '');
		setBodyText(campaign?.body_text ?? campaign?.body_html?.replace(/<[^>]+>/g, '') ?? '');
	}, [open, campaign]);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>{campaign ? (isSent ? 'Newsletter details' : 'Edit newsletter') : 'New newsletter'}</DialogTitle>
			<DialogContent className="flex flex-col gap-4 pt-2">
				<TextField
					label="Subject"
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
					fullWidth
					disabled={isSent}
					required
				/>
				<TextField
					label="Body"
					value={bodyText}
					onChange={(e) => setBodyText(e.target.value)}
					fullWidth
					multiline
					minRows={8}
					disabled={isSent}
					placeholder="Write your newsletter content. Line breaks are preserved in the email."
				/>
				{isSent && campaign ? (
					<Typography variant="body2" color="text.secondary">
						Sent to {campaign.recipient_count} subscriber{campaign.recipient_count === 1 ? '' : 's'} on{' '}
						{campaign.sent_at ? new Date(campaign.sent_at).toLocaleString() : '—'}
					</Typography>
				) : null}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
				{!isSent ? (
					<>
						<Button
							variant="outlined"
							disabled={saving || !subject.trim()}
							onClick={() =>
								onSave({
									subject: subject.trim(),
									body_text: bodyText,
									body_html: `<div style="font-family:sans-serif;line-height:1.6">${bodyText.replace(/\n/g, '<br/>')}</div>`
								})
							}
						>
							Save draft
						</Button>
						{canSend && campaign ? (
							<Button
								variant="contained"
								color="primary"
								disabled={sending || !subject.trim()}
								onClick={onSend}
							>
								Send to all active subscribers
							</Button>
						) : null}
					</>
				) : null}
			</DialogActions>
		</Dialog>
	);
}
