import _ from 'lodash';
import { PartialDeep } from 'type-fest';

/**
 * The expense model.
 */
const ExpenseModel = (data: PartialDeep<any>) =>
	_.defaults(data || {}, {
		id: '',
		amount: 0,
		voucher: '',
		note: '',
		category: '',
		warehouse: '',
		expensed_by: ''
	});

export default ExpenseModel;
