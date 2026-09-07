import { apiService as api } from 'src/store/apiService';

export type ReportDateRangeParams = {
	startDate?: string;
	endDate?: string;
};

const ReportsApi = api.injectEndpoints({
	endpoints: (build) => ({
		getProfitAndLoss: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/dashboard/profit-and-loss',
				params: arg?.startDate && arg?.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getStockSummary: build.query<any, void>({
			query: () => ({ url: '/api/inventories/summary' })
		}),
		getSalesSummary: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/sales/summary',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getTopProducts: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/sales/top-selling',
				params:
					arg && arg.startDate && arg.endDate
						? { startDate: arg.startDate, endDate: arg.endDate }
						: undefined
			})
		}),
		getCustomersReport: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/sales/customers-report',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getUsersSummary: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/sales/staff-report',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getPurchasesSuppliersSummary: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/purchases/suppliers-summary',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getTransfersSummary: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/transfers/summary',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getAdjustmentsSummary: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => ({
				url: '/api/adjustments/summary',
				params: arg && arg.startDate && arg.endDate ? { startDate: arg.startDate, endDate: arg.endDate } : undefined
			})
		}),
		getAuditLogsForRange: build.query<any, ReportDateRangeParams | undefined>({
			query: (arg) => {
				const params: Record<string, string | number> = { limit: 200 };
				if (arg?.startDate && arg?.endDate) {
					params.startDate = arg.startDate;
					params.endDate = arg.endDate;
				}
				return { url: '/api/audit-logs', params };
			}
		})
	}),
	overrideExisting: false
});

export const {
	useGetProfitAndLossQuery,
	useGetStockSummaryQuery,
	useGetSalesSummaryQuery,
	useGetTopProductsQuery,
	useGetCustomersReportQuery,
	useGetUsersSummaryQuery,
	useGetPurchasesSuppliersSummaryQuery,
	useGetTransfersSummaryQuery,
	useGetAdjustmentsSummaryQuery,
	useGetAuditLogsForRangeQuery
} = ReportsApi;

export default ReportsApi;
