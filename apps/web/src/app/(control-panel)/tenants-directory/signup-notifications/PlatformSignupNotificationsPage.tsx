'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import PlanFeatureGate from '@auth/PlanFeatureGate';
import {
	useGetSignupNotificationEmailsQuery,
	useUpdateSignupNotificationEmailsMutation
} from '../../billing/SubscriptionApi';
import toast from 'react-hot-toast';

function PlatformSignupNotificationsPageContent() {
	const { data, isLoading, refetch } = useGetSignupNotificationEmailsQuery();
	const [update, { isLoading: saving }] = useUpdateSignupNotificationEmailsMutation();
	const [emailsInput, setEmailsInput] = useState('');

	useEffect(() => {
		if (!data) return;
		setEmailsInput(Array.isArray(data.emails) ? data.emails.join(', ') : '');
	}, [data]);

	const handleSave = async () => {
		try {
			await update({ emails: emailsInput }).unwrap();
			toast.success('Signup notification emails saved');
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Could not save');
		}
	};

	return (
		<>
			<Box className="flex h-full w-full flex-auto flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
				<PageBreadcrumb className="mb-4" />
				<Typography component="h1" className="text-3xl font-extrabold tracking-tight">
					Signup notifications
				</Typography>
				<Typography variant="body2" color="text.secondary" className="mb-4 mt-1 max-w-2xl">
					Email these addresses whenever a new shop is created (self-serve or agent onboard). Leave empty to
					turn notifications off. Super admin only.
				</Typography>

				{isLoading ? (
					<FuseLoading />
				) : (
					<Paper variant="outlined" className="max-w-xl p-4">
						<TextField
							fullWidth
							multiline
							minRows={3}
							label="Recipient emails"
							value={emailsInput}
							onChange={(e) => setEmailsInput(e.target.value)}
							placeholder="ops@example.com, you@example.com"
							helperText="Comma-separated. Invalid addresses are dropped on save."
						/>
						<Alert severity="info" className="mt-3">
							Each new shop triggers one email with shop name, owner contact, plan, and signup source.
						</Alert>
						<Button className="mt-4" variant="contained" disabled={saving} onClick={handleSave}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</Paper>
				)}
			</Box>
		</>
	);
}

export default function PlatformSignupNotificationsPage() {
	return (
		<PlanFeatureGate requiredFeatures={['tenants.directory.view']} requiredPermissions={['tenants.directory.view']}>
			<PlatformSignupNotificationsPageContent />
		</PlanFeatureGate>
	);
}
