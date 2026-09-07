'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import ExpiringHeader from './ExpiringHeader';
import ExpiringTable from './ExpiringTable';
import { filterExpiringListByDateRange, ExpiringListItem } from './expiringListData';
import { useGetExpiringItemsQuery } from '../InventoryAlertsApi';

type DateRange = { startDate: string; endDate: string } | null;

export default function Expiring() {
	const [dateRange, setDateRange] = useState<DateRange>(null);
	const { data: apiItems = [], isLoading } = useGetExpiringItemsQuery({ days: 30 });

	const filteredItems = useMemo(() => {
		const mapped: ExpiringListItem[] = apiItems.map((it: any) => {
			const expiryDate = String(it?.expiryDate ?? it?.expiry_date ?? it?.expiry ?? it?.expires_at ?? it?.expiresAt ?? '');
			const qty = Number(it?.qty ?? it?.quantity ?? it?.quantity_available ?? it?.quantityAvailable ?? 0);
			let daysUntilExpiry = Number(it?.daysLeft ?? it?.days_until_expiry ?? it?.daysUntilExpiry ?? NaN);
			if (!Number.isFinite(daysUntilExpiry) && expiryDate) {
				const dt = new Date(expiryDate);
				const diff = dt.getTime() - new Date().setHours(0, 0, 0, 0);
				daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
			}
			return {
				id: String(it?.id ?? it?.product_id ?? it?.productId ?? it?.sku ?? Math.random()),
				name: String(it?.name ?? it?.product_name ?? it?.productName ?? '—'),
				sku: String(it?.sku ?? it?.product_sku ?? it?.productSku ?? '—'),
				quantity: Number.isFinite(qty) ? qty : 0,
				expiryDate: expiryDate || new Date().toISOString().split('T')[0],
				daysUntilExpiry: Number.isFinite(daysUntilExpiry) ? daysUntilExpiry : 0,
				warehouse: String(it?.warehouse ?? it?.warehouse_name ?? it?.warehouseName ?? '—')
			};
		});
		return filterExpiringListByDateRange(
			mapped,
			dateRange?.startDate ?? null,
			dateRange?.endDate ?? null
		);
	}, [apiItems, dateRange]);

	const { itemCount, totalQuantity, urgentCount } = useMemo(() => {
		const count = filteredItems.length;
		const qty = filteredItems.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
		const urgent = filteredItems.filter((i) => i.daysUntilExpiry <= 7).length;
		return { itemCount: count, totalQuantity: qty, urgentCount: urgent };
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
				<ExpiringHeader
					itemCount={itemCount}
					totalQuantity={totalQuantity}
					urgentCount={urgentCount}
					isLoading={isLoading}
					dateRange={dateRange}
					onDateRangeChange={setDateRange}
				/>
				<ExpiringTable data={filteredItems} />
			</div>
		</>
	);
}
