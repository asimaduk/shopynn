import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { darken } from '@mui/material/styles';
import Link from 'next/link';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

/**
 * Inventory Dashboard Header
 */
function AnalyticsDashboardAppHeader() {
	const { data: user, isGuest } = useUser();
	const canCreateSale = hasFeatureAndPermission(user, 'sales.create', undefined, 'sales.create');
	const canCreatePurchase = hasFeatureAndPermission(user, 'purchases.create', undefined, 'purchases.create');
	const canCreateTransfer = hasFeatureAndPermission(user, 'transfers.create', undefined, 'transfers.create');
	const canCreateAdjustment = hasFeatureAndPermission(user, 'adjustments.create', undefined, 'adjustments.create');

	return (
		<div className="flex flex-col w-full px-6 sm:px-8">
			<div className="flex flex-col sm:flex-row flex-auto sm:items-center sm:justify-between gap-4 min-w-0 my-8 sm:my-12">
				<div className="flex flex-auto items-start min-w-0">
					<Avatar
						sx={(theme) => ({
							background: (theme) => darken(theme.palette.background.default, 0.05),
							color: theme.palette.text.secondary
						})}
						className="shrink-0 w-16 h-16 mt-1"
						alt="user photo"
						src={user?.photoURL}
					>
						{user?.displayName?.[0]}
					</Avatar>
					<div className="flex flex-col min-w-0 mx-4">
						<PageBreadcrumb />
						<Typography className="text-2xl md:text-5xl font-semibold tracking-tight leading-7 md:leading-[1.375] truncate">
							Shopynn - Admin Dashboard
						</Typography>

						<div className="flex items-center">
							<FuseSvgIcon
								size={20}
								color="action"
							>
								heroicons-solid:cube
							</FuseSvgIcon>
							<Typography
								className="mx-1.5 leading-6 truncate"
								color="text.secondary"
							>
								{isGuest ? 'Guest Access' : `Welcome, ${user?.displayName || user?.email}`}
							</Typography>
						</div>
					</div>
				</div>
				<Box className="flex flex-wrap items-center justify-start sm:justify-end gap-0.5 shrink-0">
					{canCreateSale && (
						<Tooltip title="New sale">
							<IconButton component={Link} href="/trading/newsale" color="success" aria-label="New sale">
								<FuseSvgIcon size={22}>heroicons-outline:shopping-cart</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					)}
					{canCreatePurchase && (
						<Tooltip title="New purchase">
							<IconButton component={Link} href="/trading/newpurchase" color="primary" aria-label="New purchase">
								<FuseSvgIcon size={22}>heroicons-outline:truck</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					)}
					{canCreateTransfer && (
						<Tooltip title="New transfer">
							<IconButton component={Link} href="/inventory/newtransfer" color="info" aria-label="New transfer">
								<FuseSvgIcon size={22}>heroicons-outline:arrow-path</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					)}
					{canCreateAdjustment && (
						<Tooltip title="Adjust stock">
							<IconButton
								component={Link}
								href="/inventory/adjustquantities/new"
								sx={(theme) => ({ color: theme.palette.warning.main })}
								aria-label="Adjust stock"
							>
								<FuseSvgIcon size={22}>heroicons-outline:adjustments-horizontal</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					)}
				</Box>
				{/* <div className="flex items-center mt-6 sm:mt-0 sm:mx-2 space-x-2">
					<Button
						className="whitespace-nowrap"
						variant="contained"
						color="primary"
						startIcon={<FuseSvgIcon size={20}>heroicons-solid:envelope</FuseSvgIcon>}
					>
						Messages
					</Button>
					<Button
						className="whitespace-nowrap"
						variant="contained"
						color="secondary"
						startIcon={<FuseSvgIcon size={20}>heroicons-solid:cog-6-tooth</FuseSvgIcon>}
					>
						Settings
					</Button>
				</div> */}
			</div>
			{/* <div className="flex items-center">
				<Button
					onClick={handleOpenProjectMenu}
					className="flex items-center border border-solid border-b-0 rounded-b-none h-9 px-4 text-md sm:text-base"
					sx={(theme) => ({
						backgroundColor: `${theme.palette.background.default}!important`,
						borderColor: theme.palette.divider
					})}
					endIcon={
						<FuseSvgIcon
							size={16}
							color="action"
						>
							heroicons-solid:chevron-down
						</FuseSvgIcon>
					}
				>
					{_.find(projects, ['id', selectedProject.id])?.name}
				</Button>
				<Menu
					id="project-menu"
					anchorEl={selectedProject.menuEl}
					open={Boolean(selectedProject.menuEl)}
					onClose={handleCloseProjectMenu}
				>
					{projects &&
						projects.map((project) => (
							<MenuItem
								key={project.id}
								onClick={() => {
									handleChangeProject(project.id);
								}}
							>
								{project.name}
							</MenuItem>
						))}
				</Menu>
			</div> */}
		</div>
	);
}

export default AnalyticsDashboardAppHeader;
