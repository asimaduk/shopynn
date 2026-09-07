import { apiService as api } from 'src/store/apiService';
import { PartialDeep } from 'type-fest';
import ProductModel from './products/models/ProductModel';

export const addTagTypes = [
	'eCommerce_products',
	'eCommerce_product',
	'eCommerce_orders',
	'eCommerce_order',
	'eCommerce_categories'
] as const;

const ECommerceApi = api
	.enhanceEndpoints({
		addTagTypes
	})
	.injectEndpoints({
		endpoints: (build) => ({
			getECommerceProductsCount: build.query<GetECommerceProductsCountApiResponse, GetECommerceProductsApiArg>({
				query: () => ({ url: `/api/products/count` }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			getECommerceProducts: build.query<GetECommerceProductsApiResponse, GetECommerceProductsApiArg>({
				query: () => ({ url: `/api/products` }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			getECommerceProductsWithPagination: build.query<GetECommerceProductsApiResponse, GetECommerceProductsWithPaginationApiArg>({
				query: (filter) => ({
					url: `/api/products?pageNumber=${filter.pageNumber ?? 1}&pageSize=${filter.pageSize ?? 5000}&searchText=${filter.searchText ?? ''}&pageType=${filter.pageType ?? ''}`
				}),
				/** Offline POS: keep catalog in cache + persist (see store persist transform). */
				keepUnusedDataFor: 60 * 60 * 24 * 7
			}),
			getECommerceProductsForExport: build.query<GetECommerceProductsApiResponse, GetECommerceProductsWithPaginationApiArg>({
				query: (page) => ({ url: `/api/products/export?pageNumber=${page.pageNumber}&pageSize=${page.pageSize}` }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			deleteECommerceProducts: build.mutation<DeleteECommerceProductsApiResponse, DeleteECommerceProductsApiArg>({
				query: (productIds) => ({
					url: `/api/mock/ecommerce/products`,
					method: 'DELETE',
					body: productIds
				}),
				invalidatesTags: ['eCommerce_products']
			}),
			getECommerceProduct: build.query<GetECommerceProductApiResponse, GetECommerceProductApiArg>({
				query: (productId) => ({
					url: `/api/products/${productId}`
				}),
				// providesTags: ['eCommerce_product', 'eCommerce_products']
			}),

			getProductBySlug: build.query<GetECommerceProductApiResponse, GetECommerceProductApiArg>({
				query: (slug) => ({
					url: `/api/products/slug/${slug}`
				})
			}),
			getProductsByCategory: build.query<GetECommerceProductsApiResponse, { categoryId: string; pageSize?: number; pageNumber?: number; searchText?: string }>({
				query: ({ categoryId, pageSize = 200, pageNumber = 1, searchText = '' }) => ({
					url: `/api/products/by-category/${categoryId}?pageSize=${pageSize}&pageNumber=${pageNumber}&searchText=${encodeURIComponent(searchText)}`
				})
			}),
			// createECommerceProduct: build.mutation<CreateECommerceProductApiResponse, CreateECommerceProductApiArg>({
			// 	query: (newProduct) => ({
			// 		url: `/api/mock/ecommerce/products`,
			// 		method: 'POST',
			// 		body: ProductModel(newProduct)
			// 	}),
			// 	invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			// }),
			createECommerceProduct: build.mutation<CreateECommerceProductApiResponse, CreateECommerceProductApiArg>({
				query: (newProduct) => ({
					url: `/api/products`,
					method: 'POST',
					body: ProductModel(newProduct)
				}),
				invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			uploadProductImages: build.mutation<any, any>({
				query: (imgs) => ({
					url: `/api/images`,
					method: 'POST',
					body: imgs//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			updateProductImages: build.mutation<any, any>({
				query: (imgs) => ({
					url: `/api/products/update-images`,
					method: 'POST',
					body: imgs//ProductModel(newProduct)
				}),
				invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			updateECommerceProduct: build.mutation<UpdateECommerceProductApiResponse, UpdateECommerceProductApiArg>({
				query: (product) => ({
					url: `/api/products/${product.id}`,
					method: 'PUT',
					body: product
				}),
				// invalidatesTags: ['eCommerce_product', 'eCommerce_products']
			}),
			deleteECommerceProduct: build.mutation<DeleteECommerceProductApiResponse, DeleteECommerceProductApiArg>({
				query: (productId) => ({
					url: `/api/products/${productId}`,
					method: 'DELETE'
				}),
				invalidatesTags: ['eCommerce_product', 'eCommerce_products']
			}),
			toggleProductStatus: build.mutation<UpdateProductStatusApiResponse, UpdateProductStatusApiArg>({
				query: (payload) => ({
					url: '/api/products/toggle-status',
					method: 'PUT',
					body: payload
				}),
				// invalidatesTags: ['eCommerce_product', 'eCommerce_products']
			}),
			changeProductPrice: build.mutation<any, { id: string; unit_price?: number; alt_price?: number }>({
				query: (payload) => ({
					url: '/api/products/change-price',
					method: 'POST',
					body: payload
				})
			}),

			getProductCategory: build.query<GetProductCategoryApiResponse, GetProductCategoryApiArg>({
				query: (categoryId) => ({
					url: `/api/categories/${categoryId}`
				}),
				providesTags: (_result, _err, categoryId) => [{ type: 'eCommerce_categories', id: categoryId }]
			}),
			getProductCategories: build.query<GetCategoriesApiResponse, GetCategoriesApiArg>({
				query: () => ({ url: `/api/categories` }),
				providesTags: [{ type: 'eCommerce_categories', id: 'LIST' }]
			}),
			createProductCategory: build.mutation<any, any>({
				query: (newCategory) => ({
					url: `/api/categories`,
					method: 'POST',
					body: newCategory//ProductModel(newProduct)
				}),
				invalidatesTags: [{ type: 'eCommerce_categories', id: 'LIST' }]
			}),
			updateProductCategory: build.mutation<any, any>({
				query: (catr) => ({
					url: `/api/categories/${catr.id}`,
					method: 'PUT',
					body: catr
				}),
				invalidatesTags: (_result, _err, arg) => [
					{ type: 'eCommerce_categories', id: 'LIST' },
					{ type: 'eCommerce_categories', id: arg?.id }
				]
			}),
			deleteProductCategory: build.mutation<any, any>({
				query: (categoryId) => ({
					url: `/api/categories/${categoryId}`,
					method: 'DELETE'
				}),
				invalidatesTags: [{ type: 'eCommerce_categories', id: 'LIST' }]
			}),

			getInventory: build.query<any, any>({
				query: (inventoryId) => ({
					url: `/api/inventories/${inventoryId}`
				}),
				// providesTags: ['eCommerce_product', 'eCommerce_products']
			}),
			getInventories: build.query<GetECommerceProductsApiResponse, GetECommerceProductsApiArg>({
				query: () => ({ url: `/api/inventories` }),
				// providesTags: ['eCommerce_products']
			}),
			createInventory: build.mutation<any, any>({
				query: (newInventory) => ({
					url: `/api/inventories`,
					method: 'POST',
					body: newInventory//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			updateInventories: build.mutation<any, any>({
				query: (newInventoryData) => ({
					url: `/api/inventories/updates`,
					method: 'POST',
					body: newInventoryData//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			updateInventory: build.mutation<any, any>({
				query: (catr) => ({
					url: `/api/inventories/${catr.id}`,
					method: 'PUT',
					body: catr
				}),
				// invalidatesTags: ['eCommerce_product', 'eCommerce_products']
			}),
			deleteInventory: build.mutation<any, any>({
				query: (inventoryId) => ({
					url: `/api/inventories/${inventoryId}`,
					method: 'DELETE'
				}),
				// invalidatesTags: ['eCommerce_product', 'eCommerce_products']
			}),

			/** `GET /api/transactions` — parity with `cheqstock` `transactions.list` + mobile product transactions. */
			listProductTransactions: build.query<ProductTransaction[], ListProductTransactionsArg>({
				query: (arg) => {
					const params: Record<string, string> = {};
					if (arg?.product) params.product = arg.product;
					if (arg?.product_id) params.product_id = arg.product_id;
					if (arg?.startDate) params.startDate = arg.startDate;
					if (arg?.endDate) params.endDate = arg.endDate;
					/** Backend `getAllTransactionsService` requires `type` to be literally `all` | `sale` | `stock_in` (omitting it skips both queries). */
					if (arg?.type) params.type = arg.type;
					return { url: '/api/transactions', params };
				},
				transformResponse: (raw: unknown) => {
					if (Array.isArray(raw)) return raw as ProductTransaction[];
					return [];
				}
			}),

			getProductTransfers: build.query<GeProductTransactionsApiResponse, GetProductTransactionsApiArg>({
				query: (productSlug?: string) => ({ url: productSlug ? `/api/products/transfers?product=${productSlug}` : '/api/products/transfers' }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			getProductTransfersByDate: build.query<GeProductTransactionsApiResponse, GetProductTransactionsApiArg>({
				query: (dates: string) => ({ url: `/api/products/transfers?startDate=${dates.split('__')[0]}&endDate=${dates.split('__')[1]}` }),
				// providesTags: ['eCommerce_products'],
				// keepUnusedDataFor: 3
			}),
			createTransfer: build.mutation<any, any>({
				query: (newTransfer) => ({
					url: `/api/products/transfers`,
					method: 'POST',
					body: newTransfer//ProductModel(newProduct)
				}),
				// invalidatesTags: ['eCommerce_products', 'eCommerce_product']
			}),
			getTransferById: build.query<GetECommerceTransferApiResponse, GetECommerceTransferApiArg>({
				query: (id) => ({
					url: `/api/products/transfers/${id}`
				})
			}),
		}),
		overrideExisting: false
	});

export default ECommerceApi;

export type GetECommerceProductsCountApiResponse = {count: number}
export type GetECommerceProductsApiResponse = /** status 200 OK */ EcommerceProduct[];
export type GetECommerceProductsApiArg = void;
export type GetECommerceProductsWithPaginationApiArg = {pageSize?:number, pageNumber?:number, searchText?: string, pageType?: string};

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

export type GetECommerceTransferApiResponse = /** status 200 OK */ EcommerceTransfer;
export type GetECommerceTransferApiArg = string;

export type CreateECommerceProductApiResponse = /** status 200 OK */ EcommerceProduct;
export type CreateECommerceProductApiArg = PartialDeep<EcommerceProduct>;

export type UpdateECommerceProductApiResponse = unknown;
export type UpdateECommerceProductApiArg = EcommerceProduct; // Product

export type DeleteECommerceProductApiResponse = unknown;
export type DeleteECommerceProductApiArg = string; // Product id

export type UpdateProductStatusApiResponse = unknown;
export type UpdateProductStatusApiArg = unknown;

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

/** Inventory line from `GET /api/transactions` (same shape as legacy product rows). */
export type ProductTransaction = {
	id?: string;
	type: number;
	name?: string;
	quantity?: number;
	unit_price?: number;
	created_at?: string;
	first_name?: string;
	last_name?: string;
	warehouse?: string;
	sale_id?: string;
	purchase_id?: string;
	thumbnail?: string;
	invoice_number?: string;
	notes?: string;
	attendant?: string;
};

export type ListProductTransactionsArg = {
	/** Filter by product slug/id (web `?product=`). */
	product?: string;
	/** Mobile-style filter. */
	product_id?: string;
	startDate?: string;
	endDate?: string;
	type?: 'all' | 'sale' | 'stock_in';

};

export type GeProductTransactionsApiResponse = /** status 200 OK */ ProductTransaction[];
export type GetProductTransactionsApiArg = string;

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
	product_count?: number;
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

export type EcommerceTransfer = {
	id: string;
	source: string;
	destination: string;
	notes: string;
	number_of_items: number;
	created_at: string;
	attendant: string;
}

export type EcommerceProduct = {
	id: string;
	name: string;
	handle: string;
	description: string;
	slug: string;
	_tags: string;
	categories: string[];
	tags: string[];
	featuredImageId: string;
	thumbnail: string;
	picture1: string;
	picture2: string;
	picture3: string;
	picture4: string;
	reorder_quantity: number;
	// images: EcommerceProductImageType[];
	images: any[];
	unit_price: number;
	alt_price: number;
	actual_cost?: number | null;
	priceTaxExcl: number;
	priceTaxIncl: number;
	taxRate: number;
	comparedPrice: number;
	quantity: number;
	inventory: number;
	sku: string;
	unit: string;
	product_type: 'standard' | 'fabric' | 'service' | string;
	measurement_unit: string;
	allows_fractional_qty: boolean;
	min_order_qty: number;
	qty_step: number;
	installment_enabled?: boolean;
	installment_min_initial_percent?: number | null;
	installment_min_payment_amount?: number | null;
	width: string;
	height: string;
	depth: string;
	weight: string;
	extraShippingFee: number;
	active: boolean;
	created_at: string;
	sale_id: string;
	purchase_id: string;
	type: number,
	warehouse: string,
	first_name: string,
	last_name: string,
	stores_quantities: any[],
	product_count?: number
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
	useGetECommerceProductsQuery,
	useDeleteECommerceProductsMutation,
	useGetECommerceProductQuery,
	useUpdateECommerceProductMutation,
	useDeleteECommerceProductMutation,
	useCreateECommerceProductMutation,
	useUploadProductImagesMutation,
	useUpdateProductImagesMutation,
	useGetProductCategoryQuery,
	useGetProductCategoriesQuery,
	useCreateProductCategoryMutation,
	useDeleteProductCategoryMutation,
	useUpdateProductCategoryMutation,
	useGetInventoriesQuery,
	useGetInventoryQuery,
	useCreateInventoryMutation,
	useDeleteInventoryMutation,
	useUpdateInventoriesMutation,
	useUpdateInventoryMutation,
	useGetProductBySlugQuery,
	useGetProductsByCategoryQuery,
	useToggleProductStatusMutation,
	useChangeProductPriceMutation,
	useListProductTransactionsQuery,
	useGetProductTransfersByDateQuery,
	useGetProductTransfersQuery,
	useCreateTransferMutation,
	useGetTransferByIdQuery,
	useGetECommerceProductsCountQuery,
	useGetECommerceProductsWithPaginationQuery
} = ECommerceApi;

export type ECommerceApiType = {
	[ECommerceApi.reducerPath]: ReturnType<typeof ECommerceApi.reducer>;
};
