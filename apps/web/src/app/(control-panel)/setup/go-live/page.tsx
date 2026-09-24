'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from 'next/link';
import {
	GO_LIVE_STEPS,
	readGoLiveDone,
	writeGoLiveDone,
	type GoLiveStepId
} from './goLiveChecklist';

export default function GoLiveWizardPage() {
	const theme = useTheme();
	const [done, setDone] = useState<Record<GoLiveStepId, boolean>>({
		store: false,
		products: false,
		receipt: false,
		first_sale: false
	});

	useEffect(() => {
		setDone(readGoLiveDone());
	}, []);

	const toggle = useCallback((id: GoLiveStepId) => {
		setDone((prev) => {
			const next = { ...prev, [id]: !prev[id] };
			writeGoLiveDone(next);
			return next;
		});
	}, []);

	const completedCount = useMemo(
		() => GO_LIVE_STEPS.filter((s) => done[s.id]).length,
		[done]
	);
	const allDone = completedCount === GO_LIVE_STEPS.length;

	return (
		<Box className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
			<Paper
				elevation={0}
				className="overflow-hidden rounded-2xl mb-8"
				sx={{
					background:
						theme.palette.mode === 'dark'
							? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`
							: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
					border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
				}}
			>
				<Box className="px-6 py-8 sm:px-10">
					<Typography
						variant="overline"
						className="tracking-widest font-semibold mb-2 block"
						sx={{ color: theme.palette.primary.main }}
					>
						Self-serve setup
					</Typography>
					<Typography variant="h4" className="font-bold tracking-tight">
						Go live in ~15 minutes
					</Typography>
					<Typography className="text-secondary mt-3 text-base leading-relaxed">
						Four steps from empty shop to first real sale. Mark each done as you finish — no agent
						required.
					</Typography>
					<Typography className="mt-4 font-semibold" variant="body2">
						{completedCount} of {GO_LIVE_STEPS.length} complete
						{allDone ? ' — you are ready to sell.' : ''}
					</Typography>
				</Box>
			</Paper>

			<Box className="flex flex-col gap-4">
				{GO_LIVE_STEPS.map((step, index) => (
					<Paper
						key={step.id}
						elevation={0}
						sx={{
							border: `1px solid ${theme.palette.divider}`,
							borderRadius: 2,
							p: 2.5,
							opacity: done[step.id] ? 0.85 : 1
						}}
					>
						<Box className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
							<Box
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold"
								sx={{
									bgcolor: done[step.id]
										? alpha(theme.palette.success.main, 0.15)
										: alpha(theme.palette.primary.main, 0.12),
									color: done[step.id]
										? theme.palette.success.main
										: theme.palette.primary.main
								}}
							>
								{done[step.id] ? (
									<FuseSvgIcon size={20}>heroicons-outline:check</FuseSvgIcon>
								) : (
									index + 1
								)}
							</Box>
							<Box className="flex-1 min-w-0">
								<Typography variant="subtitle1" className="font-semibold">
									{step.title}
								</Typography>
								<Typography className="text-secondary text-sm mt-1">{step.description}</Typography>
								<Box className="mt-3 flex flex-wrap items-center gap-2">
									<Button
										component={Link}
										href={step.href}
										variant="contained"
										size="small"
										color="primary"
									>
										{step.cta}
									</Button>
									<FormControlLabel
										control={
											<Checkbox
												checked={Boolean(done[step.id])}
												onChange={() => toggle(step.id)}
												size="small"
											/>
										}
										label="Mark done"
									/>
								</Box>
							</Box>
						</Box>
					</Paper>
				))}
			</Box>
		</Box>
	);
}
