'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FuseLoading from '@fuse/core/FuseLoading';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { motion } from 'motion/react';
import {
	EcommerceProduct,
	useGetECommerceProductQuery,
	useGetProductBySlugQuery,
	useGetProductCategoriesQuery
} from '../../../ECommerceApi';
import { URLS } from '@/configs/settingsConfig';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';

function imageSrc(imageId: string | undefined | null) {
	if (!imageId) return null;
	return `${URLS.serverUrl}/images?id=${imageId}`;
}

function DetailBlock({
	label,
	children
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<Box className="mb-4 last:mb-0">
			<Typography variant="caption" color="text.secondary" fontWeight={600} className="mb-1 block">
				{label}
			</Typography>
			{children}
		</Box>
	);
}

function ProductViewPage() {
	const routeParams = useParams<{ slug: string }>();
	const slug = routeParams.slug;

	const { data: bySlug, isLoading: slugLoading, isError: slugError } = useGetProductBySlugQuery(slug, {
		skip: !slug,
		refetchOnMountOrArgChange: true
	});

	const productId = bySlug?.id;

	const { data: byId, isLoading: idLoading } = useGetECommerceProductQuery(productId ?? '', {
		skip: !productId,
		refetchOnMountOrArgChange: true
	});

	const { data: categoriesList } = useGetProductCategoriesQuery(null, { refetchOnMountOrArgChange: true });

	const product = (byId ?? bySlug) as EcommerceProduct | undefined;

	const loading = slugLoading || (Boolean(productId) && idLoading && !byId);

	const [activeImageId, setActiveImageId] = useState<string | null>(null);

	const galleryIds = useMemo(() => {
		if (!product) return [];
		const ids = [product.thumbnail, product.picture1, product.picture2, product.picture3, product.picture4].filter(
			Boolean
		) as string[];
		return [...new Set(ids)];
	}, [product]);

	const mainImageId = activeImageId || galleryIds[0] || null;

	const tagList = useMemo(() => {
		if (!product?.tags) return [];
		return Array.isArray(product.tags)
			? product.tags.map((t) => String(t).trim()).filter(Boolean)
			: String(product.tags)
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean);
	}, [product?.tags]);

	const categoryNames = useMemo(() => {
		const p = product as EcommerceProduct & { category_names?: string[] };
		if (Array.isArray(p?.category_names) && p.category_names.length > 0) {
			return p.category_names.filter(Boolean);
		}
		const ids = product?.categories;
		if (!Array.isArray(ids) || !categoriesList?.length) return [];
		return ids
			.map((id) => categoriesList.find((c: { id: string | number; name?: string }) => String(c.id) === String(id))?.name)
			.filter(Boolean) as string[];
	}, [product, categoriesList]);

	const totalQty = Number(product?.inventory ?? 0);
	const reorderLevel = Number(product?.reorder_quantity ?? 0);
	const unitPrice = Number(product?.unit_price ?? 0);
	const altPrice = Number((product as EcommerceProduct & { alt_price?: number })?.alt_price ?? 0);
	const actualCost = Number((product as EcommerceProduct & { actual_cost?: number })?.actual_cost ?? 0);
	const unitMargin = unitPrice > 0 && actualCost > 0 ? unitPrice - actualCost : null;
	const isActive = Boolean(
		(product as EcommerceProduct & { is_active?: boolean; active?: boolean })?.is_active ??
			(product as EcommerceProduct & { active?: boolean })?.active
	);
	const storesQuantities = Array.isArray(product?.stores_quantities) ? product.stores_quantities : [];
	const isLowStock = reorderLevel > 0 && totalQty <= reorderLevel;

	const transactionsTo = product
		? `/inventory/transactions?product=${encodeURIComponent(product.slug)}&product_id=${encodeURIComponent(product.id)}&name=${encodeURIComponent(product.name)}`
		: '/inventory/transactions';

	if (!slug) {
		return null;
	}

	if (loading) {
		return (
			<Box className="flex min-h-[50vh] items-center justify-center">
				<FuseLoading />
			</Box>
		);
	}

	if (slugError || !product) {
		return (
			<Box className="px-4 py-12 max-w-lg mx-auto text-center">
				<PageBreadcrumb className="mb-6 text-left" />
				<Paper variant="outlined" className="p-8 rounded-3xl" sx={{ borderColor: 'divider' }}>
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

	return (
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

					<Stack direction="row" flexWrap="wrap" gap={1} className="mb-4" alignItems="center">
						<Button
							component={Link}
							to="/inventory/products"
							color="inherit"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
							sx={{ borderRadius: 2 }}
						>
							Products
						</Button>
						<Box sx={{ flexGrow: 1 }} />
						<Button
							component={Link}
							to={transactionsTo}
							variant="outlined"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:list-bullet</FuseSvgIcon>}
							sx={{ borderRadius: 2 }}
						>
							Transactions
						</Button>
						<Button
							component={Link}
							to={`/inventory/products/${slug}`}
							variant="contained"
							color="secondary"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:pencil-square</FuseSvgIcon>}
							sx={{ borderRadius: 2 }}
						>
							Edit
						</Button>
					</Stack>

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
						<Box className="p-6 sm:p-8">
							<Stack direction={{ xs: 'column', md: 'row' }} gap={4} alignItems={{ md: 'flex-start' }}>
								<Box className="w-full md:max-w-[280px] md:flex-shrink-0">
									<Box
										className="relative w-full overflow-hidden rounded-2xl bg-grey-100"
										sx={{ aspectRatio: '1 / 1', bgcolor: 'action.hover' }}
									>
										{mainImageId ? (
											<img
												src={imageSrc(mainImageId) ?? ''}
												alt={product.name}
												className="h-full w-full object-cover"
											/>
										) : (
											<Box className="flex h-full w-full items-center justify-center">
												<FuseSvgIcon size={64} color="disabled">
													heroicons-outline:cube
												</FuseSvgIcon>
											</Box>
										)}
									</Box>
									{galleryIds.length > 1 && (
										<Stack direction="row" gap={1} flexWrap="wrap" className="mt-2">
											{galleryIds.slice(0, 5).map((id) => {
												const selected = mainImageId === id;
												return (
													<button
														key={id}
														type="button"
														onClick={() => setActiveImageId(id)}
														className="overflow-hidden rounded-lg border-2 p-0"
														style={{
															width: 56,
															height: 56,
															borderColor: selected ? 'var(--mui-palette-primary-main)' : 'transparent'
														}}
													>
														<img src={imageSrc(id) ?? ''} alt="" className="h-full w-full object-cover" />
													</button>
												);
											})}
										</Stack>
									)}
								</Box>

								<Box className="min-w-0 flex-1">
									<Typography variant="h4" fontWeight={800} className="leading-tight">
										{product.name}
									</Typography>
									<Stack direction="row" flexWrap="wrap" gap={1} className="mt-2">
										<Chip size="small" label={product.sku ? `SKU: ${product.sku}` : 'No SKU'} variant="outlined" />
										<Chip
											size="small"
											color={isActive ? 'success' : 'default'}
											label={isActive ? 'Active' : 'Inactive'}
										/>
									</Stack>
									<Typography variant="h5" color="primary" fontWeight={800} className="mt-3">
										{formatGhsCurrency(Number(unitPrice ?? 0), 2, 2)}
									</Typography>
									{altPrice > 0 && (
										<Typography variant="body2" color="text.secondary">
											Wholesale: {formatGhsCurrency(Number(altPrice ?? 0), 2, 2)}
										</Typography>
									)}
									{actualCost > 0 && (
										<Typography variant="body2" color="text.secondary">
											Cost: {formatGhsCurrency(actualCost, 2, 2)}
										</Typography>
									)}
									{unitMargin != null && (
										<Typography variant="body2" color="success.main" fontWeight={600}>
											Unit margin: {formatGhsCurrency(unitMargin, 2, 2)}
										</Typography>
									)}

									<Stack direction="row" gap={2} flexWrap="wrap" className="mt-5">
										<Paper variant="outlined" className="min-w-[120px] flex-1 rounded-xl p-3">
											<Typography variant="h5" fontWeight={800}>
												{totalQty}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												In stock
											</Typography>
										</Paper>
										<Paper variant="outlined" className="min-w-[120px] flex-1 rounded-xl p-3">
											<Typography variant="h5" fontWeight={800}>
												{reorderLevel}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Reorder at
											</Typography>
										</Paper>
									</Stack>

									{isLowStock && (
										<Paper
											className="mt-4 rounded-xl px-3 py-2"
											sx={{
												bgcolor: (t) => alpha(t.palette.error.main, 0.08),
												border: '1px solid',
												borderColor: 'error.light'
											}}
										>
											<Stack direction="row" alignItems="center" gap={1}>
												<FuseSvgIcon color="error" size={20}>
													heroicons-outline:exclamation-triangle
												</FuseSvgIcon>
												<Typography variant="body2" color="error" fontWeight={600}>
													At or below reorder level
												</Typography>
											</Stack>
										</Paper>
									)}
								</Box>
							</Stack>

							<Paper variant="outlined" className="mt-8 rounded-2xl p-5 sm:p-6" sx={{ borderColor: 'divider' }}>
								<Typography variant="subtitle1" fontWeight={700} className="mb-4">
									Details
								</Typography>
								<DetailBlock label="Description">
									<Typography variant="body2" className="whitespace-pre-wrap">
										{(product.description ?? '').trim() || '—'}
									</Typography>
								</DetailBlock>
								{categoryNames.length > 0 && (
									<DetailBlock label="Categories">
										<Stack direction="row" flexWrap="wrap" gap={0.75}>
											{categoryNames.map((c) => (
												<Chip key={c} size="small" label={c} />
											))}
										</Stack>
									</DetailBlock>
								)}
								{tagList.length > 0 && (
									<DetailBlock label="Tags">
										<Stack direction="row" flexWrap="wrap" gap={0.75}>
											{tagList.map((t) => (
												<Chip key={t} size="small" variant="outlined" label={t} />
											))}
										</Stack>
									</DetailBlock>
								)}
							</Paper>

							{storesQuantities.length > 0 && (
								<Paper variant="outlined" className="mt-6 rounded-2xl p-5 sm:p-6" sx={{ borderColor: 'divider' }}>
									<Stack direction="row" alignItems="center" gap={1} className="mb-4">
										<FuseSvgIcon size={22} color="action">
											heroicons-outline:map-pin
										</FuseSvgIcon>
										<Typography variant="subtitle1" fontWeight={700}>
											Stock by location
										</Typography>
									</Stack>
									<Stack divider={<Divider flexItem sx={{ borderColor: 'divider' }} />}>
										{storesQuantities.map((sq: { name?: string; quantity_available?: number }, i: number) => (
											<Stack
												key={`${sq.name}-${i}`}
												direction="row"
												justifyContent="space-between"
												alignItems="center"
												className="py-2"
											>
												<Typography variant="body2">{sq.name || 'Warehouse'}</Typography>
												<Typography variant="body2" fontWeight={700} color="primary">
													{sq.quantity_available ?? 0} units
												</Typography>
											</Stack>
										))}
									</Stack>
								</Paper>
							)}
						</Box>
					</Paper>
				</motion.div>
			</Box>
		</div>
	);
}

export default ProductViewPage;
