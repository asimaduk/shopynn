'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PermissionGate from '@auth/PermissionGate';
import FeatureUnavailable from '../../../parity/FeatureUnavailable';
import { useLazyRunDataExportQuery } from '../../../parity/ParityApi';

export default function DataExportPage() {
	const [runDataExport, { data, isFetching }] = useLazyRunDataExportQuery();

	return (
		<PermissionGate
			featureFlag="dataExportBackup"
			requiredPermissions={['data_export.view', 'data_export.run']}
			fallback={<FeatureUnavailable title="Data Export & Backup" message="Feature is disabled or you do not have access." />}
		>
			<Box className="p-24 max-w-2xl">
				<Typography variant="h5" className="font-semibold">
					Data Export & Backup
				</Typography>
				<Typography className="mt-8 text-secondary">
					Export data using the current backend export pipeline.
				</Typography>
				<Button className="mt-16" variant="contained" onClick={() => runDataExport()} disabled={isFetching}>
					Run Export
				</Button>
				{data && (
					<Typography className="mt-12 text-secondary">
						Export triggered successfully.
					</Typography>
				)}
			</Box>
		</PermissionGate>
	);
}
