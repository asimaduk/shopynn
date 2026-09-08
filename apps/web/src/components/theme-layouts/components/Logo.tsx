'use client';

import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useUser from '@auth/useUser';
// import MainProjectSelection from '@/components/MainProjectSelection';

const Root = styled('div')(({ theme }) => ({
	'& > .logo-icon': {
		transition: theme.transitions.create(['width', 'height'], {
			duration: theme.transitions.duration.shortest,
			easing: theme.transitions.easing.easeInOut
		})
	},
	'& > .badge': {
		transition: theme.transitions.create('opacity', {
			duration: theme.transitions.duration.shortest,
			easing: theme.transitions.easing.easeInOut
		})
	}
}));

/**
 * The logo component.
 */
function Logo() {
	const { data: user } = useUser();
	const companyName = user?.company?.name || user?.warehouse?.name || 'Shopynn';
	const planName = user?.subscription?.name || user?.company?.subscription?.name || 'Free';
	const subtitle = `${planName} | ${companyName}`;

	return (
		<Root className="flex min-w-0 flex-1 items-center">
			<div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
				<img
					className="logo-icon h-10 w-10 shrink-0 rounded-full shadow-sm"
					src="/assets/images/logo/shopynn-mark-nav.png"
					alt="Shopynn - Admin"
					width={40}
					height={40}
				/>
				<div className="logo-text flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
					<Typography className="truncate text-lg font-semibold leading-none tracking-light">
						Shopynn - Admin
					</Typography>
					<Typography
						className="subtitle mt-1 truncate text-[11px] leading-none text-gray-500"
						title={subtitle}
					>
						{subtitle}
					</Typography>
				</div>
			</div>
			{/* <MainProjectSelection /> */}
		</Root>
	);
}

export default Logo;
