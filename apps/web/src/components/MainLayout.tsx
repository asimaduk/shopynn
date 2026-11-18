'use client';

import { FuseLayoutProps } from '@fuse/core/FuseLayout/FuseLayout';
import FuseLayout from '@fuse/core/FuseLayout';
import { useEffect, useMemo } from 'react';
import OfflineBanner from './OfflineBanner';
import DemoShopBanner from './DemoShopBanner';
import themeLayouts from './theme-layouts/themeLayouts';
import { endAuthTransition } from 'src/utils/authTransition';

type MainLayoutProps = Omit<FuseLayoutProps, 'layouts'> & {
	navbar?: boolean;
	toolbar?: boolean;
	footer?: boolean;
	leftSidePanel?: boolean;
	rightSidePanel?: boolean;
};

function MainLayout(props: MainLayoutProps) {
	const {
		children,
		navbar,
		toolbar,
		footer,
		leftSidePanel,
		rightSidePanel,
		settings = {},
		...rest
	} = props;

	const mergedSettings = useMemo(() => {
		const shorthandSettings = {
			config: {
				...(navbar !== undefined && { navbar: { display: navbar } }),
				...(toolbar !== undefined && { toolbar: { display: toolbar } }),
				...(footer !== undefined && { footer: { display: footer } }),
				...(leftSidePanel !== undefined && { leftSidePanel: { display: leftSidePanel } }),
				...(rightSidePanel !== undefined && { rightSidePanel: { display: rightSidePanel } })
			}
		};
		return { ...settings, ...shorthandSettings };
	}, [settings, navbar, toolbar, footer, leftSidePanel, rightSidePanel]);

	useEffect(() => {
		const timer = window.setTimeout(() => endAuthTransition(), 400);
		return () => {
			window.clearTimeout(timer);
			endAuthTransition();
		};
	}, []);

	return (
		<FuseLayout
			{...rest}
			layouts={themeLayouts}
			settings={mergedSettings}
		>
			{/* Keep page flex height intact when demo/offline banners show (POS panes need min-h-0 scroll). */}
			<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
				<div className="shrink-0">
					<DemoShopBanner />
					<OfflineBanner />
				</div>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</div>
		</FuseLayout>
	);
}

export default MainLayout;
