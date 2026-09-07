import _ from 'lodash';
import { PartialDeep } from 'type-fest';
import { EcommerceProduct } from '../../ECommerceApi';

/**
 * The product model.
 */
const ProductModel = (data: PartialDeep<EcommerceProduct>) =>
	_.defaults(data || {}, {
		id: '', //_.uniqueId('product-'),
		name: '',
		handle: '',
		description: '',
		categories: [],
		tags: [],
		featuredImageId: '',
		images: [],
		priceTaxExcl: 0,
		priceTaxIncl: 0,
		taxRate: 0,
		comparedPrice: 0,
		quantity: 0,
		sku: '',
		unit: 'units',
		product_type: 'standard',
		measurement_unit: 'units',
		allows_fractional_qty: false,
		min_order_qty: 1,
		qty_step: 1,
		installment_enabled: false,
		installment_min_initial_percent: null as number | null,
		installment_min_payment_amount: null as number | null,
		width: '',
		height: '',
		depth: '',
		weight: '',
		extraShippingFee: 0,
		price: '',
		active: true,
		image: '',
		total: ''
	});

export default ProductModel;
