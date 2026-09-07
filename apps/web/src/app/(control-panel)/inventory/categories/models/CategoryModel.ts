import _ from 'lodash';
import { PartialDeep } from 'type-fest';
import { ProductCategory } from '../../ECommerceApi';

/**
 * The category model.
 */
const CategoryModel = (data: PartialDeep<ProductCategory>) =>
	_.defaults(data || {}, {
		id: _.uniqueId('product-'),
		name: '',
		description: '',
		full_picture: '',
		thumbnail: '',
	});

export default CategoryModel;
