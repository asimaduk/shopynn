import _ from 'lodash';
import { format } from 'date-fns';
import { PartialDeep } from 'type-fest';

/**
 * The expense model.
 */
const ExpenseModel = (data: PartialDeep<any>) =>
	_.defaults(data || {}, {
		id: '',
		amount: '',
		expense_date: format(new Date(), 'yyyy-MM-dd'),
		voucher: '',
		note: '',
		category: '',
		warehouse: '',
		expensed_by: ''
	});

export default ExpenseModel;
