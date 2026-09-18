'use client';
import toast from 'react-hot-toast';

import {
	Box,
	Button,
	Chip,
	IconButton,
	Input,
	Paper,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import Autocomplete from '@mui/material/Autocomplete';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useThemeMediaQuery } from '@fuse/hooks';
import SelectHeldSale from './SelectHeldSale';
import ConfirmDialog from './ConfirmDialog';
import PaymentDialog, { type PosCartSnapshot } from './PaymentDialog';
import A4ReceiptPreviewDialog, { type A4SaleReceiptPayload } from './A4ReceiptPreviewDialog';
import SaleInvoiceDialog from '../sales/SaleInvoiceDialog';
import { consumeResumeParkedMomo } from '../pos-momo-payments/resumeParkedMomo';

import ContactsApi from '../../users/customers/ContactsApi';
import ECommerceApi, { EcommerceProduct, useGetECommerceProductsWithPaginationQuery } from '../../inventory/ECommerceApi';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import { normalizeWarehousePrinterType } from '../../setups/warehouses/models/WarehouseModel';
import { allocateNextInvoiceNumber } from '@/utils/invoiceNumbering';

import { store } from 'src/store/store';

import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { addItem } from '../pending/pendingSalesSlice';
import useUser from '@auth/useUser';

import { addHeldItem, setProducts, setCategories, setCustomers, selectProducts, selectCategories, selectCustomers } from './newSaleSlice';
import FuseLoading from '@fuse/core/FuseLoading';
import { useCreateSaleMutation } from '../TradingApi';
import { URLS } from '@/configs/settingsConfig';
import { hasPermissionCodes } from '@auth/permissions';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import {
	getBulkDiscountFromCompany,
	normalizeBulkDiscount,
	resolveSaleUnitPrice,
	lineDiscountAmount,
	lineTotal as calcLineTotal,
	isPriceMismatchError,
	getSaleApiErrorMessage,
} from '@/utils/bulkDiscount';
import { useGetCompanyProfileQuery } from '../../company-profile/CompanyProfileApi';

const _PRODUCTS_ = "_PRODUCTS_.";
function safeString(v: any): string {
    if (typeof v === 'string') return v;
    if (v == null) return '';
    return String(v);
}

function getErrorCode(err: any): string {
    return safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
}

