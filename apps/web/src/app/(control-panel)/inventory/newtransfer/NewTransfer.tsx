'use client';

import { Box, Button, Chip, Input, Paper, Stack, TextField } from '@mui/material';
import { alpha } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import Autocomplete from '@mui/material/Autocomplete';
import { useMemo, useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useThemeMediaQuery } from '@fuse/hooks';
import ConfirmDialog from './ConfirmDialog';
import Typography from '@mui/material/Typography';

import { useGetProductCategoriesQuery, useGetECommerceProductsQuery, useCreateTransferMutation } from '../../inventory/ECommerceApi';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import toast from 'react-hot-toast';
import { URLS } from '@/configs/settingsConfig';
// import { useGetSuppliersQuery } from '../../setups/suppliers/SupplierApi';

/**
 * The new transfer page.
 */
function NewTransfer() {
    const [createTransfer] = useCreateTransferMutation();
    const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const [openConfirm, setOpenConfirm] = useState(false);
    const { data: categories } = useGetProductCategoriesQuery(null, {refetchOnMountOrArgChange:true});
    // const { data: suppliers } = useGetSuppliersQuery(null, {refetchOnMountOrArgChange:true});
    const { data: warehouses } = useGetWarehousesQuery(null, {refetchOnMountOrArgChange:true});
    const { data: products, isLoading } = useGetECommerceProductsQuery(null, {refetchOnMountOrArgChange:true});
    const [filterText, setFilterText] = useState('');
    /** `null` = all categories. Products from API use `category_names` (labels) and `categories` (ids). */
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
    const [currentOrder, setCurrentOrder] = useState([]);
    const [supplier, setSupplier] = useState(null);
    const [warehouse, setWarehouse] = useState(null);
    const [discount, setDiscount] = useState('');
    const [invoice, setInvoice] = useState('');
    const [totalQuantity, setTotalQuantity] = useState(0);
	const [processing, setProcessing] = useState(false);
    const [note, setNote] = useState("");

    const [fromSource, setFromSource] = useState(null);
    const [toDestination, setToDestination] = useState(null);

    const categoryList = useMemo(() => {
        const raw = categories;
        if (!Array.isArray(raw)) return [];
        const rows = raw
            .map((row: { id?: string; name?: string }) => ({
                id: row?.id != null ? String(row.id) : '',
                name: row?.name != null ? String(row.name).trim() : ''
            }))
            .filter((row) => row.name.length > 0);
        const seen = new Set<string>();
        const deduped: { id: string; name: string }[] = [];
        for (const row of rows) {
            const key = row.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(row);
        }
        deduped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        return deduped;
    }, [categories]);

    function productMatchesCategory(
        prod: { categories?: unknown; category_names?: unknown },
        selected: { id: string; name: string } | null
    ) {
        if (!selected?.name) return true;
        const needle = selected.name.trim().toLowerCase();
        const idNeedle = selected.id?.trim();

        const names = prod.category_names;
        if (Array.isArray(names) && names.length > 0) {
            return names.some((n) => String(n).trim().toLowerCase() === needle);
        }

        const cats = prod.categories;
        if (!Array.isArray(cats) || cats.length === 0) return false;
        if (idNeedle && cats.some((c) => String(c) === idNeedle)) return true;
        return cats.some((c) => String(c).trim().toLowerCase() === needle);
    }

    function productMatchesSearch(prod: { name?: string }, text: string) {
        const t = text?.trim().toLowerCase();
        if (!t) return true;
        return (prod.name || '').toLowerCase().includes(t);
    }

    const filteredProducts =
        products
            ?.filter((p) => productMatchesCategory(p, selectedCategory))
            .filter((p) => productMatchesSearch(p, filterText)) ?? [];

    const handleAddOrder = (prod) => {
        if(!fromSource) {
            toast.error("Please select source store/warehouse")
            return;
        }
        const y = currentOrder?.find(c=> c.id == prod.id);

        console.log('[prod',prod);
        if(prod.stores_quantities) {
            const fn = prod.stores_quantities.find(sq=> sq.warehouse_id == fromSource.id);
            if(fn) {
                console.log('fn found',fn);
                if(fn.quantity_available) {
                    if(!y) {
                        const x = currentOrder?.map(o=> o);
                        x.unshift({...prod,order_quantity:1,quantity_available: fn.quantity_available})
                        // console.log('x',x);
                        setCurrentOrder(x);
                        setTotalQuantity((prev)=> prev + 1);
                    }
                }
                else {
                    toast.error('Quantity is 0')
                }
            }
            else {
                toast.error("This store does not have any inventory")
            }
        }
        return
        if(!y) {
            const x = currentOrder?.map(o=> o);
            x.unshift({...prod,order_quantity:1})
            // console.log('x',x);
            setCurrentOrder(x);
            setTotalQuantity((prev)=> prev + 1);
        }
    }

    const handleSaveTransfer = () => {
        const payload = {
            note,
            // number_of_items: totalQuantity,
            // invoice_number: invoice,
            source_warehouse_id: fromSource.id,
            destination_warehouse_id: toDestination.id,
            products: currentOrder.map(o=> ({id: o.id, quantity: Number(o.order_quantity)}))
        }

        console.log('pl',payload);

        // return;
        setProcessing(true);
        createTransfer(payload)
            .then(res=> {
                // console.log('np then res',res);
                if(res.data?.status === 409) {
                    toast.error(`Error: Invoice number #${invoice} already exists. Please check and try again.`)
                }
                else if(res.data?.status === 201) {
                    setFromSource(null);
                    setToDestination(null);
                    setInvoice('')
                    setCurrentOrder([]);
                    setNote('');
                    // setTotalQuantity(0);
                    toast.success('New transfer saved successfully.');
                }
                else if(res.error) {
                    toast.error('An error occurred. Check if you are authorized to receive inventory.')
                }
                else {
                    toast.error('Something went wrong. Please try again or contact admin.')
                }
            })
            .catch(err=> {
                // console.log('err',err);
                toast.error('An error occurred. Please try again or report to admin.')
            })
            .finally(()=> {                
                setProcessing(false)
            })
    }

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-1 p-4 space-x-4">
                {processing && (
                    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
                        <FuseLoading />
                    </div>
                )}
                <Paper className="w-5/7 h-full flex flex-col flex-1 p-4 overflow-x-auto" style={{backgroundColor:'#fefefe'}}>
                    <div className='flex w-full pb-2 justify-between'>
                        <Autocomplete
                            className="w-1/3"
                            // fullWidth
                            // multiple
                            freeSolo
                            options={warehouses?.filter(w=> (w.id != toDestination?.id))}
                            getOptionLabel={(option: any)=> option.name}
                            // value={supplier as string}
                            onChange={(event, newValue) => {
                                setFromSource(newValue)
                                // onChange(newValue);
                                // setSupplier(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Select source"
                                    label="Source"
                                    variant="outlined"
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                />
                            )}
                        />

                        <Autocomplete
                            className="w-1/3 ml-2"
                            // fullWidth
                            // multiple
                            freeSolo
                            options={warehouses?.filter(w=> (w.id != fromSource?.id))}
                            getOptionLabel={(option: any)=> option.name}
                            onChange={(event, newValue) => {
                                setToDestination(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Select destination"
                                    label="Destination"
                                    variant="outlined"
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                />
                            )}
                        />

                        {/* <TextField
                            // {...params}
                            className='w-1/3'
                            placeholder="Enter ref no."
                            label="Reference no."
                            variant="outlined"
                            value={invoice}
                            InputLabelProps={{
                                shrink: true
                            }}
                            onChange={(ev)=> {
                                if(ev.target.value.length < 31) {
                                    setInvoice(ev.target.value);
                                }
                            }}
                            InputProps={{
                                style: {height:51}
                            }}
                        /> */}

                        {/* <Paper className="flex h-11 w-1/3 items-center rounded-lg shadow-sm">
                            <Input
                                placeholder="Search..."
                                disableUnderline
                                fullWidth
                                onChange={(event)=> {
                                    setFilterText(event.target.value)
                                }}
                                inputProps={{
                                    'aria-label': 'Search'
                                }}
                            />
                            <FuseSvgIcon
                                className="mx-3"
                                color="action"
                            >
                                heroicons-outline:magnifying-glass
                            </FuseSvgIcon>
                        </Paper> */}
                    </div>

                    <div className='flex w-full pb-2 justify-end mb-2' style={{borderBottom:'1px solid #ccc'}}>
                        <div className='w-2/3 mr-4'/>
                        <Paper className="flex h-11 w-1/3 items-center rounded-lg shadow-sm">
                            <Input
                                placeholder="Search..."
                                disableUnderline
                                fullWidth
                                onChange={(event)=> {
                                    setFilterText(event.target.value)
                                }}
                                inputProps={{
                                    'aria-label': 'Search'
                                }}
                            />
                            <FuseSvgIcon
                                className="mx-3"
                                color="action"
                            >
                                heroicons-outline:magnifying-glass
                            </FuseSvgIcon>
                        </Paper>
                    </div>

                    {/* <TextField
                        // {...params}
                        className='w-1/3 my-1'
                        placeholder="Invoice no."
                        label="Invoice"
                        variant="outlined"
                        value={invoice}
                        InputLabelProps={{
                            shrink: true
                        }}
                        onChange={(ev)=> {
                            console.log('ev',ev.target.value);
                            if(ev.target.value.length < 31) {
                                setInvoice(ev.target.value);
                            }
                        }}
                        style={{height:50}}
                    /> */}

                    {categoryList.length > 0 && (
                        <Stack
                            direction="row"
                            spacing={1}
                            className="mt-2"
                            sx={{
                                overflowX: 'auto',
                                flexWrap: 'nowrap',
                                py: 0.5,
                                mx: -0.5,
                                px: 0.5,
                                '::-webkit-scrollbar': { height: 6 },
                                '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'action.disabled' }
                            }}
                        >
                            <Chip
                                label="All"
                                onClick={() => setSelectedCategory(null)}
                                color={selectedCategory === null ? 'secondary' : 'default'}
                                variant={selectedCategory === null ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 600, flexShrink: 0 }}
                            />
                            {categoryList.map((cat) => (
                                <Chip
                                    key={cat.id || cat.name}
                                    label={cat.name}
                                    onClick={() => setSelectedCategory({ id: cat.id, name: cat.name })}
                                    color={selectedCategory?.name === cat.name ? 'secondary' : 'default'}
                                    variant={selectedCategory?.name === cat.name ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: 600, flexShrink: 0 }}
                                />
                            ))}
                        </Stack>
                    )}

                    <Typography className="text-sm tracking-tight my-2">
                        Products ({isLoading ? '…' : filteredProducts.length}
                        {!isLoading && products?.length != null && products.length !== filteredProducts.length
                            ? ` of ${products.length}`
                            : ''}
                        )
                    </Typography>

                    <Paper
                        className="w-full grid grid-cols-5 gap-4 p-3 overflow-x-auto"
                        sx={{ minHeight: '53vh', alignContent: filteredProducts.length === 0 && !isLoading ? 'stretch' : undefined }}
                        style={{ height: '53vh' }}
                    >
                        {filteredProducts.map((product, i) => (
                            <div
                                key={product.id ?? i}
                                onClick={() => handleAddOrder(product)}
                                className="p-2 cursor-pointer"
                                style={{ backgroundColor: '#fff', borderRadius: 5, height: 'fit-content' }}
                            >
                                {product.thumbnail ? (
                                    <img
                                        src={`${URLS.serverUrl}/images?id=${product.thumbnail}`}
                                        alt=""
                                        className="w-full"
                                        style={{ height: 90 }}
                                    />
                                ) : (
                                    <img
                                        src="/assets/images/apps/ecommerce/product-image-placeholder.png"
                                        alt=""
                                        className="w-full"
                                        style={{ height: 90 }}
                                    />
                                )}

                                <p className="my-2 line-clamp-2">{product.name}</p>

                                <div className="flex flex-1 justify-between items-center">
                                    <span className="text-sm">
                                        <b>₵ {Number(product.unit_price).toFixed(2)}</b>
                                    </span>
                                    <span
                                        className="flex justify-center items-center"
                                        style={{ width: 20, height: 20, borderRadius: 20, backgroundColor: '#000', color: '#fff' }}
                                    >
                                        +
                                    </span>
                                </div>
                            </div>
                        ))}

                        {!isLoading && filteredProducts.length === 0 && (() => {
                            const hasSearch = Boolean(filterText?.trim());
                            const hasCategory = selectedCategory != null;
                            const noCatalog = !products?.length;

                            const icon = hasSearch
                                ? 'heroicons-outline:magnifying-glass'
                                : noCatalog
                                    ? 'heroicons-outline:inbox'
                                    : 'heroicons-outline:squares-2x2';

                            const title = hasSearch
                                ? 'No matching products'
                                : noCatalog
                                    ? 'No products yet'
                                    : hasCategory
                                        ? 'No products in this category'
                                        : 'Nothing to show';

                            const subtitle = hasSearch
                                ? `Nothing matches “${filterText.trim()}”. Try a different search or clear the box.`
                                : noCatalog
                                    ? 'Add products in Inventory first, then they will appear here for transfer.'
                                    : hasCategory
                                        ? `There are no items in “${selectedCategory.name}”. Choose All or another category above.`
                                        : 'Adjust search or category filters to see products.';

                            return (
                                <Box
                                    sx={{
                                        gridColumn: '1 / -1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        py: 6,
                                        px: 2,
                                        minHeight: 280
                                    }}
                                >
                                    <Box
                                        sx={{
                                            maxWidth: 420,
                                            width: '100%',
                                            textAlign: 'center',
                                            py: 4,
                                            px: 3,
                                            borderRadius: 3,
                                            border: '2px dashed',
                                            borderColor: 'divider',
                                            bgcolor: (theme) =>
                                                alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.04)
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                mx: 'auto',
                                                mb: 2,
                                                width: 56,
                                                height: 56,
                                                borderRadius: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                                                color: 'primary.main'
                                            }}
                                        >
                                            <FuseSvgIcon size={28}>{icon}</FuseSvgIcon>
                                        </Box>
                                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                            {title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {subtitle}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </Paper>
                </Paper>
                <Paper className="w-2/7 h-full p-3 flex flex-col" style={{backgroundColor:'#fff'}}>
                    <div className='flex justify-between'>
                        <h1 className='text-xl'><b>Selected Items</b></h1>
                        {/* <FuseSvgIcon
                            className="mx-3 cursor-pointer"
                            color="action"
                            onClick={openHeldItems}
                        >
                            heroicons-outline:adjustments-horizontal
                        </FuseSvgIcon> */}
                    </div>
                    
                    {/* <div className='flex items-center py-2'>
                        <img 
                            src='https://img.favpng.com/17/24/10/computer-icons-user-profile-male-avatar-png-favpng-jhVtWQQbMdbcNCahLZztCF5wk.jpg'
                            style={{width:40,height:40,borderRadius:40}}
                        />
                        <div className="ml-2">
                            <p className='line-clamp-1'>{supplier || 'No supplier set'}</p>
                        </div>
                    </div> */}
                    <div className='grow-1 flex flex-col'>
                        <div className='grow-1 overflow-y-auto' style={{height:'200px'}}>
                            {currentOrder.map((product,i)=> (
                                <div className='flex mb-3 items-center py-2 pr-2' key={i}>
                                    <span
                                        className='cursor-pointer' 
                                        onClick={()=> {
                                            const tq = totalQuantity - product.order_quantity;
                                            setTotalQuantity(tq);
                                            const co = currentOrder?.filter(o=> o.id != product.id);
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
                                    {/* <img 
                                        src='https://bestpricegh.com/cdn/shop/files/Frame1_fc88204b-97f1-4cfa-8370-c50e9ebedc78.png?v=1709821754'
                                        style={{width:40,height:40,borderRadius:3}}
                                    /> */}
                                    <div className='ml-2 flex flex-1 justify-between items-center'>
                                        <div>
                                            <p className='mb-0'>{product.name}</p>
                                            <span className='text-sm'><b>#{product.quantity_available}</b></span>
                                        </div>
                                        <input 
                                            value={product.order_quantity}
                                            type='number' 
                                            style={{width:60,height:25,borderWidth:1,paddingLeft:5,borderColor:'#ccc',borderRadius:3}}
                                            onChange={(e)=> {
                                                const val = e.target.value; 
                                                
                                                // console.log('val is',val,'p qty avail',product);
                                                
                                                if(val.length < 9) {
                                                    if(/^\d+$/.test(val)) {
                                                        if(Number(val) <= product.quantity_available) {
                                                            const co = currentOrder.map(p=> {
                                                                if(p.id == product.id) {
                                                                    const x = totalQuantity - p.order_quantity;
                                                                    const y = x + Number(val);                                                                
                                                                    product.order_quantity = (!Number(val)) ? '1' : val;
                                                                    setTotalQuantity(y);
                                                                }
                                                                return p;
                                                            })

                                                            setCurrentOrder(co);
                                                        }
                                                        else {
                                                            toast.error('Cannot transfer more than '+product.quantity_available)
                                                        }
                                                        
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className='p-4 my-2' style={{backgroundColor:'#eee',borderRadius:4}}>
                            <div className='flex justify-between mb-2'>
                                <p>Subtotal</p>
                                <p>₵ {Number(currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div>
                            {/* <div className='flex justify-between mb-2'>
                                <p>Discount</p>
                                <span>₵
                                    <input 
                                        value={discount}
                                        type='number' 
                                        style={{width:60,height:25,borderWidth:1,paddingLeft:5,marginLeft:8,borderColor:'#ccc',borderRadius:3}}
                                        onChange={(e)=> {
                                            const val = e.target.value;                                            
                                            if(val.length < 9) {
                                                if(/^\d+$/.test(val)) {
                                                    if(val < currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)) {
                                                        setDiscount(val);
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </span>
                            </div> */}
                            <div className='flex justify-between mb-2'>
                                <p>Items</p>
                                <p>{currentOrder.reduce((ac,c)=> ac + Number(c.order_quantity), 0)}</p>
                            </div>
                            <div className='flex justify-between'>
                                <TextField
                                    className='h-full w-full my-2 p-0'
                                    placeholder="Note"
                                    label="Note"
                                    variant="outlined"
                                    value={note}
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                    InputProps={{
                                        style: {padding:0,paddingTop:5,paddingBottom:5}
                                    }}
                                    multiline
                                    onChange={(ev)=> {
                                        if(ev.target.value.length < 201) {
                                            setNote(ev.target.value);
                                        }
                                    }}
                                />
                            </div>
                            <hr className='mb-2'/>
                            <div className='flex justify-between'>
                                <p>Total</p>
                                <p>₵ {Number(currentOrder.reduce((pr,c)=> pr + (Number(c.order_quantity)*c.unit_price), 0)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div>
                        </div>
                        <Button
                            className="my-2"
                            variant="contained"
                            color="secondary"
                            // component={NavLinkAdapter}
                            // to="/setups/locations/new"
                            onClick={()=> {
                                if(!fromSource) {
                                    toast.error('Select source')
                                    return;
                                }
                                if(!toDestination) {
                                    toast.error('Select destination')
                                    return;
                                }
                                // if(!invoice) {
                                //     toast.error('Provide reference number')
                                //     return;
                                // }
                                if(currentOrder?.length == 0) {
                                    toast.error('Select at least 1 product');
                                    return;
                                }

                                setOpenConfirm(true);
                            }}
                            size={isMobile ? 'small' : 'medium'}
                        >
                            {/* <FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon> */}
                            <span className="mx-1 sm:mx-2">Proceed</span>
                        </Button>
                        {/* <div className='flex justify-between mx-2'>
                            <span onClick={()=> setOpenConfirm(true)} className='text-sm cursor-pointer'>Hold</span>
                            <span className='text-sm cursor-pointer'>Pro-Invoice</span>
                        </div> */}
                    </div>
                </Paper>

                <ConfirmDialog
                    open={openConfirm}
                    handleClose={(r)=> {
                        if(r) {
                            handleSaveTransfer()
                        }

                        setOpenConfirm(false);
                    }}
                    leftText='No'
                    message={`Are you sure you want to transfer ${currentOrder.reduce((accumulator, currentItem) => accumulator + currentItem.order_quantity, 0)} item(s) from ${fromSource?.name} to ${toDestination?.name}?`}
                    rightText='Yes'
                    title='Confirm Transfer'
                />
			</div>
		</>
	);
}

export default NewTransfer;