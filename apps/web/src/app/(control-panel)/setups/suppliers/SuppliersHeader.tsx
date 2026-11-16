import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';

export type SuppliersHeaderProps = {
	supplierCount: number;
	withPhoneCount: number;
	isLoading?: boolean;
};

/**
 * Suppliers list header (aligned with Categories / Expenses).
 */
function SuppliersHeader({ supplierCount, withPhoneCount, isLoading }: SuppliersHeaderProps) {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));

	return (
		<div className="flex grow-0 flex-1 w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Suppliers</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{supplierCount} {supplierCount === 1 ? 'supplier' : 'suppliers'}
								<span className="mx-2 opacity-50">·</span>
								{withPhoneCount} with phone
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex w-full sm:flex-1 flex-wrap items-center justify-start sm:justify-end gap-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						className=""
						variant="contained"
						color="secondary"
						component={NavLinkAdapter}
						to="/setups/suppliers/new"
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
						<span className="mx-1 sm:mx-2">Add</span>
					</Button>
				</motion.div>
			</div>
		</div>
	);
}

export default SuppliersHeader;
