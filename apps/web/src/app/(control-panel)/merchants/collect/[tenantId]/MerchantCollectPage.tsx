'use client';

import { useState } from 'react';
import Link from '@fuse/core/Link';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import toast from 'react-hot-toast';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import {
	useGetTenantQuoteQuery,
	useInitiateTenantPaymentMutation,
	useSubmitTenantPaymentOtpMutation
} from '../../MerchantApi';
import { MOMO_NETWORK_OPTIONS } from '@/utils/momoNetworks';

export default function MerchantCollectPage() {
	const { tenantId } = useParams<{ tenantId: string }>();
	const router = useRouter();
	const { data: quoteData, refetch } = useGetTenantQuoteQuery(tenantId, { skip: !tenantId });
	const [initiate, { isLoading: initiating }] = useInitiateTenantPaymentMutation();
	const [submitOtp, { isLoading: submittingOtp }] = useSubmitTenantPaymentOtpMutation();

	const quote = quoteData?.quote;
	const [method, setMethod] = useState<'mobile_money' | 'card'>('mobile_money');
	const [phone, setPhone] = useState('');
	const [network, setNetwork] = useState('mtn');
	const [cardUrl, setCardUrl] = useState<string | null>(null);
	const [ownerEmail, setOwnerEmail] = useState('');
	const [transactionRef, setTransactionRef] = useState<string | null>(null);
	const [otp, setOtp] = useState('');
	const [otpStep, setOtpStep] = useState(false);

	const copyText = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copied`);
		} catch {
			toast.error('Copy failed');
		}
	};

	const handleInitiate = async () => {
		if (!tenantId) return;
		try {
			const res = await initiate({
				tenantId,
				payment_method: method,
				phone: method === 'mobile_money' ? phone : undefined,
				provider: method === 'mobile_money' ? network : undefined
			}).unwrap();
			setOwnerEmail(res.owner_email || quote?.owner_email || '');
			setTransactionRef(res.transaction_ref || null);
			if (method === 'card' && res.redirect_url) {
				setCardUrl(res.redirect_url);
				setOtpStep(false);
			} else {
				setOtpStep(true);
				toast.success('MoMo charge sent — ask the owner to approve, then enter OTP if required.');
			}
			refetch();
		} catch (err: any) {
			toast.error(err?.data?.message || 'Could not start payment');
		}
	};

	const handleOtp = async () => {
		if (!tenantId || !transactionRef) return;
		try {
			await submitOtp({ tenantId, reference: transactionRef, otp }).unwrap();
			toast.success('Payment submitted.');
			router.push('/merchants');
		} catch (err: any) {
			toast.error(err?.data?.message || 'OTP failed');
		}
	};

	if (!quote) {
		return (
			<Box className="mx-auto max-w-lg p-6">
				<Alert severity="info">No pending payment for this business.</Alert>
				<Button component={Link} to="/merchants" className="mt-4">
					Back
				</Button>
			</Box>
		);
	}

	return (
		<Box className="mx-auto max-w-xl p-6">
			<PageBreadcrumb className="mb-4" />
			<Typography variant="h4" fontWeight={700} className="mb-4">
				Collect payment
			</Typography>

			<Paper variant="outlined" className="mb-4 p-4">
				<Typography variant="subtitle2" color="text.secondary">
					Quote total
				</Typography>
				<Typography variant="h5" fontWeight={800}>
					GHS {Number(quote.total_ghs).toFixed(2)}
				</Typography>
				<Box className="mt-2 flex flex-wrap gap-1">
					{(quote.lines || []).map((l) => (
						<Chip key={l.code} size="small" label={`${l.label}: ${l.amount_ghs}`} />
					))}
				</Box>
			</Paper>

			<Paper variant="outlined" className="p-4">
				<TextField
					select
					fullWidth
					label="Payment method"
					value={method}
					onChange={(e) => setMethod(e.target.value as 'card' | 'mobile_money')}
					className="mb-3"
				>
					<MenuItem value="mobile_money">Mobile money</MenuItem>
					<MenuItem value="card">Card (share link)</MenuItem>
				</TextField>

				{method === 'mobile_money' ? (
					<>
						<TextField
							fullWidth
							label="Owner phone (10 digits)"
							value={phone}
							onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
							className="mb-2"
						/>
						<TextField
							select
							fullWidth
							label="Network"
							value={network}
							onChange={(e) => setNetwork(e.target.value)}
							className="mb-3"
						>
							{MOMO_NETWORK_OPTIONS.map((n) => (
								<MenuItem key={n.provider} value={n.provider}>
									<Box className="flex items-center gap-2">
										<Box
											component="img"
											src={n.iconSrc}
											alt=""
											sx={{ width: 22, height: 22, objectFit: 'contain' }}
										/>
										{n.label}
									</Box>
								</MenuItem>
							))}
						</TextField>
					</>
				) : null}

				<Button fullWidth variant="contained" disabled={initiating} onClick={handleInitiate}>
					{initiating ? 'Starting…' : 'Start payment'}
				</Button>

				{(ownerEmail || quote.owner_email) && (
					<Box className="mt-4">
						<Divider className="mb-2" />
						<Typography variant="body2" color="text.secondary">
							Checkout email (share with owner for card)
						</Typography>
						<Box className="flex items-center gap-2">
							<Typography fontWeight={600}>{ownerEmail || quote.owner_email}</Typography>
							<Button
								size="small"
								onClick={() => copyText(String(ownerEmail || quote.owner_email), 'Email')}
							>
								Copy
							</Button>
						</Box>
					</Box>
				)}

				{cardUrl && (
					<Box className="mt-3">
						<Button fullWidth variant="outlined" href={cardUrl} target="_blank" rel="noopener">
							Open checkout
						</Button>
						<Button fullWidth className="mt-1" onClick={() => copyText(cardUrl, 'Payment link')}>
							Copy payment link
						</Button>
					</Box>
				)}

				{otpStep && (
					<Box className="mt-4">
						<TextField
							fullWidth
							label="OTP (if required)"
							value={otp}
							onChange={(e) => setOtp(e.target.value)}
							className="mb-2"
						/>
						<Button fullWidth variant="contained" disabled={submittingOtp} onClick={handleOtp}>
							Submit OTP
						</Button>
						<Typography variant="caption" color="text.secondary" className="mt-2 block">
							Failed? Start payment again — a new reference will be created for the same quote.
						</Typography>
					</Box>
				)}
			</Paper>

			<Button
				component={Link}
				to="/merchants"
				startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
				className="mt-4"
			>
				Back to merchants
			</Button>
		</Box>
	);
}