function getErrorMessage(err: any): string {
    return safeString(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Upload failed.');
}

/** Quantity to show in POS grid: per-store when catalog provides `stores_quantities`, else general inventory. */
function getPosProductDisplayQty(prod: EcommerceProduct, warehouseId: string | number | null): number {
	const storesQuantities: unknown[] = Array.isArray((prod as any)?.stores_quantities)
		? (prod as any).stores_quantities
		: [];
	if (storesQuantities.length > 0 && warehouseId != null) {
		const storeQtyMatch = storesQuantities.find(
			(item: any) => String(item?.warehouse_id) === String(warehouseId)
		) as { quantity_available?: unknown } | undefined;
		const q = Number(storeQtyMatch?.quantity_available);
		return Number.isFinite(q) ? q : 0;
	}
	return Number((prod as any)?.inventory ?? 0) || 0;
}

/**
 * The new sale page.
 */
function NewSale() {
    const dispatch = useAppDispatch();
    const [createSale] = useCreateSaleMutation();

    const contentRef = useRef<HTMLDivElement>(null);
    const { data: user } = useUser();
	const { data: companyProfile } = useGetCompanyProfileQuery(undefined, { refetchOnMountOrArgChange: true });
	const [processing, setProcessing] = useState(false);
	const bulkDiscount = useMemo(() => {
		if (companyProfile?.bulkDiscount) {
			return normalizeBulkDiscount(companyProfile.bulkDiscount);
		}
		return getBulkDiscountFromCompany((user as any)?.company);
	}, [companyProfile, user]);

    // const products = useAppSelector(selectProducts);
    const { data: __products, currentData, refetch, isLoading } = useGetECommerceProductsWithPaginationQuery(
        { pageType: 'pos' },
        { refetchOnMountOrArgChange: true }
    );
    const [products, __setProducts] = useState([]);
    const { data: warehouses } = useGetWarehousesQuery(null, {refetchOnMountOrArgChange:true});

    const categories = useAppSelector(selectCategories);
    const customers_data = useAppSelector(selectCustomers);

    const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const canMultiStores = hasPermissionCodes(user, 'stores.multi_access');
    const [openHeld, setOpenHeld] = useState(false);
    const [selectedValue, setSelectedValue] = useState(null);
    const [openConfirm, setOpenConfirm] = useState(false);
    const [openPayment, setOpenPayment] = useState(false);
    const [resumeMomo, setResumeMomo] = useState<{
        transactionRef: string;
        phone?: string;
        provider?: string;
        chargePaid?: boolean;
        statusText?: string;
    } | null>(null);
    const resumeConsumedRef = useRef(false);
    const [a4ReceiptPreview, setA4ReceiptPreview] = useState<{ open: boolean; payload: A4SaleReceiptPayload | null }>({
        open: false,
        payload: null
    });
    const [invoiceShare, setInvoiceShare] = useState<{
        open: boolean;
        order: Record<string, unknown> | null;
        saleId?: string;
        autoPrintThermal?: boolean;
    }>({ open: false, order: null });
    const [buyers, setBuyers] = useState([]);
    const [category, setCategory] = useState({id:0,name:''});
    const [currentOrder, setCurrentOrder] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [cartFilterText, setCartFilterText] = useState('');
    const [warehouse, setWarehouse] = useState(null);

    const voiceSearch = useVoiceSearch({
        onResult: setFilterText,
        onError: (message) => toast.error(message)
    });

	// Sync catalog from RTK (persisted + live). Local quantity patches stay until a new server payload arrives.
	useEffect(() => {
		const server = currentData ?? __products;
		if (!Array.isArray(server)) return;
		__setProducts(server);
	}, [currentData, __products]);

	const resolvedWarehouseId = useMemo(() => {
		return (
			(canMultiStores ? warehouse?.id : (user as any)?.warehouse?.id) ?? warehouse?.id ?? null
		);
	}, [canMultiStores, warehouse?.id, user]);

	/** Full warehouse row (includes `printer_type`); list API is authoritative vs session `{ id, name }`. */
	const warehouseRecordForPrinting = useMemo(() => {
		const id = resolvedWarehouseId;
		if (id != null && Array.isArray(warehouses)) {
			const row = warehouses.find((w: { id?: string }) => String(w?.id) === String(id));
			if (row) return row;
		}
		return warehouse ?? (user as any)?.warehouse ?? null;
	}, [resolvedWarehouseId, warehouses, warehouse, user]);

    const filteredProducts = useMemo(() => {
        const list = Array.isArray(products) ? products : [];
        const q = filterText.trim().toLowerCase();
        return list?.filter((p) => {
            const inCategory =
                category?.id == 0 ||
                (Array.isArray(p.categories) && p.categories.indexOf(category?.id) > -1);
            if (!inCategory) return false;
            if (!q) return true;
            const name = (p.name ?? '').toLowerCase();
            const sku = (p.sku ?? '').toLowerCase();
            const barCode = String((p as { bar_code?: string }).bar_code ?? '').toLowerCase();
            return name.includes(q) || sku.includes(q) || barCode.includes(q);
        });
    }, [products, category?.id, filterText]);

    const filteredCurrentOrder = useMemo(() => {
        const list = Array.isArray(currentOrder) ? currentOrder : [];
        const q = cartFilterText.trim().toLowerCase();
        if (!q) return list;
        return list.filter((p: any) => {
            const name = String(p?.name ?? '').toLowerCase();
            const sku = String(p?.sku ?? '').toLowerCase();
            const barCode = String(p?.bar_code ?? '').toLowerCase();
            return name.includes(q) || sku.includes(q) || barCode.includes(q);
        });
    }, [currentOrder, cartFilterText]);

    const productsTotalCount = Array.isArray(products) ? products.length : 0;

    useEffect(() => {
        // Mobile parity: store selection is permission-based, not role-based.
        // If user can't access multiple stores, lock them to their assigned warehouse.
        if (!user) return;
        if (!canMultiStores) {
            if (user?.warehouse) {
                setWarehouse(user.warehouse);
            } else if (Array.isArray(warehouses) && warehouses.length > 0) {
                setWarehouse(warehouses[0]);
            }
        }
    }, [user, canMultiStores, warehouses]);

    /** Restore cart + reopen MoMo dialog from Pending MoMo payments. */
    useEffect(() => {
        if (resumeConsumedRef.current) return;
        const parked = consumeResumeParkedMomo();
        if (!parked?.transaction_ref) return;
        resumeConsumedRef.current = true;

        const snap = parked.pos_cart_snapshot || {};
        const lines = Array.isArray(snap.products)
            ? snap.products
            : Array.isArray(snap.currentOrder)
              ? snap.currentOrder
              : [];
        if (lines.length) {
            setCurrentOrder(
                lines.map((line: any) => ({
                    ...line,
                    order_quantity: Number(line.order_quantity ?? line.quantity) || 1
                })) as any
            );
        }
        if (snap.customer_name) setCustomer(String(snap.customer_name));
        if (snap.warehouse_id && Array.isArray(warehouses)) {
            const wh = warehouses.find((w: any) => String(w?.id) === String(snap.warehouse_id));
            if (wh) setWarehouse(wh);
        }

        const st = String(parked.status || '').toLowerCase();
        const paid = ['success', 'paid', 'completed'].includes(st);
        setResumeMomo({
            transactionRef: parked.transaction_ref,
            phone: parked.payment_number || undefined,
            provider: snap.provider || undefined,
            chargePaid: paid,
            statusText: paid
                ? 'Parked MoMo payment confirmed. Complete the sale.'
                : 'Resumed parked MoMo. Tap Check status when the customer confirms payment.'
        });
        setOpenPayment(true);
    }, [warehouses]);
    
	useEffect(() => {
		if (Array.isArray(customers_data)) {
			setBuyers(customers_data.map((d) => `${d.phone} - ${d.name}`));
		}
	}, [customers_data]);

	const refreshCustomers = useCallback(
		async (options?: { notify?: boolean; blocking?: boolean }) => {
			const notify = options?.notify ?? false;
			const blocking = options?.blocking ?? false;
			if (blocking) setProcessing(true);
			try {
				const promise = store.store.dispatch(
					ContactsApi.endpoints.getContactsList.initiate(null, { forceRefetch: true })
				);
				const { data } = await promise;
				if (Array.isArray(data)) {
					dispatch(setCustomers(data));
					setBuyers(data.map((d) => `${d.phone} - ${d.name}`));
					if (notify) toast.success('Customers data refreshed.');
				}
			} finally {
				if (blocking) setProcessing(false);
			}
		},
		[dispatch]
	);

	useEffect(() => {
		void refreshCustomers();
	}, [refreshCustomers]);

	const refreshCategories = useCallback(
		async (options?: { notify?: boolean; blocking?: boolean }) => {
			const notify = options?.notify ?? false;
			const blocking = options?.blocking ?? false;
			if (blocking) setProcessing(true);
			try {
				const promise = store.store.dispatch(
					ECommerceApi.endpoints.getProductCategories.initiate(null, { forceRefetch: true })
				);
				const { data } = await promise;
				if (Array.isArray(data)) {
					dispatch(setCategories(data));
					if (notify) toast.success('Categories data refreshed.');
				}
			} finally {
				if (blocking) setProcessing(false);
			}
		},
		[dispatch]
	);

	useEffect(() => {
		void refreshCategories();
	}, [refreshCategories]);

    const openHeldItems = () => {
        setOpenHeld(true);
    }

    const handleClose = (newValue?: string) => {
        setOpenHeld(false);
    
        if (newValue) {
          setSelectedValue(newValue);
        }
    };

    const handleChangeCategory = (catr) => {
        setCategory(catr);
    }

    const handleAddOrder = (prod: EcommerceProduct) => {
        // console.log('prd',prod);
        // console.log('user',user);
        // console.log('wh',warehouse);
        
        // Mobile parity: only users with multi-store permission must choose a store.
        if (canMultiStores && !warehouse) {
            toast.error('Please select store')
            return;
        }
        
        const resolvedWarehouseId =
            (canMultiStores ? warehouse?.id : (user as any)?.warehouse?.id) ??
            warehouse?.id ??
            null;

        if (!resolvedWarehouseId) {
            toast.error('Please select store')
            return;
        }

        const storesQuantities: any[] = Array.isArray((prod as any)?.stores_quantities) ? (prod as any).stores_quantities : [];
        const storeQtyMatch = storesQuantities.find((item) => String(item?.warehouse_id) === String(resolvedWarehouseId));
        const availableQtyRaw = storeQtyMatch?.quantity_available;
        const availableQty = Number(availableQtyRaw);

        // If store-level quantities exist, enforce them. Otherwise, fall back to general inventory.
        if (storesQuantities.length > 0) {
            if (!storeQtyMatch || !Number.isFinite(availableQty) || availableQty < 1) {
                toast.error(`${warehouse?.name || 'Selected store'} is out of stock`)
                return;
            }
        } else {
            const inv = Number((prod as any)?.inventory ?? 0);
            if (!Number.isFinite(inv) || inv < 1) {
                toast.error('Totally out of stock')
                return;
            }
        }
        
        const y = currentOrder?.find(c=> c.id == prod.id);

        if(!y) {
            const x = currentOrder?.map(o=> o);
            x.unshift({
                ...prod,
                order_quantity: 1,
                // Keep a per-store available quantity for safer increment checks.
                quantity_available:
                    storesQuantities.length > 0 ? availableQty : Number((prod as any)?.inventory ?? 0)
            })
            setCurrentOrder(x)
        }
    }

    const handleAddToHold = () => {
        const pl = { id: Date.now(), customer, currentOrder };
        dispatch(addHeldItem(pl));
        setCustomer(null);
        setCurrentOrder([]);
        setCartFilterText('');
    }

    const onHoldSelect = (itm) => {
        setCustomer(itm.customer);
        setCurrentOrder(itm.currentOrder);
        setCartFilterText('');
        setOpenHeld(false);
    }

    const cancelTransaction = () => {
        setCustomer(null);
        setCurrentOrder([]);
        setCartFilterText('');
    }

    const updateLocalProductsQuantity = (order_products) => {
        let y = products.map(p=>({...p}));

        order_products?.forEach(o=> {
            let f = y.find(p=> p.id === o.id);
            if(f) {                
                f['inventory'] = Number(f.inventory ) - Number(o.order_quantity)
            }
        })

        __setProducts(y);        
        // localStorage.setItem(_PRODUCTS_,JSON.stringify(y));
    }

    // const handleUpdateQuantities = async () => {
    //     const promise = store.store.dispatch(ECommerceApi.endpoints.getInventories.initiate(null,{forceRefetch:true}));
    //     const { data } = await promise;    
            
    //     if(data && data.length > 0) {            
    //         dispatch(setProducts(data));
            
    //         localStorage.setItem(_PRODUCTS_,JSON.stringify(data));
    //         toast.success('Products data refreshed.');           
    //     }
    // }

    const handleMakeNewSale = (paymentData) => {
        const nowIso = new Date().toISOString();
        const id = Date.now();
        const orderTotal = currentOrder?.reduce(
            (pr, c) => pr + calcLineTotal(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount),
            0
        );
        const orderDiscount = currentOrder?.reduce(
            (pr, c) => pr + lineDiscountAmount(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount),
            0
        );
        const payload = {
            id,
            total_amount: orderTotal,
            discount_amount: orderDiscount,
            invoice_number: allocateNextInvoiceNumber(),
            current_status:1,
            customer_id: customer ? customers_data.find(c=> c.name == customer)?.id : null,
            customer: customer || 'Walk In',
            sale_date: new Date().toJSON(),
            products: currentOrder.map(o=> {return {
                id: o.id,
                quantity: o.order_quantity,
                unit_price: resolveSaleUnitPrice(o.order_quantity, o.unit_price, o.alt_price, bulkDiscount),
                name: o.name
            }}),
            notes: `Paid with ${paymentData.paymentType}${paymentData.transNumber ? (' '+paymentData.transNumber):''}${paymentData.payment_transaction_ref ? ` ref ${paymentData.payment_transaction_ref}` : ''}${paymentData.fee_amount ? ` (fee ${paymentData.fee_amount})` : ''}`,
            cashier: user.displayName,
            created_at: new Date().toJSON(),
            warehouse_id: warehouse?.id,
            payment_method: paymentData.payment_method || paymentData.paymentType,
            payment_number: paymentData.transNumber || paymentData.payment_number || null,
            payment_reference: paymentData.payment_transaction_ref || null,
            payment_transaction_ref: paymentData.payment_transaction_ref || null,
            payment_type: String(paymentData.paymentType || '').toLowerCase() === 'momo' || paymentData.payment_method === 'momo' ? 2 : 1,
            amount_tendered: paymentData.amount_tendered ?? null,
            change_amount: paymentData.change_amount ?? null,
            company: {
                name: (user as any)?.company?.name || (user as any)?.companyName || 'Shopynn',
                organization: (user as any)?.company?.organization || '',
                address: (user as any)?.company?.address || '',
                phone: (user as any)?.company?.phone || '',
            }
        }

        const pendingRecord = {
            id,
            created_at: nowIso,
            attempts: 0,
            last_attempt_at: null,
            last_error_code: null,
            last_error_message: null,
            payload
        };

        const customerRow = customer ? customers_data.find((c: { name?: string }) => c.name === customer) : null;
        const printerType = normalizeWarehousePrinterType(
            (warehouseRecordForPrinting as { printer_type?: string } | null)?.printer_type
        );

        const openInvoiceShare = (saleId?: string, opts?: { autoPrintThermal?: boolean }) => {
            setInvoiceShare({
                open: true,
                saleId,
                autoPrintThermal: Boolean(opts?.autoPrintThermal),
                order: {
                    ...payload,
                    id: saleId,
                    customer_email: (customerRow as { email?: string })?.email || '',
                    customer_phone: (customerRow as { phone?: string })?.phone || '',
                    warehouse: warehouse?.name || '',
                    payment_type:
                        String(paymentData.paymentType || '').toLowerCase() === 'momo' ||
                        paymentData.payment_method === 'momo'
                            ? 2
                            : 1
                }
            });
        };

        /** After sale is saved: open invoice share; thermal auto-prints inside the dialog. */
        const afterSaleSaved = (saleId?: string) => {
            openInvoiceShare(saleId, { autoPrintThermal: printerType === 'thermal' });
            if (printerType === 'a4' && isMobile) {
                toast(
                    'A4 invoice preview and print are available on a desktop browser. Open New Sale there to print this receipt. Your sale is complete.',
                    { duration: 6000 }
                );
            }
        };

        //check if internet available, post
        if(navigator.onLine) {
            setProcessing(true)
            createSale(payload)
                .then((res)=> {
                    if ('error' in res && res.error) {
                        const err = res.error as any;
                        const message = getSaleApiErrorMessage(err);
                        if (isPriceMismatchError(err) || String(message).toLowerCase().includes('mismatch')) {
                            toast.error(message);
                            return;
                        }
                        dispatch(addItem({
                            ...pendingRecord,
                            attempts: 1,
                            last_attempt_at: nowIso,
                            last_error_code: getErrorCode(err) || null,
                            last_error_message: message || null
                        }));
                        toast.error(message || 'Sale could not be uploaded. Saved to pending sales.');
                        afterSaleSaved();
                        return;
                    }
                    if(res.data) {
                        toast.success('Sale uploaded successfully.')
                        const saleId = (res.data as { id?: string })?.id;
                        afterSaleSaved(saleId);
                    }
                    else {
                        dispatch(addItem(pendingRecord));
                        toast.success('Record saved in pending sales.');
                        afterSaleSaved();
                    }

                    refetch()
                })
                .catch(err=> {
                    const message = getSaleApiErrorMessage(err);
                    if (isPriceMismatchError(err) || String(message).toLowerCase().includes('mismatch')) {
                        toast.error(message);
                        return;
                    }
                    dispatch(addItem({
                        ...pendingRecord,
                        attempts: 1,
                        last_attempt_at: nowIso,
                        last_error_code: getErrorCode(err) || null,
                        last_error_message: message || null
                    }));
                    toast.error(message || 'Sale could not be uploaded. Saved to pending sales.');
                    afterSaleSaved();
                })
                .finally(()=> setProcessing(false))
        }
        else {
            dispatch(addItem(pendingRecord));
            toast.success('Record saved in pending sales.');
            afterSaleSaved();
        }

        updateLocalProductsQuantity(currentOrder)
        
        setCustomer(null);
        setCurrentOrder([]);
        setCartFilterText('');
    }

    const handleRefreshProducts = async () => {
        setProcessing(true); 
        const promise = store.store.dispatch(ECommerceApi.endpoints.getECommerceProductsWithPagination.initiate({pageType:'pos'},{forceRefetch:true}));
        const { data } = await promise;    
            
        if (Array.isArray(data)) {
            __setProducts(data);
            localStorage.setItem(_PRODUCTS_, JSON.stringify(data));
            toast.success(
                data.length ? 'Products data refreshed.' : 'Product list is empty.'
            );
        }
        setProcessing(false);
    }

    const handleRefreshCategories = () => void refreshCategories({ notify: true, blocking: true });

    const handleRefreshCustomers = () => void refreshCustomers({ notify: true, blocking: true });

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
            {processing && (
                <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
                    <FuseLoading />
                </div>
            )}
			<div className="w-full h-full flex flex-1 p-4 space-x-4">
            {/* <div className="flex flex-1 w-full h-full justify-between space-y-2 sm:space-y-0 py-6 sm:py-8 md:p-8"> */}
                <Paper className="w-5/7 h-full flex flex-col flex-1 p-4 overflow-x-auto" style={{backgroundColor:'#fefefe'}}>
                    <div className='flex w-full pb-2 items-center gap-3 justify-between'>
                        <Autocomplete
                            className="min-w-0 flex-1"
                            fullWidth
                            freeSolo
                            options={buyers}
                            value={customer as string}
                            onChange={(event, newValue) => {
                                setCustomer(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Search customers..."
                                    label="Customer"
                                    variant="outlined"
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-input": {
                                            height: 5,
                                        },
                                    }}
                                />
                            )}
                        />

                        {hasPermissionCodes(user, 'stores.multi_access') && (
                            <Autocomplete
                                disabled={currentOrder.length > 0}
                                className="min-w-0 flex-1"
                                fullWidth
                                options={warehouses || []}
                                value={warehouse}
                                getOptionLabel={(option: any) => option?.name || ''}
                                onChange={(event, newValue) => {
                                    setWarehouse(newValue)
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Select store"
                                        label="Store"
                                        variant="outlined"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{
                                            "& .MuiOutlinedInput-input": {
                                                height: 5,
                                            },
                                        }}
                                    />
                                )}
                            />
                        )}
                    </div>

                    <div className="mb-1 flex w-full items-center gap-2">
                        <Paper
                            elevation={0}
                            className="flex min-w-0 flex-1 items-center rounded-lg px-2"
                            sx={{
                                height: 36,
                                minHeight: 36,
                                maxHeight: 36,
                                boxSizing: 'border-box',
                                border: 1,
                                borderColor: 'divider',
                                boxShadow: 'none',
                                overflow: 'hidden'
                            }}
                        >
                            <FuseSvgIcon
                                size={18}
                                className="mx-1.5 shrink-0"
                                color="action"
                            >
                                heroicons-outline:magnifying-glass
                            </FuseSvgIcon>
                            <Input
                                placeholder="Search name, SKU, or code..."
                                disableUnderline
                                fullWidth
                                autoFocus
                                value={filterText}
                                onChange={(event) => {
                                    setFilterText(event.target.value);
                                }}
                                inputProps={{
                                    'aria-label': 'Search products'
                                }}
                                sx={{
                                    height: 36,
                                    fontSize: 14,
                                    '& .MuiInput-input': {
                                        py: 0,
                                        height: 36,
                                        boxSizing: 'border-box'
                                    }
                                }}
                            />
                            <Tooltip
                                title={
                                    !voiceSearch.supported
                                        ? 'Voice search not supported in this browser'
                                        : voiceSearch.listening
                                            ? 'Listening… tap to stop'
                                            : 'Search by voice (product name or code)'
                                }
                            >
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={voiceSearch.toggle}
                                        disabled={!voiceSearch.supported}
                                        aria-label={voiceSearch.listening ? 'Stop voice search' : 'Voice search'}
                                        sx={{
                                            color: voiceSearch.listening ? 'error.main' : 'action.active',
                                            width: 28,
                                            height: 28,
                                            p: 0.25
                                        }}
                                    >
                                        <FuseSvgIcon size={18}>
                                            {voiceSearch.listening
                                                ? 'heroicons-solid:stop'
                                                : 'heroicons-outline:microphone'}
                                        </FuseSvgIcon>
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Paper>
                        <div className="flex shrink-0 items-center gap-0.5">
                            <Tooltip title="Refresh products" placement="top">
                                <IconButton
                                    size="small"
                                    onClick={handleRefreshProducts}
                                    aria-label="Refresh products"
                                    sx={{
                                        color: 'text.secondary',
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        width: 36,
                                        height: 36,
                                        minWidth: 36,
                                        minHeight: 36,
                                        p: 0,
                                        boxSizing: 'border-box',
                                        '&:hover': { bgcolor: 'action.hover', borderColor: 'action.disabled' }
                                    }}
                                >
                                    <FuseSvgIcon size={18}>heroicons-outline:cube</FuseSvgIcon>
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Refresh customers" placement="top">
                                <IconButton
                                    size="small"
                                    onClick={handleRefreshCustomers}
                                    aria-label="Refresh customers"
                                    sx={{
                                        color: 'text.secondary',
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        width: 36,
                                        height: 36,
                                        minWidth: 36,
                                        minHeight: 36,
                                        p: 0,
                                        boxSizing: 'border-box',
                                        '&:hover': { bgcolor: 'action.hover', borderColor: 'action.disabled' }
                                    }}
                                >
                                    <FuseSvgIcon size={18}>heroicons-outline:user-group</FuseSvgIcon>
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Refresh categories" placement="top">
                                <IconButton
                                    size="small"
                                    onClick={handleRefreshCategories}
                                    aria-label="Refresh categories"
                                    sx={{
                                        color: 'text.secondary',
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        width: 36,
                                        height: 36,
                                        minWidth: 36,
                                        minHeight: 36,
                                        p: 0,
                                        boxSizing: 'border-box',
                                        '&:hover': { bgcolor: 'action.hover', borderColor: 'action.disabled' }
                                    }}
                                >
                                    <FuseSvgIcon size={18}>heroicons-outline:tag</FuseSvgIcon>
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>

                    {categories?.length > 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                width: '100%',
                                overflowX: 'auto',
                                py: 1.25,
                                mt: 0.5,
                                scrollbarWidth: 'thin',
                                '&::-webkit-scrollbar': { height: 6 },
                                '&::-webkit-scrollbar-thumb': {
                                    borderRadius: 3,
                                    bgcolor: 'divider'
                                }
                            }}
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ flexShrink: 0, fontWeight: 600, letterSpacing: '0.02em', pr: 0.5 }}
                            >
                                Categories
                            </Typography>
                            <Chip
                                label="All"
                                size="small"
                                onClick={() => setCategory({ id: 0, name: '' })}
                                color={category?.id === 0 ? 'primary' : 'default'}
                                variant={category?.id === 0 ? 'filled' : 'outlined'}
                                sx={{
                                    flexShrink: 0,
                                    fontWeight: category?.id === 0 ? 700 : 500,
                                    borderColor: 'divider'
                                }}
                            />
                            {categories.map((info, i) => (
                                <Chip
                                    key={info.id ?? `cat-${i}`}
                                    label={info.name}
                                    size="small"
                                    onClick={() => handleChangeCategory(info)}
                                    color={info.name === category?.name ? 'primary' : 'default'}
                                    variant={info.name === category?.name ? 'filled' : 'outlined'}
                                    sx={{
                                        flexShrink: 0,
                                        fontWeight: info.name === category?.name ? 700 : 500,
                                        borderColor: 'divider'
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    <Typography className="text-sm tracking-tight my-2">
                        Products (
                        {isLoading
                            ? '…'
                            : filteredProducts.length === productsTotalCount
                                ? filteredProducts.length
                                : `${filteredProducts.length} / ${productsTotalCount}`}
                        )
                    </Typography>

                    <Paper
                        className="w-full p-2 mt-1 overflow-y-auto"
                        style={{ height: '62vh' }}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'repeat(2, minmax(0, 1fr))',
                                sm: 'repeat(3, minmax(0, 1fr))',
                                md: 'repeat(4, minmax(0, 1fr))',
                                lg: 'repeat(5, minmax(0, 1fr))',
                                xl: 'repeat(6, minmax(0, 1fr))',
                            },
                            gap: 1,
                            alignContent: 'start',
                            bgcolor: 'background.paper',
                        }}
                    >
                        {filteredProducts.map((product, i) => (
                            <Box
                                key={product.id ?? i}
                                onClick={() => handleAddOrder(product)}
                                sx={(theme) => ({
                                    p: 1,
                                    cursor: 'pointer',
                                    borderRadius: 1.5,
                                    border: `1px solid ${theme.palette.divider}`,
                                    backgroundColor: theme.palette.background.default,
                                    transition: 'all .16s ease',
                                    '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        boxShadow: `0 6px 18px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.08)'}`,
                                        transform: 'translateY(-1px)',
                                    },
                                })}
                            >
                                <Box
                                    component="img"
                                    src={
                                        product.thumbnail
                                            ? `${URLS.serverUrl}/images?id=${product.thumbnail}`
                                            : '/assets/images/apps/ecommerce/product-image-placeholder.png'
                                    }
                                    alt={product.name || 'product'}
                                    sx={{
                                        width: '100%',
                                        height: { xs: 72, sm: 82, md: 90 },
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                    }}
                                />

                                <Typography
                                    variant="body2"
                                    sx={{
                                        mt: 0.8,
                                        lineHeight: 1.25,
                                        minHeight: 34,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {product.name}
                                </Typography>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        Qty: {getPosProductDisplayQty(product, resolvedWarehouseId)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        ₵ {Number(product.unit_price).toFixed(2)}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75 }}>
                                    <Box
                                        sx={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 999,
                                            backgroundColor: 'primary.main',
                                            color: 'primary.contrastText',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        +
                                    </Box>
                                </Box>
                            </Box>
                        ))}

                        {!isLoading && filteredProducts.length === 0 && (
                            <Box
                                className="col-span-full flex min-h-[min(280px,40vh)] flex-col items-center justify-center gap-1 px-6 py-10 text-center"
                                sx={(theme) => ({
                                    border: `1px dashed ${theme.palette.divider}`,
                                    borderRadius: 2,
                                    bgcolor: theme.palette.mode === 'dark' ? 'action.hover' : 'grey.50'
                                })}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 52,
                                        height: 52,
                                        borderRadius: 2,
                                        mb: 1,
                                        bgcolor: 'action.selected',
                                        color: 'text.secondary'
                                    }}
                                >
                                    <FuseSvgIcon size={26}>
                                        {filterText.trim()
                                            ? 'heroicons-outline:magnifying-glass'
                                            : 'heroicons-outline:cube'}
                                    </FuseSvgIcon>
                                </Box>
                                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                                    {filterText.trim() ? 'No matching products' : 'No products here'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>
                                    {filterText.trim()
                                        ? 'Adjust your search or clear the box to see products in this category.'
                                        : 'Pick another category, or use the refresh button above to reload the catalog.'}
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Paper>
                <Paper className="w-2/7 h-full p-3 flex flex-col" style={{backgroundColor:'#fff'}}>
                    <div className='flex justify-between items-center gap-2'>
                        <h1 className='text-xl shrink-0'><b>Current Order</b></h1>
                        <FuseSvgIcon
                            className="cursor-pointer shrink-0"
                            color="action"
                            onClick={openHeldItems}
                        >
                            heroicons-outline:adjustments-horizontal
                        </FuseSvgIcon>
                    </div>

                    <div className='flex items-center py-2'>
                        <img 
                            src='https://img.favpng.com/17/24/10/computer-icons-user-profile-male-avatar-png-favpng-jhVtWQQbMdbcNCahLZztCF5wk.jpg'
                            style={{width:40,height:40,borderRadius:40}}
                        />
                        <span className="ml-2">{customer || 'Walk In'}</span>
                    </div>

                    <Paper className="flex h-9 w-full items-center rounded-md shadow-none border border-solid mb-1 px-1.5" sx={{ borderColor: 'divider' }}>
                        <FuseSvgIcon size={16} color="action" className="mx-1 shrink-0">
                            heroicons-outline:magnifying-glass
                        </FuseSvgIcon>
                        <Input
                            placeholder="Filter cart…"
                            disableUnderline
                            fullWidth
                            value={cartFilterText}
                            onChange={(event) => setCartFilterText(event.target.value)}
                            inputProps={{ 'aria-label': 'Filter current order' }}
                            sx={{ fontSize: 13 }}
                        />
                        {cartFilterText ? (
                            <IconButton
                                size="small"
                                aria-label="Clear cart filter"
                                onClick={() => setCartFilterText('')}
                            >
                                <FuseSvgIcon size={14}>heroicons-outline:x-mark</FuseSvgIcon>
                            </IconButton>
                        ) : null}
                    </Paper>

                    <div ref={contentRef} className='grow-1 flex flex-col'>
                        <div className='grow-1 overflow-y-auto' style={{height:'200px'}}>
                            {filteredCurrentOrder?.map((product,i)=> (
                                <div className='flex mb-3 items-center py-2 pr-2' key={product.id ?? i}>
                                    <span
                                        className='cursor-pointer' 
                                        onClick={()=> {
                                            const co = currentOrder?.length > 0 ? currentOrder?.filter(o=> o.id != product.id) : [];
                                            setCurrentOrder(co);
                                        }}>
                                        <FuseSvgIcon size={16}>heroicons-outline:trash</FuseSvgIcon>
                                    </span>
                                    {
                                        product.thumbnail ? (
                                        <img
                                            src={`${URLS.serverUrl}/images?id=${product.thumbnail}`}
                                            style={{width:40,height:40,borderRadius:3}}
                                        />
                                    ) : (
                                        <img
                                            src="/assets/images/apps/ecommerce/product-image-placeholder.png"
                                            style={{width:40,height:40,borderRadius:3}}
                                        />
                                    )}
                                    <div className='ml-2 flex-1'>
                                        <p className='mb-1'>{product.name}</p>
                                        <span className='text-sm' >x{product.order_quantity} (₵{resolveSaleUnitPrice(product.order_quantity, product.unit_price, product.alt_price, bulkDiscount)}</span>)
                                        <div className='flex flex-1 justify-between items-center'>
                                            <span><b>₵ {Number(calcLineTotal(product.order_quantity, product.unit_price, product.alt_price, bulkDiscount)).toFixed(2)}</b></span>
                                            <div className='flex justify-between items-center'>
                                                <input 
                                                    value={product.order_quantity}
                                                    type='number' 
                                                    style={{width:60,height:25,borderWidth:1,paddingLeft:5,borderColor:'#ccc',borderRadius:3}}
                                                    onChange={(e)=> {
                                                        const val = e.target.value;                                                                                                        
                                                        if(val.length < 9) {
                                                            if(/^\d+$/.test(val)) {
                                                                const co = currentOrder.map(p=> {
                                                                    if(p.id == product.id) {
                                                                        if(Number(val) > product.quantity_available) {
                                                                            product.order_quantity = '';
                                                                            toast.error(`You cannot sell more than available quantity: ${product.quantity_available}`)
                                                                        }                                                               
                                                                        else {
                                                                            product.order_quantity = Number(val);
                                                                        }
                                                                    }
                                                                    return p;
                                                                })
                                                                    
                                                                setCurrentOrder(co);
                                                            }
                                                            else {
                                                                const co = currentOrder.map(p=> {
                                                                    if(p.id == product.id) {
                                                                        product.order_quantity = '';
                                                                    }
                                                                    return p;
                                                                })
                                                                    
                                                                setCurrentOrder(co);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {currentOrder.length > 0 && filteredCurrentOrder.length === 0 && (
                                <Typography variant="body2" color="text.secondary" className="px-1 py-4 text-center">
                                    No cart lines match “{cartFilterText.trim()}”.
                                </Typography>
                            )}
                        </div>
                        <div className='p-4 my-2' style={{backgroundColor:'#eee',borderRadius:4}}>
                            <div className='flex justify-between mb-2'>
                                <p>Subtotal</p>
                                {/* <p>₵ {Number(currentOrder?.reduce((pr,c)=> pr + (c.order_quantity < 10 ? (c.order_quantity*c.unit_price) : (c.order_quantity*c.alt_price)), 0)).toFixed(2)}</p> */}
                                <p>₵ {Number(currentOrder?.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)).toFixed(2)}</p>
                            </div>
                            <div className='flex justify-between mb-2'>
                                <p>Discount</p>
                                <p>₵ {Number(currentOrder?.reduce((pr,c)=> pr + lineDiscountAmount(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount), 0)).toFixed(2)}</p>
                            </div>
                            <div className='flex justify-between mb-2'>
                                <p>Items</p>
                                <p>{currentOrder.length}</p>
                            </div>
                            <hr className='mb-2'/>
                            <div className='flex justify-between'>
                                <p>Total</p>
                                <p>₵ {Number(currentOrder?.reduce((pr,c)=> pr + calcLineTotal(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount), 0)).toFixed(2)}</p>
                            </div>
                        </div>
                        <Button
                            className="my-2"
                            variant="contained"
                            color="secondary"
                            disabled={currentOrder.length == 0}
                            // component={NavLinkAdapter}
                            // to="/setups/locations/new"
                            onClick={()=> {
                                for (const prod of currentOrder) {                                    
                                    if (!prod.order_quantity) { 
                                        toast.error(`No quantity set for: ${prod.name}`)
                                        break;
                                    }

                                    setOpenPayment(true);
                                }
                            }}
                            size={isMobile ? 'small' : 'medium'}
                        >
                            {/* <FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon> */}
                            <span className="mx-1 sm:mx-2">Proceed</span>
                        </Button>
                        <div className='flex justify-between mx-1'>
                            <button disabled={currentOrder.length == 0} onClick={()=> setOpenConfirm(true)} className='text-sm cursor-pointer'>Hold</button>
                            {/* <button disabled={currentOrder.length == 0} onClick={cancelTransaction} className='text-sm flex flex-1 justify-center cursor-pointer'><span>Cancel</span></button>
                            <button disabled={currentOrder.length == 0} className='text-sm flex flex-1 justify-end cursor-pointer'><span>Pro-Invoice</span></button> */}
                            <button disabled={currentOrder.length == 0} onClick={cancelTransaction} className='text-sm cursor-pointer'><span>Cancel</span></button>
                        </div>
                    </div>
                </Paper>
                <SelectHeldSale
                    id="ringtone-menu"
                    keepMounted
                    open={openHeld}
                    onClose={handleClose}
                    value={selectedValue}
                    onHoldSelect={onHoldSelect}
                />

                <ConfirmDialog
                    open={openConfirm}
                    handleClose={(c)=> {
                        if(c) {handleAddToHold()}

                        setOpenConfirm(false);
                    }}
                    leftText='No'
                    message='Do you want to hold this sale for later use?'
                    rightText='Yes'
                    title='Confirm Hold'
                />

                <PaymentDialog
                    open={openPayment}
                    saleTotal={
                        currentOrder?.reduce(
                            (pr, c) => pr + calcLineTotal(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount),
                            0
                        ) || 0
                    }
                    printerType={(warehouseRecordForPrinting as { printer_type?: string } | null)?.printer_type}
                    resumeMomo={resumeMomo}
                    getCartSnapshot={(): PosCartSnapshot | null => {
                        if (!currentOrder?.length) return null;
                        return {
                            warehouse_id: warehouse?.id || null,
                            warehouse_name: warehouse?.name || null,
                            customer_id: customer
                                ? customers_data.find((c: { name?: string }) => c.name === customer)?.id || null
                                : null,
                            customer_name: customer || null,
                            products: currentOrder.map((o: any) => ({ ...o })),
                            bulk_discount: bulkDiscount
                        };
                    }}
                    handleClose={(response)=> { 
                        if (response && (response as { parked?: boolean }).parked) {
                            setCustomer(null);
                            setCurrentOrder([]);
                            setCartFilterText('');
                            setResumeMomo(null);
                            toast.success('MoMo payment parked. Serve the next customer — finish later from Pending MoMo.');
                        } else if(response) {
                            handleMakeNewSale(response)
                            setResumeMomo(null);
                        } else {
                            setResumeMomo(null);
                        }
                        setOpenPayment(false)
                    }}
                />

                <A4ReceiptPreviewDialog
                    open={a4ReceiptPreview.open}
                    onClose={() => setA4ReceiptPreview({ open: false, payload: null })}
                    payload={a4ReceiptPreview.payload}
                    storeName={(warehouseRecordForPrinting as { name?: string } | null)?.name}
                />

                <SaleInvoiceDialog
                    open={invoiceShare.open}
                    onClose={() => setInvoiceShare({ open: false, order: null })}
                    order={invoiceShare.order}
                    saleId={invoiceShare.saleId}
                    autoPrintThermal={invoiceShare.autoPrintThermal}
                    printerType={(warehouseRecordForPrinting as { printer_type?: string } | null)?.printer_type}
                />
			</div>
		</>
	);
}

export default NewSale;