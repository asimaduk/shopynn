import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import { useFormContext } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import useNavigate from '@fuse/hooks/useNavigate';
import {
	type EcommerceProduct,
	useCreateECommerceProductMutation,
	useUpdateECommerceProductMutation,
	useUploadProductImagesMutation,
	useUpdateProductImagesMutation
} from '../../../ECommerceApi';
import toast from 'react-hot-toast';
import { URLS } from '@/configs/settingsConfig';
import ProductBulkImportDialog from './ProductBulkImportDialog';

function initialsFromProductName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
	}
	if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return '?';
}

type ProductHeaderProps = {
	updateProcessing: (val: boolean) => void;
	product?: EcommerceProduct | null;
};

function ProductHeader({ updateProcessing, product }: ProductHeaderProps) {
	const routeParams = useParams<{ slug: string }>();
	const { slug } = routeParams;
	const isNew = slug === 'new';

	const [createProduct] = useCreateECommerceProductMutation();
	const [uploadImages] = useUploadProductImagesMutation();
	const [saveProduct] = useUpdateECommerceProductMutation();
	const [updateProductImages] = useUpdateProductImagesMutation();

	const methods = useFormContext();
	const { formState, watch, getValues } = methods;
	const { isValid, dirtyFields } = formState;

	const navigate = useNavigate();
	const [bulkImportOpen, setBulkImportOpen] = useState(false);

	const { name } = watch() as EcommerceProduct;
	const title = (name != null ? String(name) : '').trim();
	const displayTitle = title || (isNew ? 'New product' : 'Product');

	const thumbSrc =
		product?.thumbnail &&
		`${URLS.serverUrl}/images?id=${product.thumbnail}&refresh=${Date.now()}`;

	function createSlug(slg: string) {
		if (!slg) return '';
		let rtn = `${slg}`.toLowerCase();
		rtn = rtn.split(' ').join('-');
		return rtn;
	}

	function base64toBlob(base64Data: string, contentType = '', sliceSize = 512) {
		const byteCharacters = atob(base64Data);
		const byteArrays = [];
		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize);
			const byteNumbers = new Array(slice.length);
			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			byteArrays.push(byteArray);
		}
		return new Blob(byteArrays, { type: contentType });
	}

	function handleUploadProductImages(formData: FormData, id: string, type: string) {
		uploadImages(formData)
			.then((resp) => {
				const ids: string[] | undefined = resp.data?.ids;
				if (!ids) {
					updateProcessing(false);
					toast.success('Product uploaded successfully.');
					navigate(`/inventory/products`);
				} else {
					if (type === 'update') {
						// Preserve existing slot order and fill first available slots with new uploads.
						const slots = [
							product?.thumbnail || '',
							product?.picture1 || '',
							product?.picture2 || '',
							product?.picture3 || '',
							product?.picture4 || ''
						];

						let nextUploadIdx = 0;
						for (let i = 0; i < slots.length && nextUploadIdx < ids.length; i += 1) {
							if (!slots[i]) {
								slots[i] = ids[nextUploadIdx] || '';
								nextUploadIdx += 1;
							}
						}

						return updateProductImages({
							id,
							thumbnail: slots[0],
							picture1: slots[1],
							picture2: slots[2],
							picture3: slots[3],
							picture4: slots[4]
						});
					}
					return updateProductImages({
						id,
						thumbnail: ids[0] || '',
						picture1: ids[1] || '',
						picture2: ids[2] || '',
						picture3: ids[3] || '',
						picture4: ids[4] || ''
					});
				}
			})
			.then(() => {
				updateProcessing(false);
				toast.success('Product uploaded with all images successfully.');
				navigate(`/inventory/products`);
			})
			.catch((err: Error) => {
				updateProcessing(false);
				toast.error(`An error occurred. Please refresh and try again. Message: ${err.message}`);
			});
	}

	function handleSaveProduct() {
		updateProcessing(true);
		const payload = getValues() as EcommerceProduct;
		if (payload._tags) {
			payload.tags = payload._tags?.split(',').map((t) => t.trim());
		}

		let imgs: { url: string }[] = [];
		if (payload && payload.images) {
			imgs = payload.images.filter((img) => typeof img === 'object') as { url: string }[];
			delete payload.images;
		}

		payload.slug = createSlug(payload.name);

		saveProduct(payload)
			.then((res) => {
				const data = res.data as { id?: string } | undefined;
				if (data?.id) {
					const formData = new FormData();
					const productId = data.id;

					const localImgs = imgs.filter((img) => typeof img === 'object' && img.url);
					console.log('localImgs', localImgs);

					localImgs.forEach((img, i) => {
						const base64Image = img.url;
						const contentType = base64Image.substring(5, base64Image.indexOf(';'));
						const base64Data = base64Image.substring(base64Image.indexOf(',') + 1);
						const blob = base64toBlob(base64Data, contentType);
						formData.append(uuidv4(), blob);
						if (i === localImgs.length - 1) {
							handleUploadProductImages(formData, productId, 'update');
						}
					});

					toast.success('Product updated successfully.');
					navigate(`/inventory/products`);
				} else {
					toast.error('Attempt failed. Please try again.');
				}
			})
			.catch((err: Error) => {
				toast.error(`Product update failed. Message: ${err.message}`);
			})
			.finally(() => updateProcessing(false));
	}

	function handleCreateProduct() {
		const newProduct = getValues() as EcommerceProduct;
		let imgs: { url: string }[] = [];
		if (newProduct && newProduct.images) {
			imgs = newProduct.images as { url: string }[];
			delete newProduct.images;
		}
		if (newProduct._tags) {
			newProduct.tags = newProduct._tags?.split(',').map((t) => t.trim());
		}
		newProduct.slug = createSlug(newProduct.name);

		updateProcessing(true);

		createProduct(newProduct)
			.unwrap()
			.then((data: { id: string }) => {
				if (imgs.length === 0) {
					toast.success('Product uploaded successfully.');
					navigate(`/inventory/products`);
					updateProcessing(false);
				} else {
					const formData = new FormData();
					imgs.forEach((img, i) => {
						const base64Image = img.url;
						const contentType = base64Image.substring(5, base64Image.indexOf(';'));
						const base64Data = base64Image.substring(base64Image.indexOf(',') + 1);
						const blob = base64toBlob(base64Data, contentType);
						formData.append(uuidv4(), blob);
						if (i === imgs.length - 1) {
							handleUploadProductImages(formData, data.id, 'new');
						}
					});
				}
			})
			.catch((err: { data?: { error?: string }; message?: string }) => {
				updateProcessing(false);
				if (err?.data?.error?.includes('sku_unique')) {
					toast.error(`Product code is not unique: ${newProduct.sku}`);
				} else {
					toast.error(`An error occurred. Please try again. ${err.message}`);
				}
			});
	}

	return (
		<Box
			className="relative px-5 py-7 sm:px-8 sm:py-8"
			sx={{
				background: (theme) =>
					`linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
			}}
		>
			<Stack
				direction={{ xs: 'column', sm: 'row' }}
				spacing={3}
				alignItems={{ xs: 'flex-start', sm: 'center' }}
				justifyContent="space-between"
			>
				<motion.div
					className="flex flex-row items-center gap-3 min-w-0"
					initial={{ opacity: 0, x: -12 }}
					animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
				>
					<Avatar
						variant="rounded"
						src={thumbSrc || undefined}
						alt={displayTitle}
						sx={{
							width: 64,
							height: 64,
							fontSize: '1.35rem',
							fontWeight: 800,
							bgcolor: 'primary.main',
							color: 'primary.contrastText',
							boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`
						}}
					>
						{initialsFromProductName(displayTitle)}
					</Avatar>
					<Box className="min-w-0">
						<Typography className="text-xl sm:text-2xl font-extrabold tracking-tight truncate" component="h1">
							{displayTitle}
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
							{isNew ? 'Create a catalog item' : 'Edit product · SKU & pricing in tabs'}
						</Typography>
					</Box>
				</motion.div>

				<motion.div
					className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
					initial={{ opacity: 0, x: 12 }}
					animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
				>
					<Button
						variant="outlined"
						component={Link}
						to="/inventory/products"
						size="medium"
						sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Products
					</Button>
					{isNew && (
						<Button
							variant="outlined"
							color="secondary"
							size="medium"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-up-tray</FuseSvgIcon>}
							onClick={() => setBulkImportOpen(true)}
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
						>
							Import
						</Button>
					)}
					{isNew ? (
						<Button
							variant="contained"
							color="secondary"
							size="medium"
							disabled={_.isEmpty(dirtyFields) || !isValid}
							onClick={handleCreateProduct}
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:plus</FuseSvgIcon>}
						>
							Create product
						</Button>
					) : (
						<Button
							variant="contained"
							color="secondary"
							size="medium"
							disabled={_.isEmpty(dirtyFields) || !isValid}
							onClick={handleSaveProduct}
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
						>
							Save changes
						</Button>
					)}
				</motion.div>
			</Stack>
			<ProductBulkImportDialog open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
		</Box>
	);
}

export default ProductHeader;
