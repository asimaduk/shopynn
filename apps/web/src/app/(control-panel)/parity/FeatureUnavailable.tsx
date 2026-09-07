'use client';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

type Props = {
	title: string;
	message: string;
};

export default function FeatureUnavailable({ title, message }: Props) {
	return (
		<Box className="p-24">
			<Typography variant="h5" className="font-semibold">
				{title}
			</Typography>
			<Typography className="mt-12 text-secondary">{message}</Typography>
		</Box>
	);
}
