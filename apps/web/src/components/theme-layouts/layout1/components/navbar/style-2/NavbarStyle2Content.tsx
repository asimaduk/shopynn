import FuseScrollbars from '@fuse/core/FuseScrollbars';
import { styled } from '@mui/material/styles';
import clsx from 'clsx';
import { memo } from 'react';
import Navigation from 'src/components/theme-layouts/components/navigation/Navigation';
import UserMenu from 'src/components/theme-layouts/components/UserMenu';
import { Divider } from '@mui/material';
import NavbarPinToggleButton from 'src/components/theme-layouts/components/navbar/NavbarPinToggleButton';
import { selectFuseNavbar } from 'src/components/theme-layouts/components/navbar/navbarSlice';
import useFuseLayoutSettings from '@fuse/core/FuseLayout/useFuseLayoutSettings';
import { useAppSelector } from 'src/store/hooks';
import Logo from '../../../../components/Logo';
import { Layout1ConfigDefaultsType } from '@/components/theme-layouts/layout1/Layout1Config';

const Root = styled('div')(({ theme }) => ({
	backgroundColor: theme.palette.background.default,
	color: theme.palette.text.primary,
	'& ::-webkit-scrollbar-thumb': {
		boxShadow: `inset 0 0 0 20px ${'rgba(255, 255, 255, 0.24)'}`,
		...theme.applyStyles('light', {
			boxShadow: `inset 0 0 0 20px ${'rgba(0, 0, 0, 0.24)'}`
		})
	},
	'& ::-webkit-scrollbar-thumb:active': {
		boxShadow: `inset 0 0 0 20px ${'rgba(255, 255, 255, 0.37)'}`,
		...theme.applyStyles('light', {
			boxShadow: `inset 0 0 0 20px ${'rgba(0, 0, 0, 0.37)'}`
		})
	}
}));

const StyledContent = styled(FuseScrollbars)(() => ({
	overscrollBehavior: 'contain',
	overflowX: 'hidden',
	overflowY: 'auto',
	WebkitOverflowScrolling: 'touch',
	backgroundRepeat: 'no-repeat',
	backgroundSize: '100% 40px, 100% 10px',
	backgroundAttachment: 'local, scroll'
}));

type NavbarStyle2ContentProps = {
	className?: string;
};

/**
 * The navbar style 2 content.
 */
function NavbarStyle2Content(props: NavbarStyle2ContentProps) {
	const { className = '' } = props;
	const settings = useFuseLayoutSettings();
	const config = settings.config as Layout1ConfigDefaultsType;
	const navbar = useAppSelector(selectFuseNavbar);
	const foldedClosed = Boolean(config.navbar?.folded && !navbar.foldedOpen);

	return (
		<Root className={clsx('flex h-full flex-auto flex-col overflow-hidden', className)}>
			<div
				className={clsx(
					'flex h-12 shrink-0 flex-row items-center gap-1.5 px-3 md:h-19',
					foldedClosed && 'justify-center px-1'
				)}
			>
				{!foldedClosed ? <Logo /> : null}
				<NavbarPinToggleButton className="h-8 w-8 shrink-0 p-0" />
			</div>

			<StyledContent
				className="flex min-h-0 flex-1 flex-col"
				option={{ suppressScrollX: true, wheelPropagation: false }}
			>
				<Navigation layout="vertical" />
			</StyledContent>

			<Divider />

			<div className={clsx('w-full', foldedClosed ? 'flex justify-center p-1' : 'p-1 md:p-2.5')}>
				<UserMenu className={foldedClosed ? undefined : 'w-full'} compact={foldedClosed} />
			</div>
		</Root>
	);
}

export default memo(NavbarStyle2Content);
