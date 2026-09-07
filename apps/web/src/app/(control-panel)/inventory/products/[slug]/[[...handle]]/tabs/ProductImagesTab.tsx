import React, { useState, useRef } from 'react';
import { lighten, styled } from '@mui/material/styles';
import clsx from 'clsx';
import FuseUtils from '@fuse/utils';
import { Controller, useFormContext } from 'react-hook-form';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Box from '@mui/material/Box';
import {
	EcommerceProduct,
	useUploadProductImagesMutation,
	useUpdateProductImagesMutation
} from '../../../../ECommerceApi';
import FuseLoading from '@fuse/core/FuseLoading';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import toast from 'react-hot-toast';
import { URLS } from '@/configs/settingsConfig';

const Root = styled('div')(({ theme }) => ({
	'& .productImageFeaturedStar': {
		position: 'absolute',
		top: 3,
		right: 3,
		color: '#00A4EF',//orange[400],
		opacity: 0
	},
	'& .productImageUpload': {
		transitionProperty: 'box-shadow',
		transitionDuration: theme.transitions.duration.short,
		transitionTimingFunction: theme.transitions.easing.easeInOut
	},
	'& .productImageItem': {
		transitionProperty: 'box-shadow',
		transitionDuration: theme.transitions.duration.short,
		transitionTimingFunction: theme.transitions.easing.easeInOut,
		'&:hover': {
			'& .productImageFeaturedStar': {
				opacity: 0.8
			}
		},
		'&.featured': {
			pointerEvents: 'none',
			boxShadow: theme.shadows[3],
			'& .productImageFeaturedStar': {
				opacity: 1
			},
			'&:hover .productImageFeaturedStar': {
				opacity: 1
			}
		}
	}
}));

/**
 * The product images tab.
 */
