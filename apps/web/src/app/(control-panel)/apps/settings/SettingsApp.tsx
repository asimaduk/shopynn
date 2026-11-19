'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import SettingsAppHeader from './SettingsAppHeader';

type SettingsAppProps = {
	children: React.ReactNode;
};

/**
 * Settings content shell (no secondary settings sidebar — items live in main nav).
 */
function SettingsApp(props: SettingsAppProps) {
	const { children } = props;

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			{/* Flow in MainLayout’s scroll slot (not absolute inset-0 over the demo banner). */}
			<div className="relative w-full min-h-full">
				<div className="mx-auto w-full max-w-5xl p-3 pb-16 md:p-8 lg:p-12">
					<SettingsAppHeader className="mb-6 md:mb-8" />
					{children}
				</div>
			</div>
		</>
	);
}

export default SettingsApp;
