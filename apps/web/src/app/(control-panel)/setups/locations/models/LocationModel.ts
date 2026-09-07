import _ from 'lodash';
import { PartialDeep } from 'type-fest';

/**
 * The location model.
 */
const LocationModel = (data: PartialDeep<any>) =>
	_.defaults(data || {}, {
		id: '',
		name: '',
		manager: '',
		phone: '',
		address: '',
		notes: '',
		created_at: ''
	});

export default LocationModel;
