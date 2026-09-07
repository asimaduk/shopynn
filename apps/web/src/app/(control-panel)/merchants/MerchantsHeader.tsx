import type { ReactNode } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';

export type MerchantsHeaderProps = {
	merchantUserCount: number;
	onboardedBusinessTotal: number;
	isLoading?: boolean;
	showOnboardBusiness?: boolean;
	showAddMerchant?: boolean;
	onAddMerchant?: () => void;
	title?: string;
	subtitle?: ReactNode;
};

function MerchantsHeader({
	merchantUserCount,
	onboardedBusinessTotal,
	isLoading,
	showOnboardBusiness,
	showAddMerchant,
	onAddMerchant,
	title = 'Merchants',
	subtitle
}: MerchantsHeaderProps) {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));

	const defaultSubtitle =
		merchantUserCount === 1 ? 'merchant' : 'merchants';

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">{title}</Typography>
					<Typography
						component="div"
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{subtitle ??
							(isLoading ? (
								'…'
							) : (
								<>
									{merchantUserCount} {defaultSubtitle}
									<span className="mx-2 opacity-50">·</span>
									{onboardedBusinessTotal} onboarded{' '}
									{onboardedBusinessTotal === 1 ? 'business' : 'businesses'}
								</>
							))}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 flex-wrap items-center justify-end gap-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					{showOnboardBusiness ? (
						<Button
							variant="contained"
							color="secondary"
							component={NavLinkAdapter}
							to="/merchants/onboard"
							size={isMobile ? 'small' : 'medium'}
							startIcon={<FuseSvgIcon size={20}>heroicons-outline:plus-circle</FuseSvgIcon>}
							className="me-1"
						>
							Onboard business
						</Button>
					) : null}
					{showAddMerchant ? (
						<Button
							variant="contained"
							color="secondary"
							size={isMobile ? 'small' : 'medium'}
							startIcon={<FuseSvgIcon size={20}>heroicons-outline:user-plus</FuseSvgIcon>}
							onClick={onAddMerchant}
						>
							Add merchant
						</Button>
					) : null}
				</motion.div>
			</div>
		</div>
	);
}

export default MerchantsHeader;
