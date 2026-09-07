'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import ReorderHeader from './ReorderHeader';
import ReorderTable from './ReorderTable';
import { filterReorderListByDateRange, ReorderListItem } from './reorderListData';
import { useGetLowStockItemsQuery } from '../InventoryAlertsApi';

export default function Reorder() {
	const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
	const { data: apiItems = [], isLoading } = useGetLowStockItemsQuery();

	const filteredItems = useMemo(() => {
		const mapped: ReorderListItem[] = apiItems.map((it: any) => ({
			id: String(it?.id ?? it?.product_id ?? it?.productId ?? it?.sku ?? Math.random()),
			name: String(it?.name ?? it?.product_name ?? it?.productName ?? '—'),
			sku: String(it?.sku ?? it?.product_sku ?? it?.productSku ?? '—'),
			currentStock: Number(it?.current ?? it?.current_stock ?? it?.quantity_available ?? it?.quantityAvailable ?? 0),
			reorderLevel: Number(it?.reorderAt ?? it?.reorder_level ?? it?.reorderLevel ?? 0),
			warehouse: String(it?.warehouse ?? it?.warehouse_name ?? it?.warehouseName ?? '—'),
			reportedAt: String(it?.reportedAt ?? it?.updated_at ?? it?.updatedAt ?? it?.created_at ?? it?.createdAt ?? new Date().toISOString().split('T')[0])
		}));
		return filterReorderListByDateRange(
			mapped,
			dateRange?.startDate ?? null,
			dateRange?.endDate ?? null
		);
	}, [apiItems, dateRange]);

	const { itemCount, criticalCount, shortfallUnits } = useMemo(() => {
		const count = filteredItems.length;
		const critical = filteredItems.filter((i) => i.currentStock === 0).length;
		const shortfall = filteredItems.reduce((s, i) => s + Math.max(0, i.reorderLevel - i.currentStock), 0);
		return { itemCount: count, criticalCount: critical, shortfallUnits: shortfall };
	}, [filteredItems]);

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
				<ReorderHeader
					itemCount={itemCount}
					criticalCount={criticalCount}
					shortfallUnits={shortfallUnits}
					isLoading={isLoading}
					dateRange={dateRange}
					onDateRangeChange={setDateRange}
				/>
				<ReorderTable data={filteredItems} />
			</div>
		</>
	);
}
