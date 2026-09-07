import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';

export const addTagTypes = ['eCommerce_products', 'eCommerce_product', 'eCommerce_orders', 'eCommerce_order'] as const;

const TradingApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getSales: build.query<GetSalesApiResponse, GetSalesApiArg>({
				query: () => ({ url: `/api/sales` }),
				providesTags: ['eCommerce_orders']
			}),
			getSale: build.query<any, any>({
				query: (saleId) => ({
					url: `/api/sales/${saleId}`
				}),
				// providesTags: ['']
			}),
			getPurchases: build.query<GetPurchaseApiResponse, GetPurchaseApiArg>({
				query: () => ({ url: `/api/purchases` }),
				providesTags: []
			}),
			getPurchase: build.query<any, any>({
				query: (purchaseId) => ({
					url: `/api/purchases/${purchaseId}`
				}),
				// providesTags: ['']
			}),
			createPurchase: build.mutation<any, any>({
				query: (newPurchase) => ({
					url: `/api/purchases`,
					method: 'POST',
					body: newPurchase//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			createSale: build.mutation<any, any>({
				query: (newSale) => ({
					url: `/api/sales`,
					method: 'POST',
					body: newSale//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			sendSaleInvoice: build.mutation<{ sent_to: string; invoice_number: string }, { saleId: string; email?: string }>({
				query: ({ saleId, email }) => ({
					url: `/api/sales/${saleId}/send-invoice`,
					method: 'POST',
					body: email ? { email } : {}
				})
			}),
			getSaleInvoicePdf: build.query<Blob, string>({
				query: (saleId) => ({
					url: `/api/sales/${saleId}/invoice.pdf`,
					responseHandler: async (response) => response.blob()
				})
			}),
			getProductSalesByDate: build.query<GetSalesApiResponse, GetSalesApiArg>({
				query: (queryString) => ({ url: `/api/sales?${queryString}` }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			getAttendants: build.query<any, any>({
				query: () => ({
					url: `/api/sales/attendants`
				}),
				// providesTags: ['']
			}),

			getProductPurchasesByDate: build.query<GetSalesApiResponse, GetSalesApiArg>({
				query: (queryString) => ({ url: `/api/purchases?${queryString}` })
			}),
			getStoreOrders: build.query<any, { status?: string; warehouse_id?: string; startDate?: string; endDate?: string; fulfillment_type?: string } | void>({
				query: (params) => ({
					url: `/api/store-orders`,
					params
				}),
				providesTags: ['eCommerce_orders']
			}),
			getStoreOrderById: build.query<any, string>({
				query: (id) => ({
					url: `/api/store-orders/${id}`
				}),
				providesTags: ['eCommerce_order']
			}),
			getStoreOrderHistory: build.query<any, string>({
				query: (id) => ({
					url: `/api/store-orders/${id}/history`
				})
			}),
			getStoreOrderDelivery: build.query<any, string>({
				query: (id) => ({
					url: `/api/store-orders/${id}/delivery`
				})
			}),
			updateStoreOrderDelivery: build.mutation<any, { id: string; body: any }>({
				query: ({ id, body }) => ({
					url: `/api/store-orders/${id}/delivery`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['eCommerce_order']
			}),
			updateStoreOrderStatus: build.mutation<any, { id: string; status: string; reason?: string }>({
				query: ({ id, status, reason }) => ({
					url: `/api/store-orders/${id}/status`,
					method: 'PATCH',
					body: { status, reason }
				}),
				invalidatesTags: ['eCommerce_orders', 'eCommerce_order']
			}),
			markStoreOrderPaid: build.mutation<any, { id: string; note?: string }>({
				query: ({ id, note }) => ({
					url: `/api/store-orders/${id}/payments/mark-paid`,
					method: 'POST',
					body: { note }
				}),
				invalidatesTags: ['eCommerce_orders', 'eCommerce_order']
			}),
			recordStoreOrderPartialCash: build.mutation<any, { id: string; amount: number; note?: string }>({
				query: ({ id, amount, note }) => ({
					url: `/api/store-orders/${id}/payments/partial/record`,
					method: 'POST',
					body: { amount, note }
				}),
				invalidatesTags: ['eCommerce_orders', 'eCommerce_order']
			}),
			cancelOrder: build.mutation<any, { id: string; reason: string }>({
				query: ({ id, reason }) => ({
					url: `/api/orders/${id}/cancel`,
					method: 'POST',
					body: { reason }
				}),
				invalidatesTags: ['eCommerce_orders', 'eCommerce_order']
			}),
		}),
		overrideExisting: false
	});

export default TradingApi;

export type GetSuppliersApiResponse = /** status 200 OK */ Supplier[];
export type GetSuppliersApiArg = void;

export type GetSalesApiResponse = /** status 200 OK */ Sale[];
export type GetSalesApiArg = any;

export type GetPurchaseApiResponse = /** status 200 OK */ Purchase[];
export type GetPurchaseApiArg = void;

export type GetCategoriesApiResponse = /** status 200 OK */ EcommerceProduct[];
export type GetCategoriesApiArg = void;

export type GetProductCategoriesApiResponse = /** status 200 OK */ EcommerceProduct[];
export type GetProductCategoriesApiArg = void;

export type GetProductCategoryApiResponse = /** status 200 OK */ ProductCategory;
export type GetProductCategoryApiArg = string;

export type DeleteECommerceProductsApiResponse = unknown;
export type DeleteECommerceProductsApiArg = string[]; /** Product ids */

export type GetECommerceProductApiResponse = /** status 200 OK */ EcommerceProduct;
export type GetECommerceProductApiArg = string;

export type CreateECommerceProductApiResponse = /** status 200 OK */ EcommerceProduct;
export type CreateECommerceProductApiArg = PartialDeep<EcommerceProduct>;

export type UpdateECommerceProductApiResponse = unknown;
export type UpdateECommerceProductApiArg = EcommerceProduct; // Product

export type DeleteECommerceProductApiResponse = unknown;
export type DeleteECommerceProductApiArg = string; // Product id

export type GetECommerceOrdersApiResponse = /** status 200 OK */ EcommerceOrder[];
export type GetECommerceOrdersApiArg = void;

export type GetECommerceOrderApiResponse = /** status 200 OK */ EcommerceOrder;
export type GetECommerceOrderApiArg = string; // Order id

export type UpdateECommerceOrderApiResponse = EcommerceOrder;
export type UpdateECommerceOrderApiArg = EcommerceOrder; // Order

export type DeleteECommerceOrderApiResponse = unknown;
export type DeleteECommerceOrderApiArg = string; // Order id

export type DeleteECommerceOrdersApiResponse = unknown;
export type DeleteECommerceOrdersApiArg = string[]; // Orders id

export type EcommerceProductImageType = {
	id: string;
	url: string;
	type: string;
};

export type ProductCategory = {
	id: string;
	name: string;
	description: string;
	full_picture: string;
	thumbnail: string;
}

export type Stock = {
	id: string;
	name: string;
	quantity: number;
	quantity_available: number;
	minimum_stock_level: number;
	maximum_stock_level: number;
	notes: string[];
	warehouse: string;
}

export type Supplier = {
	id: string;
	name: string;
}


export type Sale = {
	id: string;
	name: string;
	reference: string;
	customer: string;
	total: number;
	payment: number;
	status: number;
	current_status: string;
	invoice_number: string;
	total_amount: string;
	warehouse: string;
	number_of_items: string;
	supplier: string;
	created_at: string;
	products: any[];
	supplier_phone: string;
	supplier_email: string;
	attendant: string;
	attendant_first_name: string;
	attendant_last_name: string;
	customer_email?: string;
	customer_phone?: string;
}

export type Purchase = {
	id: string;
	name: string;
	reference: string;
	total: number;
	payment: number;
	status: number;
	current_status: string;
	invoice_number: string;
	total_amount: string;
	warehouse: string;
	number_of_items: string;
	supplier: string;
	created_at: string;
	products: any[];
	supplier_phone: string;
	supplier_email: string;
	receiver_name: string;
}

export type EcommerceProduct = {
	id: string;
	name: string;
	handle: string;
	description: string;
	categories: string[];
	tags: string[];
	featuredImageId: string;
	thumbnail: string;
	picture1: string;
	picture2: string;
	picture3: string;
	picture4: string;
	// images: EcommerceProductImageType[];
	images: any[];
	unit_price: number;
	priceTaxExcl: number;
	priceTaxIncl: number;
	taxRate: number;
	comparedPrice: number;
	quantity: number;
	inventory: number;
	sku: string;
	width: string;
	height: string;
	depth: string;
	weight: string;
	extraShippingFee: number;
	active: boolean;
};

export type EcommerceOrder = {
	id: string;
	reference: string;
	subtotal: string;
	tax: string;
	discount: string;
	total: string;
	date: string;
	customer: {
		id: string;
		firstName: string;
		lastName: string;
		avatar: string;
		company: string;
		jobTitle: string;
		email: string;
		phone: string;
		invoiceAddress: {
			address: string;
			lat: number;
			lng: number;
		};
		shippingAddress: {
			address: string;
			lat: number;
			lng: number;
		};
	};
	products: Partial<EcommerceProduct & { image: string; price: string }>[];
	status: {
		id: string;
		name: string;
		color: string;
		date?: string;
	}[];
	payment: {
		transactionId: string;
		amount: string;
		method: string;
		date: string;
	};
	shippingDetails: {
		tracking: string;
		carrier: string;
		weight: string;
		fee: string;
		date: string;
	}[];
};

export const {
	// useGetECommerceProductsQuery,
	// useGetECommerceProductQuery,
	// useUpdateECommerceProductMutation,
	// useDeleteECommerceProductMutation,
	useGetPurchaseQuery,
	useGetSalesQuery,
	useCreateSaleMutation,
	useSendSaleInvoiceMutation,
	useLazyGetSaleInvoicePdfQuery,
	// useUploadProductImagesMutation,
	// useUpdateProductImagesMutation,
	// useGetProductCategoryQuery,
	// useGetProductCategoriesQuery,
	// useGetInventoriesQuery,
	// useGetInventoryQuery,
	useCreatePurchaseMutation,
	useGetPurchasesQuery,
	useGetSaleQuery,
	useGetAttendantsQuery,
	useGetStoreOrdersQuery,
	useGetStoreOrderByIdQuery,
	useGetStoreOrderHistoryQuery,
	useGetStoreOrderDeliveryQuery,
	useUpdateStoreOrderDeliveryMutation,
	useUpdateStoreOrderStatusMutation,
	useMarkStoreOrderPaidMutation,
	useRecordStoreOrderPartialCashMutation,
	useCancelOrderMutation
} = TradingApi;

export type ECommerceApiType = {
	[TradingApi.reducerPath]: ReturnType<typeof TradingApi.reducer>;
};
