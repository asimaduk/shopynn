import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';

export type WarehousesHeaderProps = {
	warehouseCount: number;
	withPhoneCount: number;
	isLoading?: boolean;
	/** When true, Add is disabled (e.g. subscription branch limit). */
	addBlocked?: boolean;
	addBlockedReason?: string;
};

/**
 * Warehouses list header (aligned with Suppliers / Expenses).
 */
function WarehousesHeader({
	warehouseCount,
	withPhoneCount,
	isLoading,
	addBlocked = false,
	addBlockedReason
}: WarehousesHeaderProps) {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const blockReason =
		addBlockedReason ||
		`Your plan allows a limited number of branches (warehouses). Remove one or upgrade to add another.`;

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Warehouses</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{warehouseCount} {warehouseCount === 1 ? 'warehouse' : 'warehouses'}
								<span className="mx-2 opacity-50">·</span>
								{withPhoneCount} with phone
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					{addBlocked ? (
						<Tooltip title={blockReason}>
							<span>
								<Button
									className=""
									variant="contained"
									color="secondary"
									disabled
									size={isMobile ? 'small' : 'medium'}
								>
									<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
									<span className="mx-1 sm:mx-2">Add</span>
								</Button>
							</span>
						</Tooltip>
					) : (
						<Button
							className=""
							variant="contained"
							color="secondary"
							component={NavLinkAdapter}
							to="/setups/warehouses/new"
							size={isMobile ? 'small' : 'medium'}
						>
							<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
							<span className="mx-1 sm:mx-2">Add</span>
						</Button>
					)}
				</motion.div>
			</div>
		</div>
	);
}

export default WarehousesHeader;
