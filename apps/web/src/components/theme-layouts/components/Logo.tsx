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
		<Root className="flex flex-1 items-center space-x-3">
			<div className="flex flex-1 items-center space-x-2 px-2.5">
				<img
					className="logo-icon h-8 w-8"
					src="/assets/images/logo/ims.svg"
					alt="Shopynn - Admin"
				/>
				<div className="logo-text flex flex-col flex-auto gap-0.5">
					<Typography className="text-2xl tracking-light font-semibold leading-none">Shopynn - Admin</Typography>
					<Typography
						className="text-[11px] leading-none text-gray-500 mt-1"
						noWrap
						title={subtitle}
						sx={{ maxWidth: 180 }}
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
