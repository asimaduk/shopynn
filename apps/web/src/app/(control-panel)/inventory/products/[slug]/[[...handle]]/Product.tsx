'use client';

import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import Link from '@fuse/core/Link';
import { motion } from 'motion/react';
import { SyntheticEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import FuseTabs from 'src/components/tabs/FuseTabs';
import FuseTab from 'src/components/tabs/FuseTab';
import ProductHeader from './ProductHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import PricingTab from './tabs/PricingTab';
import ProductImagesTab from './tabs/ProductImagesTab';
import { useGetProductBySlugQuery } from '../../../ECommerceApi';
import ProductModel from '../../models/ProductModel';

const schema = z.object({
	name: z.string().nonempty('You must enter a product name').min(5, 'The product name must be at least 5 characters')
});

function Product() {
	const routeParams = useParams<{ slug: string }>();
	const { slug } = routeParams;

	const {
		data: product,
		isLoading,
		isError
	} = useGetProductBySlugQuery(slug, {
		skip: !slug || slug === 'new',
		refetchOnMountOrArgChange: true
	});

	const [tabValue, setTabValue] = useState('basic-info');
	const [processing, setProcessing] = useState(false);

	const methods = useForm({
		mode: 'onChange',
		defaultValues: ProductModel({}),
		resolver: zodResolver(schema)
	});

	const { reset, watch } = methods;
	const form = watch();

	useEffect(() => {
		if (slug === 'new') {
			reset(ProductModel({}));
		}
	}, [slug, reset]);

	useEffect(() => {
		if (product) {
			const slotRefs = [
				product.thumbnail,
				product.picture1,
				product.picture2,
				product.picture3,
				product.picture4
			].filter(Boolean) as string[];
			const dedupSlots = [...new Set(slotRefs.map((k) => String(k)))];
			const hasApiImages = Array.isArray(product.images) && product.images.length > 0;
			const images: unknown[] = hasApiImages ? [...product.images] : dedupSlots;

			const __product = { ...product, images, _tags: '' };
			if (product.tags?.length > 0) {
				__product._tags = product.tags.toString();
			}

			reset(__product);
		}
	}, [product, reset]);

	function handleTabChange(_event: SyntheticEvent, value: string) {
		setTabValue(value);
	}

	function updateProcessing(val: boolean) {
		setProcessing(val);
	}

	if (isLoading && slug !== 'new') {
		return <FuseLoading />;
	}

	if (isError && slug !== 'new') {
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
						Product not found
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mb-6">
						This product may have been removed or the link is incorrect.
					</Typography>
					<Button
						variant="contained"
						color="secondary"
						component={Link}
						to="/inventory/products"
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Back to products
					</Button>
				</Paper>
			</Box>
		);
	}

	if (_.isEmpty(form) || (product && routeParams.slug !== product.slug && routeParams.slug !== 'new')) {
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
						className="max-w-6xl mx-auto"
					>
						<PageBreadcrumb className="mb-4" />

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
							<ProductHeader updateProcessing={updateProcessing} product={product} />

							<Box
								sx={{
									borderBottom: '1px solid',
									borderColor: 'divider',
									px: { xs: 1, sm: 2 },
									pt: 1,
									pb: 1,
									bgcolor: (theme) => alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.45 : 0.75)
								}}
							>
								<FuseTabs value={tabValue} onChange={handleTabChange}>
									<FuseTab value="basic-info" label="Basic info" />
									<FuseTab value="product-images" label="Images" />
									<FuseTab value="pricing" label="Pricing" />
								</FuseTabs>
							</Box>

							<Box className="px-4 py-6 sm:px-8 sm:pb-8">
								<div className={tabValue !== 'basic-info' ? 'hidden' : ''}>
									<BasicInfoTab />
								</div>

								<div className={tabValue !== 'product-images' ? 'hidden' : ''}>
									<ProductImagesTab />
								</div>

								<div className={tabValue !== 'pricing' ? 'hidden' : ''}>
									<PricingTab />
								</div>
							</Box>
						</Paper>
					</motion.div>
				</Box>
			</div>
		</FormProvider>
	);
}

export default Product;
