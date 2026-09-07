import _ from 'lodash';
import { PartialDeep } from 'type-fest';

/**
 * The supplier model.
 */
const SupplierModel = (data: PartialDeep<any>) =>
	_.defaults(data || {}, {
		id: '',
		name: '',
		manager: '',
		phone: '',
		address: '',
		notes: '',
		created_at: ''
	});

export default SupplierModel;
