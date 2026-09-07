import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import ECommerceApi from '../ECommerceApi';
import * as XLSX from 'xlsx';
import store from '@/store/store';
import { useState } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';

export type ProductsHeaderProps = {
	productCount: number;
	categoryCount: number;
	isLoading?: boolean;
};

/**
 * The products header.
 */
function ProductsHeader({ productCount, categoryCount, isLoading }: ProductsHeaderProps) {
	const { data: user } = useUser();
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [processing, setProcessing] = useState(false)
	const canExport = hasFeatureAndPermission(user, 'reports.export', undefined, 'reports.export');

	const handleExportExcel = async () => {
		setProcessing(true)
		const promise = store.store.dispatch(
			ECommerceApi.endpoints.getECommerceProductsForExport.initiate(
				{ pageNumber: 1, pageSize: productCount || 5000 },
				{ forceRefetch: true }
			)
		);
        const { data: products = [] } = await promise;
		const ws = XLSX.utils.json_to_sheet(
			(products as any[]).map((p) => ({
				Name: p.name,
				QTY: p.inventory,
				SKU: p.sku,
				Retail: p.unit_price,
				Wholesale: p.alt_price,
				RoL: p.reorder_quantity
			}))
		);
		const wb = XLSX.utils.book_new(); // Create new workbook
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); // Append worksheet to workbook
		XLSX.writeFile(wb, `Stock_as_at_${new Date().toJSON()}.xlsx`); // Write and download the Excel file
		setProcessing(false)
	};

	const handleRefresh = () => {
		window.location.reload()
	}
	
	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			{processing && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
					<FuseLoading />
				</div>
			)}
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Items</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{productCount.toLocaleString()} {productCount === 1 ? 'item' : 'items'}
								<span className="mx-2 opacity-50">·</span>
								{categoryCount.toLocaleString()} {categoryCount === 1 ? 'category' : 'categories'}
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						className=""
						variant="contained"
						color="success"
						onClick={handleRefresh}
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={20}>heroicons-outline:arrow-path</FuseSvgIcon>
						<span className="mx-1 sm:mx-2">Refresh</span>
					</Button>
				</motion.div>
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						className=""
						variant="contained"
						color="primary"
						component={NavLinkAdapter}
						to="/inventory/products/new"
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
						<span className="mx-1 sm:mx-2">Add</span>
					</Button>
				</motion.div>

				{productCount > 0 && canExport && (
					<motion.div
						className="flex grow-0"
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
					>
						<Button
							className=""
							variant="contained"
							color="secondary"
							onClick={handleExportExcel}
							size={isMobile ? 'small' : 'medium'}
						>
							<FuseSvgIcon size={20}>heroicons-outline:cloud-arrow-down</FuseSvgIcon>
							<span className="mx-1 sm:mx-2">Export</span>
						</Button>
					</motion.div>
				)}
			</div>
		</div>
	);
}

export default ProductsHeader;
