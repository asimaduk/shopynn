'use client';

import { FuseLayoutProps } from '@fuse/core/FuseLayout/FuseLayout';
import FuseLayout from '@fuse/core/FuseLayout';
import { useEffect, useMemo } from 'react';
import OfflineBanner from './OfflineBanner';
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
			<OfflineBanner />
			{children}
		</FuseLayout>
	);
}

export default MainLayout;
