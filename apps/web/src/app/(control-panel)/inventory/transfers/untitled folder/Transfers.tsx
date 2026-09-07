'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import TransfersHeader from './TransfersHeader';
import TransfersTable from './TransfersTable';

/**
 * The products page.
 */
function Transfers() {
	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-col px-4">
				<TransfersHeader />
				<TransfersTable />
			</div>
		</>
	);
}

export default Transfers;
