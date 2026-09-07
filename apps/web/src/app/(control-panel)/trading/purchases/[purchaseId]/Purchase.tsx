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
import { useGetPurchaseQuery } from '../../TradingApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';

/**
 * The purchase.
 */
function Purchase() {
	const routeParams = useParams<{ purchaseId: string }>();
	const { purchaseId } = routeParams;

	const {
		data: purchase,
		isLoading,
		isError
	} = useGetPurchaseQuery(purchaseId, {
		skip: !purchaseId
	});

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
					There is no such purchase!
				</Typography>
				<Button
					className="mt-6"
					component={Link}
					variant="outlined"
					to="/trading/purchases"
					color="inherit"
				>
					Go to purchases page
				</Button>
			</motion.div>
		);
	}

	return (
		<FusePageCarded
			header={
				purchase && (
					<div className="flex flex-1 flex-col py-8">
						<motion.div
							initial={{ x: 20, opacity: 0 }}
							animate={{ x: 0, opacity: 1, transition: { delay: 0.3 } }}
						>
							<PageBreadcrumb className="mb-2" />
						</motion.div>

						<div className='flex justify-between'>
							<motion.div
								initial={{ x: -20, opacity: 0 }}
								animate={{ x: 0, opacity: 1, transition: { delay: 0.3 } }}
								// className="flex flex-col min-w-0"
								className='w-1/2'
							>
								<Typography className="text-2xl truncate font-semibold">
									Invoice no. {purchase.invoice_number}
								</Typography>
								<Typography
									className="font-medium truncate"
								>
									{purchase.supplier}
								</Typography>
								<Typography
									variant="caption"
									className="font-medium"
								>
								 	{new Date(purchase.created_at).toDateString()}
								</Typography>
							</motion.div>

							<motion.div
								initial={{ x: -20, opacity: 0 }}
								animate={{ x: 0, opacity: 1, transition: { delay: 0.3 } }}
								// className="flex flex-col min-w-0"
								className='w-1/2 flex justify-end'
							>
								<div>
									<Typography className="text-2xl text-right truncate font-semibold">
										{formatGhsCurrency(Number(purchase.total_amount ?? 0), 2, 2)}
									</Typography>
									<Typography
										className="font-medium text-right"
									>
										{formatGhsCurrency(Number(purchase.discount_amount ?? 0), 2, 2)}
									</Typography>
									<Typography
										className='font-medium text-right'>
										{purchase.number_of_items} item(s)
									</Typography>
								</div>
							</motion.div>
						</div>
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
							label="Purchase Details"
						/>
						<FuseTab
							value="products"
							label="Products"
						/>
					</FuseTabs>
					{purchase && (
						<>
							{tabValue === 'details' && <DetailsTab purchase={purchase} />}
							{tabValue === 'products' && <ProductsTab purchase={purchase} />}
						</>
					)}
				</div>
			}
			scroll={isMobile ? 'normal' : 'content'}
		/>
	);
}

export default Purchase;
