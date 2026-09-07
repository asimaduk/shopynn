'use client';

import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import Link from '@fuse/core/Link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import LocationHeader from './LocationHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import { useGetLocationQuery } from '../../LocationApi';
import LocationModel from '../../models/LocationModel';
import useUser from '@auth/useUser';

const schema = z.object({
	name: z.string().min(1, 'Name is required'),
	manager: z.string().min(2, 'Manager / contact must be at least 2 characters'),
	phone: z.string().min(1, 'Phone is required'),
	address: z.string().min(1, 'Address is required'),
	notes: z.string().optional()
});

function normalizeLocationForForm(location: Record<string, unknown>) {
	const notesRaw = location.notes;
	let notes = '';
	if (Array.isArray(notesRaw)) {
		notes = notesRaw.map((n) => (n != null ? String(n) : '')).filter(Boolean).join('\n');
	} else if (notesRaw != null) {
		notes = String(notesRaw);
	}
	return LocationModel({
		...location,
		name: location.name != null ? String(location.name) : '',
		manager: location.manager != null ? String(location.manager) : '',
		phone: location.phone != null ? String(location.phone) : '',
		address: location.address != null ? String(location.address) : '',
		notes
	});
}

function Location() {
	const [processing, setProcessing] = useState(false);
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const blockCreateLocation = Boolean(
		planUsage && planUsage.locationCount >= planUsage.maxLocations
	);

	const routeParams = useParams<{ locationId: string }>();
	const { locationId } = routeParams;
	const isNew = locationId === 'new';

	const { data: location, isLoading, isError } = useGetLocationQuery(locationId, {
		skip: !locationId || isNew
	});

	const methods = useForm({
		mode: 'onChange',
		defaultValues: LocationModel({}),
		resolver: zodResolver(schema)
	});

	const { reset, watch } = methods;
	const form = watch();

	useEffect(() => {
		if (isNew) {
			reset(LocationModel({}));
		}
	}, [isNew, reset]);

	useEffect(() => {
		if (location) {
			reset(normalizeLocationForForm(location as Record<string, unknown>));
		}
	}, [location, reset]);

	function updateProcessing(val: boolean) {
		setProcessing(val);
	}

	if (isLoading && !isNew) {
		return <FuseLoading />;
	}

	if (isError && !isNew) {
		return (
			<Box className="px-4 py-12 max-w-lg mx-auto text-center">
				<PageBreadcrumb className="mb-6 text-left" />
				<Paper variant="outlined" className="p-8 rounded-3xl" sx={{ borderColor: 'divider' }}>
					<Box
						className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.12), color: 'error.main' }}
					>
						<FuseSvgIcon size={32}>heroicons-outline:exclamation-circle</FuseSvgIcon>
					</Box>
					<Typography variant="h6" fontWeight={700} gutterBottom>
						Location not found
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						This location may have been removed or the link is incorrect.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={Link}
						to="/setups/locations"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to locations
					</Button>
				</Paper>
			</Box>
		);
	}

	if (_.isEmpty(form) || (!isNew && location && locationId !== location.id)) {
		return <FuseLoading />;
	}

	return (
		<FormProvider {...methods}>
			<Backdrop
				open={processing}
				sx={{
					zIndex: (theme) => theme.zIndex.modal + 1,
					backgroundColor: (theme) => alpha(theme.palette.common.black, 0.45)
				}}
			>
				<FuseLoading />
			</Backdrop>

			<div className="w-full min-h-full pb-12">
				<Box
					className="px-4 sm:px-6 lg:px-10 pt-6 pb-10"
					sx={{
						background: (theme) =>
							`linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08)} 0%, transparent 72%)`
					}}
				>
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
						className="max-w-4xl mx-auto"
					>
						<PageBreadcrumb className="mb-4" />

						{isNew && blockCreateLocation && planUsage ? (
							<Alert severity="warning" className="mb-4">
								You are using {planUsage.locationCount} of {planUsage.maxLocations} locations allowed on
								your {planUsage.tierDisplay ?? 'current'} plan. You cannot create another location until
								you remove one or upgrade.
							</Alert>
						) : null}

						<Paper
							elevation={0}
							sx={{
								borderRadius: 4,
								overflow: 'hidden',
								border: '1px solid',
								borderColor: 'divider',
								bgcolor: 'background.paper',
								boxShadow: (theme) =>
									theme.palette.mode === 'dark'
										? `0 24px 48px ${alpha('#000', 0.35)}`
										: `0 20px 40px ${alpha(theme.palette.common.black, 0.06)}, 0 0 1px ${alpha(theme.palette.common.black, 0.08)}`
							}}
						>
							<LocationHeader
								updateProcessing={updateProcessing}
								blockCreate={isNew && blockCreateLocation}
							/>
							<Box className="px-4 py-6 sm:px-8 sm:pb-8">
								<BasicInfoTab />
							</Box>
						</Paper>
					</motion.div>
				</Box>
			</div>
		</FormProvider>
	);
}

export default Location;
