import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import ExpenseModel from './models/ExpenseModel';

export const addTagTypes = ['expenses'] as const;

const ExpenseApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getExpenses: build.query<GetExpensesApiResponse, GetExpensesApiArg>({
				query: () => ({ url: `/api/expenses` }),
				// providesTags: ['expenses']
			}),
			getExpense: build.query<GetExpenseApiResponse, GetExpenseApiArg>({
				query: (productId) => ({
					url: `/api/expenses/${productId}`
				}),
				// providesTags: ['']
			}),
			createExpense: build.mutation<CreateExpenseApiResponse, CreateExpenseApiArg>({
				query: (newExpense) => ({
					url: `/api/expenses`,
					method: 'POST',
					body: ExpenseModel(newExpense)
				}),
				// invalidatesTags: ['']
			}),
			updateExpense: build.mutation<CreateExpenseApiResponse, CreateExpenseApiArg>({
				query: (expense) => ({
					url: `/api/expenses/${expense.id}`,
					method: 'PUT',
					body: ExpenseModel(expense)
				}),
				// providesTags: ['']
			}),
		}),
		overrideExisting: false
	});

export default ExpenseApi;

export type GetExpensesApiResponse = /** status 200 OK */ Expense[];
export type GetExpensesApiArg = void;

export type GetExpenseApiResponse = /** status 200 OK */ Expense;
export type GetExpenseApiArg = string;

export type CreateExpenseApiResponse = /** status 200 OK */ Expense;
export type CreateExpenseApiArg = PartialDeep<Expense>;

export type Expense = {
	expensed_by?: string;
	id: string;
	amount: number;
	description: string;
	payment_method: string;
	note: string;
	category: string;
	notes: string[];
	warehouse: string;
	expense_date: string;
	created_at: string;
	creator_first_name?: string;
	creator_last_name?: string;
}

export const { useGetExpenseQuery, useGetExpensesQuery, useCreateExpenseMutation, useUpdateExpenseMutation } = ExpenseApi;

export type ExpenseApiType = {
	[ExpenseApi.reducerPath]: ReturnType<typeof ExpenseApi.reducer>;
};
