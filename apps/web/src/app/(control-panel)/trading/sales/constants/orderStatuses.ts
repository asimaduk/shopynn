import { EcommerceOrder } from '../../TradingApi';

/**
 * The order statuses.
 */
const orderStatuses: EcommerceOrder['status'] = [
	{
		id: '2',
		name: 'Awaiting check payment',
		color: 'bg-blue-500 text-white'
	},
	{
		id: '1',
		name: 'Payment accepted',
		color: 'bg-green-500 text-white'
	},
	{
		id: '3',
		name: 'Preparing the order',
		color: 'bg-orange-500 text-black'
	},
	{
		id: '4',
		name: 'Shipped',
		color: 'bg-purple-500 text-white'
	},
	{
		id: '5',
		name: 'Delivered',
		color: 'bg-green-700 text-white'
	},
	{
		id: '6',
		name: 'Canceled',
		color: 'bg-pink-500 text-white'
	},
	{
		id: '7',
		name: 'Refunded',
		color: 'bg-red-500 text-white'
	},
	{
		id: '8',
		name: 'Payment error',
		color: 'bg-red-700 text-white'
	},
	{
		id: '9',
		name: 'On pre-order (paid)',
		color: 'bg-purple-300 text-white'
	},
	{
		id: '10',
		name: 'Awaiting bank wire payment',
		color: 'bg-blue-500 text-white'
	},
	{
		id: '11',
		name: 'Awaiting PayPal payment',
		color: 'bg-blue-700 text-white'
	},
	{
		id: '12',
		name: 'Remote payment accepted',
		color: 'bg-green-800 text-white'
	},
	{
		id: '13',
		name: 'On pre-order (not paid)',
		color: 'bg-purple-700 text-white'
	},
	{
		id: '14',
		name: 'Awaiting Cash-on-delivery payment',
		color: 'bg-blue-800 text-white'
	}
];

export default orderStatuses;