function ProductImagesTab() {
	const MAX_IMAGES = 5;
	const methods = useFormContext();
	const { control, watch, setValue } = methods;
	const [showImageChangePrompt, setShowImageChangePrompt] = useState(false);
	const [showFullImage, setShowFullImage] = useState(false);
	const [fullImageUrl, setFullImageUrl] = useState('');
	const [updateImageUrl, setUpdateImageUrl] = useState('');
	const inputFileRef = useRef(null);
	const [newImage, setNewImage] = useState(null);
	const [showNewImage, setShowNewImage] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [uploadImages] = useUploadProductImagesMutation();
	const [updateProductImages] = useUpdateProductImagesMutation();
	const [, forceUpdate] = useState();
	const [serverImageToDelete, setServerImageToDelete] = useState<string | null>(null);
	const [deletingServerImage, setDeletingServerImage] = useState(false);

	const productId = watch('id') as string;

	function buildImageSlotsPayload(remainingKeys: string[]) {
		return {
			id: productId,
			thumbnail: remainingKeys[0] ?? null,
			picture1: remainingKeys[1] ?? null,
			picture2: remainingKeys[2] ?? null,
			picture3: remainingKeys[3] ?? null,
			picture4: remainingKeys[4] ?? null
		};
	}

	const handleChangeImage = () => {
		setShowImageChangePrompt(false);
		inputFileRef.current.click();
	}

	function base64toBlob(base64Data, contentType = '', sliceSize = 512) {
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

	const handleUploadImage = () => {
		setProcessing(true);

		const formData = new FormData();

		const base64Image = newImage.url; // Your base64 encoded data
		const contentType = base64Image.substring(5, base64Image.indexOf(';')); // Extracts "image/png"
		const base64Data = base64Image.substring(base64Image.indexOf(',') + 1); // Removes "data:image/png;base64,"
		const blob = base64toBlob(base64Data, contentType);
		
		formData.append(updateImageUrl, blob);
		
		uploadImages(formData)
			.then(resp=> {
				const ids = resp.data?.ids;				
				if(!ids) {
					toast.error('Failed to upload image. Please try again')
				}
				else {
					forceUpdate((prv)=> prv);
					toast.success('Image updated successfully.');
					setShowNewImage(false);
				}
			})
			.catch(err=> {
				toast.error(`An error occurred. Please try again. Message: ${err.message}`)
			})
			.finally(()=> setProcessing(false))
	}

	const handleNewFileonChange = async (e) => {
		function readFileAsync() {
			return new Promise((resolve, reject) => {
				const file = e?.target?.files?.[0];

				if (!file) {
					return;
				}

				const reader = new FileReader();
				reader.onload = () => {
					resolve({
						id: FuseUtils.generateGUID(),
						url: `data:${file.type};base64,${btoa(reader.result as string)}`,
						type: 'image'
					});
				};
				reader.onerror = reject;
				reader.readAsBinaryString(file);
			});
		}

		const newImage = await readFileAsync();
		setNewImage(newImage);
		setShowNewImage(true);
	}

	const images = watch('images') as EcommerceProduct['images'];
	const imageCount = images?.length ?? 0;

	const confirmDeleteServerImage = async () => {
		const key = serverImageToDelete;
		if (!key || !productId) {
			setServerImageToDelete(null);
			return;
		}
		const serverInOrder = (images || []).filter((i): i is string => typeof i === 'string');
		const remaining = serverInOrder.filter((k) => k !== key);
		setDeletingServerImage(true);
		try {
			await updateProductImages(buildImageSlotsPayload(remaining)).unwrap();
			const next = (images || []).filter((im) => im !== key);
			setValue('images', next, { shouldDirty: true });
			toast.success('Image removed.');
			setServerImageToDelete(null);
		} catch (err: unknown) {
			const msg = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message) : '';
			toast.error(msg || 'Could not delete image.');
		} finally {
			setDeletingServerImage(false);
		}
	};

	return (
		<Root>
			<div className="flex justify-center sm:justify-start flex-wrap -mx-3">
				{imageCount < MAX_IMAGES && (
					<Controller
						name="images"
						control={control}
						render={({ field: { onChange, value } }) => (
							<Box
								sx={(theme) => ({
									backgroundColor: lighten(theme.palette.background.default, 0.02),
									...theme.applyStyles('light', {
										backgroundColor: lighten(theme.palette.background.default, 0.2)
									})
								})}
								component="label"
								htmlFor="button-file"
								className="productImageUpload flex items-center justify-center relative w-32 h-32 rounded-lg mx-3 mb-6 overflow-hidden cursor-pointer shadow-sm hover:shadow-lg"
							>
								<input
									accept="image/*"
									className="hidden"
									id="button-file"
									type="file"
									onChange={async (e) => {
										function readFileAsync() {
											return new Promise((resolve, reject) => {
												const file = e?.target?.files?.[0];

												if (!file) {
													return;
												}

												const reader = new FileReader();
												reader.onload = () => {
													resolve({
														id: FuseUtils.generateGUID(),
														url: `data:${file.type};base64,${btoa(reader.result as string)}`,
														type: 'image'
													});
												};
												reader.onerror = reject;
												reader.readAsBinaryString(file);
											});
										}

										const newImage = await readFileAsync();
										const next = [...((value as EcommerceProduct['images']) || []), newImage].slice(0, MAX_IMAGES);
										onChange(next);
									}}
								/>
								<FuseSvgIcon
									size={32}
									color="action"
								>
									heroicons-outline:arrow-up-on-square
								</FuseSvgIcon>
							</Box>
						)}
					/>
				)}
				<Controller
					// name="featuredImageId"
					name="images"
					control={control}
					defaultValue=""
					render={({ field: { onChange, value } }) => {
						return (
							<>
								{images?.map((media, i) => (
									<Box
										sx={(theme) => ({
											backgroundColor: lighten(theme.palette.background.default, 0.02),
											...theme.applyStyles('light', {
												backgroundColor: lighten(theme.palette.background.default, 0.2)
											})
										})}
										onClick={() => {
											// onChange(i)
											// console.log('med',media)
											if(typeof media === 'string') {
												setFullImageUrl(`${URLS.serverUrl}/images?id=${media}`);
											}
											else {
												setFullImageUrl(media.url);
											}

											setShowFullImage(true);
										}}
										// onKeyDown={() => onChange(i)}
										role="button"
										tabIndex={0}
										className={clsx(
											'productImageItem flex items-center justify-center relative w-32 h-32 rounded-lg mx-3 mb-6 overflow-hidden cursor-pointer outline-hidden shadow-sm hover:shadow-lg',
											// media.id === value && 'featured'
										)}
										key={i}
									>
										{typeof media === 'string' ? (
												<Box
													className="productImageFeaturedStar"
													sx={{
														position: 'absolute',
														top: 4,
														right: 4,
														display: 'flex',
														flexDirection: 'column',
														gap: 0.25,
														zIndex: 2
													}}
													onClick={(e) => e.stopPropagation()}
												>
													<FuseSvgIcon
														onClick={(event) => {
															setUpdateImageUrl(media);
															setShowImageChangePrompt(true);
															event.stopPropagation();
														}}
													>
														heroicons-solid:pencil-square
													</FuseSvgIcon>
													<FuseSvgIcon
														onClick={(event) => {
															setServerImageToDelete(media);
															event.stopPropagation();
														}}
													>
														heroicons-solid:trash
													</FuseSvgIcon>
												</Box>
											) : (
												<FuseSvgIcon
													className="productImageFeaturedStar"
													onClick={(event) => {
														const _images = images.filter((im) => {
															if (typeof im === 'string') return true;
															if (im.id == media.id) return false;
															return true;
														});

														onChange(_images);
														event.stopPropagation();
													}}
												>
													heroicons-solid:trash
												</FuseSvgIcon>
											)}
										<img
											className="max-w-none w-auto h-full"
											// src={media.url}
											src={typeof media === 'string' ? `${URLS.serverUrl}/images?id=${media}&refresh=${Date.now()}` : media.url}
											alt="product"
										/>
									</Box>
								))}
							</>
						);
					}}
				/>

				<input
					accept="image/*"
					className="hidden"
					id="update-button-file"
					type="file"
					ref={inputFileRef}
					onChange={handleNewFileonChange}
					// onChange={async (e) => {
					// 	function readFileAsync() {
					// 		return new Promise((resolve, reject) => {
					// 			const file = e?.target?.files?.[0];

					// 			if (!file) {
					// 				return;
					// 			}

					// 			const reader = new FileReader();
					// 			reader.onload = () => {
					// 				resolve({
					// 					id: FuseUtils.generateGUID(),
					// 					url: `data:${file.type};base64,${btoa(reader.result as string)}`,
					// 					type: 'image'
					// 				});
					// 			};
					// 			reader.onerror = reject;
					// 			reader.readAsBinaryString(file);
					// 		});
					// 	}

					// 	const newImage = await readFileAsync();
					// 	console.log('new Image',newImage);
					// 	setNewImage(newImage);
					// 	setShowNewImage(true);
					// 	// onChange([newImage, ...(value as EcommerceProduct['images'])]);
					// }}
				/>
			</div>
			
			<Dialog
				open={showImageChangePrompt}
				onClose={()=> setShowImageChangePrompt(false)}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">Update Image</DialogTitle>
				<DialogContent>
					<DialogContentText id="alert-dialog-description">
						Confirm you want to update this image.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={()=> setShowImageChangePrompt(false)}>No</Button>
					<Button onClick={handleChangeImage} autoFocus>
						Yes
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={showFullImage}
				onClose={()=> setShowFullImage(false)}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">Image</DialogTitle>
				<DialogContent>
					<div style={{width:300,height:300}}>
						<img
							className="w-full h-full"
							src={fullImageUrl}
							alt="product"
						/>
					</div>
				</DialogContent>
				<DialogActions>
					<Button onClick={()=> setShowFullImage(false)}>Ok</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={Boolean(serverImageToDelete)}
				onClose={() => !deletingServerImage && setServerImageToDelete(null)}
				aria-labelledby="delete-server-image-title"
			>
				<DialogTitle id="delete-server-image-title">Remove image</DialogTitle>
				<DialogContent>
					<DialogContentText>
						This removes the image from the product and deletes the file from storage. Continue?
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button disabled={deletingServerImage} onClick={() => setServerImageToDelete(null)}>
						Cancel
					</Button>
					<Button color="error" disabled={deletingServerImage} onClick={() => void confirmDeleteServerImage()}>
						{deletingServerImage ? 'Removing…' : 'Remove'}
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={showNewImage}
				onClose={()=> setShowNewImage(false)}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">New Image</DialogTitle>
				<DialogContent>
					{processing && (
						<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
							<FuseLoading />
						</div>
					)}
					<div style={{width:300,height:300}}>
						<img
							className="w-full h-full"
							src={newImage?.url}
							alt="new-image"
						/>
					</div>
				</DialogContent>
				<DialogActions>
					<Button onClick={()=> setShowNewImage(false)}>Cancel</Button>
					<Button color="primary" onClick={handleUploadImage}>Upload</Button>
				</DialogActions>
			</Dialog>
		</Root>
	);
}

export default ProductImagesTab;
