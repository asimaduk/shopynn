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
import WarehouseHeader from './WarehouseHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import { useGetWarehouseQuery } from '../../WarehouseApi';
import WarehouseModel, { normalizeWarehousePrinterType } from '../../models/WarehouseModel';
import { useGetLocationsQuery } from '../../../locations/LocationApi';
import useUser from '@auth/useUser';

const schema = z.object({
	name: z.string().min(1, 'Name is required'),
	manager: z.string().min(2, 'Manager / contact must be at least 2 characters'),
	phone: z.string().min(1, 'Phone is required'),
	address: z.string().min(1, 'Address is required'),
	location: z.string().min(1, 'Select or enter a location'),
	notes: z.string().optional(),
	minimum_order_amount: z.coerce.number().min(0, 'Must be 0 or greater').optional().default(0),
	reference_code: z
		.string()
		.optional()
		.transform((s) => (s != null ? String(s).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : ''))
		.refine(
			(s) =>
				!s ||
				(s.length >= 6 &&
					s.length <= 80 &&
					/^[A-Z0-9](?:[A-Z0-9_-]{4,78}[A-Z0-9])?$/.test(s)),
			'Use 6–80 characters: letters, numbers, hyphens, underscores. Must start and end with a letter or number.'
		)
});

function normalizeWarehouseForForm(warehouse: Record<string, unknown>) {
	const notesRaw = warehouse.notes;
	let notes = '';
	if (Array.isArray(notesRaw)) {
		notes = notesRaw.map((n) => (n != null ? String(n) : '')).filter(Boolean).join('\n');
	} else if (notesRaw != null) {
		notes = String(notesRaw);
	}
	const minAmt = Number(warehouse.minimum_order_amount);
	return WarehouseModel({
		...warehouse,
		name: warehouse.name != null ? String(warehouse.name) : '',
		manager: warehouse.manager != null ? String(warehouse.manager) : '',
		phone: warehouse.phone != null ? String(warehouse.phone) : '',
		address: warehouse.address != null ? String(warehouse.address) : '',
		location: warehouse.location != null ? String(warehouse.location) : '',
		printer_type: normalizeWarehousePrinterType(warehouse.printer_type),
		minimum_order_amount: Number.isFinite(minAmt) && minAmt >= 0 ? minAmt : 0,
		reference_code: warehouse.reference_code != null ? String(warehouse.reference_code) : '',
		notes
	});
}

function Warehouse() {
	const [processing, setProcessing] = useState(false);
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const blockCreateWarehouse = Boolean(
		planUsage && planUsage.warehouseCount >= planUsage.maxWarehouses
	);

	const routeParams = useParams<{ warehouseId: string }>();
	const { warehouseId } = routeParams;
	const isNew = warehouseId === 'new';

	const { data: warehouse, isLoading, isError } = useGetWarehouseQuery(warehouseId, {
		skip: !warehouseId || isNew,
		refetchOnMountOrArgChange: true
	});

	const { data: locations } = useGetLocationsQuery(null, { refetchOnMountOrArgChange: true });

	const methods = useForm({
		mode: 'onChange',
		defaultValues: WarehouseModel({}),
		resolver: zodResolver(schema)
	});

	const { reset, watch } = methods;
	const form = watch();

	useEffect(() => {
		if (isNew) {
			reset(WarehouseModel({}));
		}
	}, [isNew, reset]);

	useEffect(() => {
		if (warehouse) {
			reset(normalizeWarehouseForForm(warehouse as Record<string, unknown>));
		}
	}, [warehouse, reset]);

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
						Warehouse not found
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						This warehouse may have been removed or the link is incorrect.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={Link}
						to="/setups/warehouses"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to warehouses
					</Button>
				</Paper>
			</Box>
		);
	}

	if (_.isEmpty(form) || (!isNew && warehouse && warehouseId !== warehouse.id)) {
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

						{isNew && blockCreateWarehouse && planUsage ? (
							<Alert severity="warning" className="mb-4">
								You are using {planUsage.warehouseCount} of {planUsage.maxWarehouses} warehouses allowed on
								your {planUsage.tierDisplay ?? 'current'} plan. You cannot create another warehouse until
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
							<WarehouseHeader
								locations={locations}
								updateProcessing={updateProcessing}
								blockCreate={isNew && blockCreateWarehouse}
							/>
							<Box className="px-4 py-6 sm:px-8 sm:pb-8">
								<BasicInfoTab locations={locations} />
							</Box>
						</Paper>
					</motion.div>
				</Box>
			</div>
		</FormProvider>
	);
}

export default Warehouse;
