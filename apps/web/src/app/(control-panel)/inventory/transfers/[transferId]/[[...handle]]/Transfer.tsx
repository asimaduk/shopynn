'use client';

import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { SyntheticEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from '@fuse/core/Link';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseTabs from 'src/components/tabs/FuseTabs';
import FuseTab from 'src/components/tabs/FuseTab';
import DetailsTab from './tabs/details/DetailsTab';
import ProductsTab from './tabs/products/ProductsTab';
import { useGetTransferByIdQuery } from '../../../ECommerceApi';

/**
 * The transfer.
 */
function Transfer() {
	const routeParams = useParams<{ transferId: string }>();
	const { transferId } = routeParams;

	const {
		data: transfer,
		isLoading,
		isError
	} = useGetTransferByIdQuery(transferId, {refetchOnMountOrArgChange: true});

	const isMobile = useThemeMediaQuery((_theme) => _theme.breakpoints.down('lg'));

	const [tabValue, setTabValue] = useState('details');

	/**
	 * Tab Change
	 */
	function handleTabChange(event: SyntheticEvent, value: string) {
		setTabValue(value);
	}

	if (isLoading) {
		return <FuseLoading />;
	}

	if (isError) {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1, transition: { delay: 0.1 } }}
				className="flex flex-col flex-1 items-center justify-center h-full"
			>
				<Typography
					color="text.secondary"
					variant="h5"
				>
					There is no such transfer!
				</Typography>
				<Button
					className="mt-6"
					component={Link}
					variant="outlined"
					to="/inventory/transfers"
					color="inherit"
				>
					Go to transfers page
				</Button>
			</motion.div>
		);
	}

	return (
		<FusePageCarded
			header={
				transfer && (
					<div className="flex flex-1 flex-col py-8">
						<motion.div
							initial={{ x: 20, opacity: 0 }}
							animate={{ x: 0, opacity: 1, transition: { delay: 0.3 } }}
						>
							<PageBreadcrumb className="mb-2" />
						</motion.div>

						<motion.div
							initial={{ x: -20, opacity: 0 }}
							animate={{ x: 0, opacity: 1, transition: { delay: 0.3 } }}
							className="flex flex-col min-w-0"
						>
							<Typography className="text-2xl truncate font-semibold">
								{transfer.source} {'=>'} {transfer.destination}
							</Typography>
							<Typography
								variant="caption"
								className="font-medium"
							>
								Trasfered By: {transfer.first_name} {transfer.last_name}
							</Typography>
						</motion.div>
					</div>
				)
			}
			content={
				<div className="p-4 sm:p-6 w-full">
					<FuseTabs
						className="mb-8"
						value={tabValue}
						onChange={handleTabChange}
					>
						<FuseTab
							value="details"
							label="Transfer Details"
						/>
						<FuseTab
							value="products"
							label="Products"
						/>
					</FuseTabs>
					{transfer && (
						<>
							{tabValue === 'details' && <DetailsTab transfer={transfer}/>}
							{tabValue === 'products' && <ProductsTab transfer={transfer} />}
						</>
					)}
				</div>
			}
			scroll={isMobile ? 'normal' : 'content'}
		/>
	);
}

export default Transfer;
