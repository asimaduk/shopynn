'use client';

import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { SyntheticEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from '@fuse/core/Link';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import FuseTabs from 'src/components/tabs/FuseTabs';
import FuseTab from 'src/components/tabs/FuseTab';
import CategoryHeader from './CategoryHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import { useGetProductCategoryQuery } from '../../../ECommerceApi';
import CategoryModel from '../../models/CategoryModel';
import CategoryImagesTab from './tabs/CategoryImagesTab';
import AssignedProductsTab from './tabs/AssignedProductsTab';

/**
 * Form Validation Schema
 */
const schema = z.object({
	name: z.string().nonempty('You must enter a category name').min(5, 'The category name must be at least 5 characters'),
	description: z.string().nonempty('You must enter a category description').min(5, 'The category description must be at least 5 characters')
});

/**
 * The category page.
 */
function Category() {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [processing, setProcessing] = useState(false);

	const routeParams = useParams<{ categoryId: string }>();

	const { categoryId } = routeParams;

	const {
		data: category,
		isLoading,
		isError
	} = useGetProductCategoryQuery(categoryId, {
		skip: !categoryId || categoryId === 'new'
	});

	const [tabValue, setTabValue] = useState('basic-info');

	const methods = useForm({
		mode: 'onChange',
		defaultValues: {},
		resolver: zodResolver(schema)
	});

	const { reset, watch } = methods;

	const form = watch();

	useEffect(() => {
		if (categoryId === 'new') {
			reset(CategoryModel({}));
		}
	}, [categoryId, reset]);

	useEffect(() => {
		if (category) {
			reset({ ...category });
		}
	}, [category, reset]);

	/**
	 * Tab Change
	 */
	function handleTabChange(event: SyntheticEvent, value: string) {
		setTabValue(value);
	}

	function updateProcessing(val) {
		setProcessing(val)
	}

	// console.log('is loading',isLoading);
	// console.log('catr',category)
	
	if (isLoading) {
		return <FuseLoading />;
	}

	/**
	 * Show Message if the requested category is not exists
	 */
	if (isError && categoryId !== 'new') {
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
					There is no such category!
				</Typography>
				<Button
					className="mt-6"
					component={Link}
					variant="outlined"
					to="/inventory/categories"
					color="inherit"
				>
					Go to Categories Page
				</Button>
			</motion.div>
		);
	}

	/**
	 * Wait while category data is loading and form is setted
	 */
	// console.log('cat.id',typeof category?.id);
	// console.log('routeParams.categoryId',typeof routeParams.categoryId)
	
	if (_.isEmpty(form) || (category && routeParams.categoryId != category.id && routeParams.categoryId !== 'new')) {
		// console.log('xxxxxxxxxx');
		
		return <FuseLoading />;
	}

	return (
		<FormProvider {...methods}>
			{processing && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
					<FuseLoading />
				</div>
			)}
			<FusePageCarded
				header={<CategoryHeader updateProcessing={updateProcessing} />}
				content={
					<div className="p-4 sm:p-6 max-w-5xl space-y-6">
						<FuseTabs
							value={tabValue}
							onChange={handleTabChange}
						>
							<FuseTab
								value="basic-info"
								label="Basic Info"
							/>
							<FuseTab
								value="products"
								label={`Products (${Number(category?.product_count ?? 0)})`}
							/>

							{/* <FuseTab
								value="image"
								label="Image"
							/> */}
			
						</FuseTabs>
						<div className="">
							<div className={tabValue !== 'basic-info' ? 'hidden' : ''}>
								<BasicInfoTab />
							</div>
							<div className={tabValue !== 'products' ? 'hidden' : ''}>
								<AssignedProductsTab categoryId={categoryId} />
							</div>
							{/* <div className={tabValue !== 'image' ? 'hidden' : ''}>
								<CategoryImagesTab />
							</div> */}
						</div>
					</div>
				}
				scroll={isMobile ? 'normal' : 'content'}
			/>
		</FormProvider>
	);
}

export default Category;
