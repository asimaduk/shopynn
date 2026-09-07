'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import ProductsHeader from './ProductsHeader';
import ProductsTable from './ProductsTable';
import { useGetECommerceProductsCountQuery, useGetProductCategoriesQuery } from '../ECommerceApi';

/**
 * Products list — shared counts for header summary.
 */
function Products() {
	const { data: countData, isLoading: countLoading } = useGetECommerceProductsCountQuery(null, {
		refetchOnMountOrArgChange: true
	});
	const { data: categories = [], isLoading: categoriesLoading } = useGetProductCategoriesQuery(null, {
		refetchOnMountOrArgChange: true
	});

	const productCount = countData?.count ?? 0;
	const categoryCount = categories.length;
	const headerLoading = countLoading || categoriesLoading;

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-col px-4">
				<ProductsHeader
					productCount={productCount}
					categoryCount={categoryCount}
					isLoading={headerLoading}
				/>
				<ProductsTable />
			</div>
		</>
	);
}

export default Products;
