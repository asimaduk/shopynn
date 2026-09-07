import _ from 'lodash';
import { PartialDeep } from 'type-fest';

export const WAREHOUSE_PRINTER_TYPE_VALUES = ['thermal', 'a4', 'any'] as const;
export type WarehousePrinterType = (typeof WAREHOUSE_PRINTER_TYPE_VALUES)[number];

export const WAREHOUSE_PRINTER_OPTIONS: { value: WarehousePrinterType; label: string }[] = [
	{ value: 'thermal', label: 'Thermal receipt' },
	{ value: 'a4', label: 'A4 / standard printer' },
	{ value: 'any', label: 'Any / not specified' }
];

export function normalizeWarehousePrinterType(value: unknown): WarehousePrinterType {
	const s = value != null && String(value).trim() !== '' ? String(value).toLowerCase() : 'any';
	return (WAREHOUSE_PRINTER_TYPE_VALUES as readonly string[]).includes(s) ? (s as WarehousePrinterType) : 'any';
}

/**
 * The warehouse model.
 */
const WarehouseModel = (data: PartialDeep<any>) =>
	_.defaults(data || {}, {
		id: '',
		name: '',
		manager: '',
		phone: '',
		address: '',
		location: '',
		notes: '',
		printer_type: 'any' satisfies WarehousePrinterType,
		minimum_order_amount: 0,
		reference_code: '',
		created_at: ''
	});

export default WarehouseModel;
