'use client';

import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import Link from '@fuse/core/Link';

export default function PaymentHeader() {
	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between py-6 sm:py-8">
			<motion.span initial={{ x: -20 }} animate={{ x: 0, transition: { delay: 0.2 } }}>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">
						Make payment
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mt-1">
						Pay with card or mobile money
					</Typography>
				</div>
			</motion.span>
			<Button
				component={Link}
				to="/apps/profile"
				variant="outlined"
				color="primary"
				startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
			>
				Back to profile
			</Button>
		</div>
	);
}
