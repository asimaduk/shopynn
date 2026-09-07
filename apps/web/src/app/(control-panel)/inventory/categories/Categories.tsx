'use client';

import { useMemo } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import CategoriesHeader from './CategoriesHeader';
import CategoriesTable from './CategoriesTable';
import { useGetProductCategoriesQuery } from '../ECommerceApi';

/**
 * Product categories list — shared query for header summary and table.
 */
function Categories() {
	const { data: categories = [], isLoading } = useGetProductCategoriesQuery(null, { refetchOnMountOrArgChange: true });

	const { categoryCount, activeCount } = useMemo(() => {
		const list = categories ?? [];
		const active = list.filter((c: { active?: boolean }) => c?.active !== false).length;
		return { categoryCount: list.length, activeCount: active };
	}, [categories]);

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
				<CategoriesHeader categoryCount={categoryCount} activeCount={activeCount} isLoading={isLoading} />
				<CategoriesTable data={categories} isLoading={isLoading} />
			</div>
		</>
	);
}

export default Categories;
