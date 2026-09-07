'use client';

import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { SyntheticEvent, useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import SaleInvoiceDialog from '../SaleInvoiceDialog';
import ResendInvoiceButton from '../ResendInvoiceButton';
import { useParams } from 'next/navigation';
import Link from '@fuse/core/Link';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import FuseLoading from '@fuse/core/FuseLoading';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseTabs from 'src/components/tabs/FuseTabs';
import FuseTab from 'src/components/tabs/FuseTab';
import DetailsTab from './tabs/details/DetailsTab';
import ProductsTab from './tabs/products/ProductsTab';
import { useGetSaleQuery } from '../../TradingApi';

/**
 * The purchase.
 */
function Purchase() {
	const routeParams = useParams<{ orderId: string }>();
	const { orderId } = routeParams;

	const {
		data: order,
		isLoading,
		isError
	} = useGetSaleQuery(orderId, {
		skip: !orderId
	});

	const isMobile = useThemeMediaQuery((_theme) => _theme.breakpoints.down('lg'));

	const [tabValue, setTabValue] = useState('details');
	const [invoiceOpen, setInvoiceOpen] = useState(false);

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
					There is no such sale!
				</Typography>
				<Button
					className="mt-6"
					component={Link}
					variant="outlined"
					to="/trading/purchases"
					color="inherit"
				>
					Go to sales page
				</Button>
			</motion.div>
		);
	}

	return (
		<>
		<FusePageCarded
			header={
				order && (
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
							className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0"
						>
							<div className="flex flex-col min-w-0">
								<Typography className="text-2xl truncate font-semibold">
									{`Invoice ${order.invoice_number}`}
								</Typography>
								<Typography variant="caption" className="font-medium">
									{`To: ${order.customer || 'Walk-In Customer'}`}
								</Typography>
							</div>
							<div className="flex items-center gap-1">
								<Button
									variant="contained"
									color="secondary"
									onClick={() => setInvoiceOpen(true)}
									startIcon={<FuseSvgIcon size={18}>heroicons-outline:paper-airplane</FuseSvgIcon>}
								>
									Send invoice
								</Button>
								<ResendInvoiceButton
									saleId={orderId}
									invoiceNumber={order.invoice_number}
									customerName={order.customer}
									customerEmail={(order as { customer_email?: string }).customer_email}
									size="medium"
								/>
							</div>
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
							label="Sale Details"
						/>
						<FuseTab
							value="products"
							label="Products"
						/>
					</FuseTabs>
					{order && (
						<>
							{tabValue === 'details' && <DetailsTab />}
							{tabValue === 'products' && <ProductsTab />}
						</>
					)}
				</div>
			}
			scroll={isMobile ? 'normal' : 'content'}
		/>
		{order ? (
			<SaleInvoiceDialog
				open={invoiceOpen}
				onClose={() => setInvoiceOpen(false)}
				order={order}
				saleId={orderId}
			/>
		) : null}
		</>
	);
}

export default Purchase;
