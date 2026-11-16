import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import Link from '@fuse/core/Link';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { darken } from '@mui/material/styles';
import { alpha } from '@mui/system/colorManipulator';
import Tooltip from '@mui/material/Tooltip';
import clsx from 'clsx';
import Popover, { PopoverProps } from '@mui/material/Popover/Popover';
import useUser from '@auth/useUser';

type UserMenuProps = {
	className?: string;
	popoverProps?: Partial<PopoverProps>;
	arrowIcon?: string;
	/** Icon-only trigger for the folded sidebar rail. */
	compact?: boolean;
};

/**
 * The user menu.
 */
function UserMenu(props: UserMenuProps) {
	const { className, popoverProps, arrowIcon = 'heroicons-outline:chevron-up', compact = false } = props;
	const { data: user, signOut, isGuest } = useUser();
	const [userMenu, setUserMenu] = useState<HTMLElement | null>(null);
	const userMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		setUserMenu(event.currentTarget);
	};

	const userMenuClose = () => {
		setUserMenu(null);
	};

	if (!user) {
		return null;
	}

	const avatar = user?.photoURL ? (
		<Avatar
			sx={(theme) => ({
				background: theme.palette.background.default,
				color: theme.palette.text.secondary
			})}
			className="avatar h-9 w-9 shrink-0"
			alt="user photo"
			src={user?.photoURL}
		/>
	) : (
		<Avatar
			sx={(theme) => ({
				background: (theme) => darken(theme.palette.background.default, 0.05),
				color: theme.palette.text.secondary
			})}
			className="avatar h-9 w-9 shrink-0"
		>
			{user?.displayName?.[0]}
		</Avatar>
	);

	const trigger = (
		<Button
			className={clsx(
				'user-menu flex shrink-0 rounded-lg',
				compact
					? 'h-12 min-h-12 w-12 items-center justify-center p-0'
					: 'h-14 min-h-14 justify-start space-x-3 p-2',
				className
			)}
			sx={(theme) => ({
				borderColor: theme.palette.divider,
				minWidth: compact ? 48 : undefined,
				'&:hover, &:focus': {
					backgroundColor: alpha(theme.palette.divider, 0.6),
					...theme.applyStyles('dark', {
						backgroundColor: alpha(theme.palette.divider, 0.1)
					})
				}
			})}
			onClick={userMenuClick}
			color="inherit"
			aria-label={user?.displayName || 'User menu'}
		>
			{avatar}
			{!compact ? (
				<>
					<div className="flex flex-auto flex-col space-y-2">
						<Typography
							component="span"
							className="title flex truncate text-base font-semibold capitalize leading-none tracking-tight"
						>
							{user?.displayName}
						</Typography>
						<Typography
							className="subtitle flex text-md font-medium leading-none tracking-tighter"
							color="text.secondary"
						>
							{user?.email}
						</Typography>
					</div>
					<div className="flex shrink-0 items-center space-x-2">
						<Tooltip
							title={
								<>
									{user?.role?.toString()}
									{(!user?.role || (Array.isArray(user?.role) && user?.role.length === 0)) &&
										'Guest'}
								</>
							}
						>
							<FuseSvgIcon className="info-icon" size={20}>
								heroicons-outline:information-circle
							</FuseSvgIcon>
						</Tooltip>
						<FuseSvgIcon className="arrow" size={13}>
							{arrowIcon}
						</FuseSvgIcon>
					</div>
				</>
			) : null}
		</Button>
	);

	return (
		<>
			{compact ? (
				<Tooltip title={user?.displayName || 'Account'} placement="right">
					{trigger}
				</Tooltip>
			) : (
				trigger
			)}
			<Popover
				open={Boolean(userMenu)}
				anchorEl={userMenu}
				onClose={userMenuClose}
				anchorOrigin={{
					vertical: 'top',
					horizontal: 'center'
				}}
				transformOrigin={{
					vertical: 'bottom',
					horizontal: 'center'
				}}
				classes={{
					paper: 'py-2 min-w-64'
				}}
				{...popoverProps}
			>
				{isGuest ? (
					<>
						<MenuItem
							component={Link}
							to="/sign-in"
							role="button"
						>
							<ListItemIcon className="min-w-9">
								<FuseSvgIcon>heroicons-outline:lock-closed</FuseSvgIcon>
							</ListItemIcon>
							<ListItemText primary="Sign In" />
						</MenuItem>
						<MenuItem
							component={Link}
							to="/sign-up"
							role="button"
						>
							<ListItemIcon className="min-w-9">
								<FuseSvgIcon>heroicons-outline:user-plus</FuseSvgIcon>
							</ListItemIcon>
							<ListItemText primary="Sign up" />
						</MenuItem>
					</>
				) : (
					<>
						<MenuItem
							component={Link}
							to="/apps/profile"
							onClick={userMenuClose}
							role="button"
						>
							<ListItemIcon className="min-w-9">
								<FuseSvgIcon>heroicons-outline:user-circle</FuseSvgIcon>
							</ListItemIcon>
							<ListItemText primary="My Profile" />
						</MenuItem>
						<MenuItem
							onClick={() => {
								signOut();
							}}
						>
							<ListItemIcon className="min-w-9">
								<FuseSvgIcon>heroicons-outline:arrow-right-on-rectangle</FuseSvgIcon>
							</ListItemIcon>
							<ListItemText primary="Sign out" />
						</MenuItem>
					</>
				)}
			</Popover>
		</>
	);
}

export default UserMenu;
