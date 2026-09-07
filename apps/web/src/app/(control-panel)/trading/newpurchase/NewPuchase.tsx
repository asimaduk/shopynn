'use client';

import { Box, Button, Chip, IconButton, Input, Paper, TextField, Tooltip } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import Autocomplete from '@mui/material/Autocomplete';
import { useMemo, useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useThemeMediaQuery } from '@fuse/hooks';
import ConfirmDialog from './ConfirmDialog';
import Typography from '@mui/material/Typography';

import { useGetProductCategoriesQuery, useGetECommerceProductsWithPaginationQuery } from '../../inventory/ECommerceApi';
import { useCreatePurchaseMutation } from '../TradingApi';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import toast from 'react-hot-toast';
import { useGetSuppliersQuery } from '../../setups/suppliers/SupplierApi';
import { URLS } from '@/configs/settingsConfig';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';

/**
 * The new sale page.
 */
function NewSale() {
    const [createPurchase] = useCreatePurchaseMutation();
    const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const [value] = useState('');
    const [openConfirm, setOpenConfirm] = useState(false);
    const { data: categories } = useGetProductCategoriesQuery(null, {refetchOnMountOrArgChange:true});
    const { data: suppliers } = useGetSuppliersQuery(null, {refetchOnMountOrArgChange:true});
    const { data: warehouses } = useGetWarehousesQuery(null, {refetchOnMountOrArgChange:true});
    const { data: products, isLoading } = useGetECommerceProductsWithPaginationQuery({pageType:'pos'}, {refetchOnMountOrArgChange:true});
    const [filterText, setFilterText] = useState('');
    const voiceSearch = useVoiceSearch({
        onResult: setFilterText,
        onError: (message) => toast.error(message)
    });
    const [category, setCategory] = useState({id:0,name:''});
    const [currentOrder, setCurrentOrder] = useState([]);
    const [supplier, setSupplier] = useState(null);
    const [warehouse, setWarehouse] = useState(null);
    const [discount, setDiscount] = useState('');
    const [invoice, setInvoice] = useState('');
    const [totalQuantity, setTotalQuantity] = useState(0);
	const [processing, setProcessing] = useState(false);
    const [note, setNote] = useState("");

    const filteredProducts = useMemo(() => {
        const list = products ?? [];
        const q = filterText.trim().toLowerCase();
        return list.filter((p) => {
            const inCategory =
                category?.id == 0 || (Array.isArray(p.categories) && p.categories.indexOf(`${category?.id}`) > -1);
            if (!inCategory) return false;
            if (!q) return true;
            const name = (p.name ?? '').toLowerCase();
            const sku = (p.sku ?? '').toLowerCase();
            const barCode = String((p as { bar_code?: string }).bar_code ?? '').toLowerCase();
            return name.includes(q) || sku.includes(q) || barCode.includes(q);
        });
    }, [products, category?.id, category?.name, filterText]);

    const handleChangeCategory = (catr) => {
        setCategory(catr);
    }

    const handleAddOrder = (prod) => {
        const y = currentOrder?.find(c=> c.id == prod.id);

        if(!y) {
            const x = currentOrder?.map(o=> o);
            x.unshift({...prod,order_quantity:1})
            // console.log('x',x);
            setCurrentOrder(x);
            setTotalQuantity((prev)=> prev + 1);
        }
    }

    const handleSavePurchase = () => {
        const payload = {
            number_of_items: totalQuantity,
            total_amount: Number((currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)) - Number(discount)),
            discount_amount: Number(discount),
            invoice_number: invoice,
            current_status: 1,
            notes: note,
            warehouse_id: warehouses?.find(wh=> wh.name == warehouse)?.id,
            supplier_id: suppliers?.find(sup=> sup.name == supplier)?.id,
            products: currentOrder.map(o=> ({id: o.id, quantity: Number(o.order_quantity), unit_price: o.unit_price}))
        }

        // console.log('pl',payload);

        // return;
        setProcessing(true);
        createPurchase(payload)
            .then(res=> {
                // console.log('np then res',res);
                if(res.data?.status === 409) {
                    toast.error(`Error: Invoice number #${invoice} already exists. Please check and try again.`)
                }
                else if(res.data?.status === 201) {
                    setSupplier('');
                    setWarehouse('');
                    setInvoice('')
                    setCurrentOrder([]);
                    setNote('');
                    setTotalQuantity(0);
                    toast.success('New purchase saved successfully.');
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
                            options={suppliers?.map(s=> s.name)}
                            value={supplier as string}
                            onChange={(event, newValue) => {
                                // onChange(newValue);
                                setSupplier(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Select supplier"
                                    label="Supplier"
                                    variant="outlined"
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                />
                            )}
                        />

                        <Autocomplete
                            className="w-1/3 mx-2"
                            // fullWidth
                            // multiple
                            freeSolo
                            options={warehouses?.map(w=> w.name)}
                            value={warehouse as string}
                            onChange={(event, newValue) => {
                                setWarehouse(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Select warehouse"
                                    label="Warehouse"
                                    variant="outlined"
                                    InputLabelProps={{
                                        shrink: true
                                    }}
                                />
                            )}
                        />

                        <TextField
                            // {...params}
                            className='w-1/3'
                            placeholder="Invoice no."
                            label="Invoice"
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
                        />

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
                                placeholder="Search name, SKU, or code..."
                                disableUnderline
                                fullWidth
                                value={filterText}
                                onChange={(event) => {
                                    setFilterText(event.target.value);
                                }}
                                inputProps={{
                                    'aria-label': 'Search products'
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
                                            mr: 0.5
                                        }}
                                    >
                                        <FuseSvgIcon size={20}>
                                            {voiceSearch.listening
                                                ? 'heroicons-solid:stop'
                                                : 'heroicons-outline:microphone'}
                                        </FuseSvgIcon>
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <FuseSvgIcon
                                className="mx-2"
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
                            : filteredProducts.length === (products?.length ?? 0)
                                ? filteredProducts.length
                                : `${filteredProducts.length} / ${products?.length ?? 0}`}
                        )
                    </Typography>

                    <Paper
                        className="w-full p-2 overflow-y-auto"
                        style={{ height: '53vh' }}
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

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        Stock: {Number(product.inventory ?? 0)}
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
                                    {filterText.trim() ? 'No matching products' : 'No products in this view'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>
                                    {filterText.trim()
                                        ? 'Adjust your search or clear the box to see products in this category.'
                                        : 'Try another category, or confirm inventory items are available for receiving.'}
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Paper>
                <Paper className="w-2/7 h-full p-3 flex flex-col" style={{backgroundColor:'#fff'}}>
                    <div className='flex justify-between'>
                        <h1 className='text-xl'><b>Receive Order</b></h1>
                        {/* <FuseSvgIcon
                            className="mx-3 cursor-pointer"
                            color="action"
                            onClick={openHeldItems}
                        >
                            heroicons-outline:adjustments-horizontal
                        </FuseSvgIcon> */}
                    </div>
                    
                    <div className='flex items-center py-2'>
                        <img 
                            src='https://img.favpng.com/17/24/10/computer-icons-user-profile-male-avatar-png-favpng-jhVtWQQbMdbcNCahLZztCF5wk.jpg'
                            style={{width:40,height:40,borderRadius:40}}
                        />
                        <div className="ml-2">
                            <p className='line-clamp-1'>{supplier || 'No supplier set'}</p>
                            {/* <span className='text-sm' ><b>(R094-869)</b></span> */}
                        </div>
                    </div>
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
                                            <span className='text-sm'><b>₵{Number(product.unit_price).toFixed(2)}</b></span>
                                        </div>
                                        <input 
                                            value={product.order_quantity}
                                            type='number' 
                                            style={{width:60,height:25,borderWidth:1,paddingLeft:5,borderColor:'#ccc',borderRadius:3}}
                                            onChange={(e)=> {
                                                const val = e.target.value;                                                
                                                // if(val.length < 9) {
                                                //     if(/^\d+$/.test(val)) {
                                                //         const co = currentOrder.map(p=> {
                                                //             if(p.id == product.id) {
                                                //                 const x = totalQuantity - p.order_quantity;
                                                //                 const y = x + Number(val);                                                                
                                                //                 product.order_quantity = val;
                                                //                 setTotalQuantity(y);
                                                //             }
                                                //             return p;
                                                //         })
                                                        
                                                //         setCurrentOrder(co);
                                                //     }
                                                // }

                                                if(val.length < 9) {
                                                    if(/^\d+$/.test(val)) {
                                                        const co = currentOrder.map(p=> {
                                                            // if(p.id == product.id) {
                                                            //     if(Number(val) > product.quantity_available) {
                                                            //         product.order_quantity = '';
                                                            //         toast.error(`You cannot sell more than available quantity: ${product.quantity_available}`)
                                                            //     }                                                               
                                                            //     else {
                                                            //         product.order_quantity = Number(val);
                                                            //     }
                                                            // }
                                                            if(p.id == product.id) {
                                                                const x = totalQuantity - p.order_quantity;
                                                                const y = x + Number(val);                                                                
                                                                product.order_quantity = val;
                                                                setTotalQuantity(y);
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
                            ))}
                        </div>
                        <div className='p-4 my-2' style={{backgroundColor:'#eee',borderRadius:4}}>
                            <div className='flex justify-between mb-2'>
                                <p>Subtotal</p>
                                <p>₵ {Number(currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div>
                            <div className='flex justify-between mb-2'>
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
                            </div>
                            <div className='flex justify-between mb-2'>
                                <p>Items</p>
                                <p>{totalQuantity}</p>
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
                                <p>₵ {Number((currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)) - Number(discount)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div>
                        </div>
                        <Button
                            className="my-2"
                            variant="contained"
                            color="secondary"
                            // component={NavLinkAdapter}
                            // to="/setups/locations/new"
                            onClick={()=> {
                                if(!supplier) {
                                    toast.error('Select supplier')
                                    return;
                                }
                                if(!warehouse) {
                                    toast.error('Select warehouse')
                                    return;
                                }
                                if(!invoice) {
                                    toast.error('Provide invoice number')
                                    return;
                                }
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
                            handleSavePurchase()
                        }

                        setOpenConfirm(false);
                    }}
                    leftText='No'
                    message='Are you sure you want to receive or save this invoice/purchase?'
                    rightText='Yes'
                    title='Confirm Purchase'
                />
			</div>
		</>
	);
}

export default NewSale;