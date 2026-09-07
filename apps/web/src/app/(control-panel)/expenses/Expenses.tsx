'use client';

import { useMemo } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import ExpensesHeader from './ExpensesHeader';
import ExpensesTable from './ExpensesTable';
import { useGetExpensesQuery, type Expense } from './ExpenseApi';

/**
 * Expenses list page — shared query for header summary and table.
 */
function Expenses() {
	const { data: expenses = [], isLoading } = useGetExpensesQuery();

	const tableRows = useMemo<Expense[]>(
		() =>
			expenses.map((e) => ({
				...e,
				expensed_by: e.expensed_by
					? e.expensed_by
					: `${e.creator_first_name ?? ''} ${e.creator_last_name ?? ''}`.trim() || undefined
			})),
		[expenses]
	);

	const { expenseCount, expenseTotal } = useMemo(() => {
		const count = tableRows.length;
		const total = tableRows.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
		return { expenseCount: count, expenseTotal: total };
	}, [tableRows]);

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
				<ExpensesHeader
					expenseCount={expenseCount}
					expenseTotal={expenseTotal}
					isLoading={isLoading}
				/>
				<ExpensesTable data={tableRows} isLoading={isLoading} />
			</div>
		</>
	);
}

export default Expenses;
