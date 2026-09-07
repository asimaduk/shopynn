'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';

export default function ProfileCardPaymentPage() {
	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="flex min-h-screen w-full flex-col items-center justify-center px-4">
				<Paper className="w-full max-w-md rounded-xl p-8 text-center shadow-sm">
					<Box className="mb-6">
						<FuseSvgIcon size={64} className="mb-4 text-primary">
							heroicons-outline:credit-card
						</FuseSvgIcon>
						<Typography variant="h6" className="font-semibold">
							Complete your card payment
						</Typography>
						<Typography variant="body2" color="text.secondary" className="mt-2">
							This page simulates the redirect to the payment provider. In production, you would enter card
							details on the secure payment gateway.
						</Typography>
					</Box>
					<Button component={Link} to="/apps/profile" variant="contained" color="primary" fullWidth>
						Return to profile
					</Button>
				</Paper>
			</div>
		</>
	);
}
