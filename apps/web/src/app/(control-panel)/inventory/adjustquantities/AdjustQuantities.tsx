'use client';

import { Button, Input, Paper, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useThemeMediaQuery } from '@fuse/hooks';
import ConfirmDialog from './ConfirmDialog';
import Typography from '@mui/material/Typography';

import { useGetProductCategoriesQuery, useGetECommerceProductsWithPaginationQuery } from '../ECommerceApi';
import FuseLoading from '@fuse/core/FuseLoading';
import { useGetWarehousesQuery } from '../../setups/warehouses/WarehouseApi';
import { useSnackbar } from 'notistack';
import { URLS } from '@/configs/settingsConfig';
import { useRouter } from 'next/navigation';
import { useCreateAdjustmentMutation } from './AdjustmentApi';

/**
 * The new quantities page.
 */
function NewQuantities() {
	const router = useRouter();
	const { enqueueSnackbar } = useSnackbar();
	const [createAdjustment, { isLoading: saving }] = useCreateAdjustmentMutation();

	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const [value] = useState('');
    const [openConfirm, setOpenConfirm] = useState(false);
    const { data: categories } = useGetProductCategoriesQuery(null, {refetchOnMountOrArgChange:true});
    const { data: warehouses } = useGetWarehousesQuery(null, {refetchOnMountOrArgChange:true});
    const { data: products, isLoading, refetch} = useGetECommerceProductsWithPaginationQuery({pageType:'pos'}, {refetchOnMountOrArgChange:true});
    const [filterText, setFilterText] = useState('');
    const [category, setCategory] = useState({id:0,name:''});
    const [currentOrder, setCurrentOrder] = useState([]);
    const [warehouse, setWarehouse] = useState(null);
    const [discount, setDiscount] = useState('');
    const [invoice, setInvoice] = useState('');
	const [totalQuantity, setTotalQuantity] = useState(0);
	const [note, setNote] = useState('');

    const handleChangeCategory = (catr) => {
        setCategory(catr);
    }

    const handleAddOrder = (prod) => {
        if(!warehouse) {
            enqueueSnackbar('Please select the store first', { variant: 'warning' });
            return;
        }

        // console.log('add',prod);
        
        const y = currentOrder?.find(c=> c.id == prod.id);

        if(!y) {
            const x = currentOrder?.map(o=> o);
            const stq =  prod.stores_quantities ? prod.stores_quantities.find(st=> st.warehouse_id == warehouse.id)?.quantity_available : 0;
            // console.log('stq',stq);
            
            x.unshift({...prod,order_quantity:1,stq: stq || 0, adjustment_type: 'addition' as const})
            // console.log('x',x);
            setCurrentOrder(x);
            setTotalQuantity((prev)=> prev + 1);
        }
    }

	const handleSavePurchase = async () => {
		if (!warehouse?.id) return;
		try {
			await createAdjustment({
				warehouse_id: warehouse.id,
				reference_number: invoice.trim() || undefined,
				notes: note.trim(),
				products: currentOrder.map((o) => ({
					id: o.id,
					quantity: Number(o.order_quantity) || 0,
					unit_price: Number(o.unit_price) || 0,
					adjustment_type: o.adjustment_type || 'addition'
				}))
			}).unwrap();
			enqueueSnackbar('Adjustment saved.', { variant: 'success' });
			setWarehouse(null);
			setInvoice('');
			setCurrentOrder([]);
			setNote('');
			setTotalQuantity(0);
			void refetch();
			router.push('/inventory/adjustquantities');
		} catch (e: unknown) {
			const msg =
				e && typeof e === 'object' && 'data' in e
					? String((e as { data?: unknown }).data ?? 'Could not save adjustment.')
					: 'Could not save adjustment.';
			enqueueSnackbar(msg, { variant: 'error' });
		}
	};

	return (
		<>
			<div className="w-full h-full flex flex-1 p-4 space-x-4">
                {saving && (
                    <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
                        <FuseLoading />
                    </div>
                )}
                <Paper className="w-5/7 h-full flex flex-col flex-1 p-4 overflow-x-auto" style={{backgroundColor:'#fefefe'}}>
                    <div className='flex w-full pb-2 justify-between'>
                        <Autocomplete
                            className="w-1/3 mx-2"
                            // fullWidth
                            // multiple
                            freeSolo
                            getOptionLabel={(option:any) => option.name}
                            options={warehouses}
                            value={warehouse}
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
                            placeholder="Reference no."
                            label="Reference"
                            variant="outlined"
                            value={invoice}
                            // InputLabelProps={{
                            //     shrink: true
                            // }}
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

                    {categories?.length > 0 && (
                        <div className='flex w-full overflow-x-auto mt-2'>
                            <span onClick={()=> setCategory({id:0,name:''})} className='cursor-pointer mr-2 p-2 text-nowrap' style={{backgroundColor:category?.id == 0?'#ccc':'#eee', borderRadius:3}}>All</span>
                            {categories.map((info,i)=> (
                                <span onClick={()=> handleChangeCategory(info)} className='cursor-pointer mr-2 p-2 text-nowrap' style={{backgroundColor:info.name === category?.name?'#ccc':'#eee', borderRadius:3}} key={i}>{info.name}</span>
                            ))}
                        </div>
                    )}

                    <Typography className="text-sm tracking-tight my-2">Products ({isLoading?'...':products.length})</Typography>

                    <Paper className="w-full grid grid-cols-5 gap-4 p-3 overflow-x-auto" style={{height:'53vh'}}>
                        {products?.filter(p=> (p.categories?.indexOf(category?.name) > -1) || (category?.id == 0))
                            .filter(prod=> ((!filterText) || (filterText && (prod.name.toLowerCase().indexOf(filterText.toLowerCase()) > -1))))
                            .map((product,i)=> (
                            <div key={i} onClick={()=> handleAddOrder(product)} className='p-2 cursor-pointer' style={{backgroundColor:'#fff',borderRadius:5,height:'fit-content'}}>
                                {
                                    product.thumbnail ? (
                                    <img
                                        src={`${URLS.serverUrl}/images?id=${product.thumbnail}`}
                                        alt={'img'}
                                        className='w-full'
                                        style={{height:90}}
                                    />
                                ) : (
                                    <img
                                        src="/assets/images/apps/ecommerce/product-image-placeholder.png"
                                        alt={'img'}
                                        className='w-full'
                                        style={{height:90}}
                                    />
                                )}
                                
                                {/* <img 
                                    src='https://cdn.thewirecutter.com/wp-content/media/2025/03/BEST-MACBOOKS-2048px-15inch-hero.jpg?auto=webp&quality=75&width=1024'
                                    // src={}
                                    style={{borderRadius:3}}
                                    className='w-full'
                                /> */}
                                
                                <p className='my-2 line-clamp-2'>{product.name}</p>

                                <div className='flex flex-1 justify-between items-center'>
                                    {!warehouse ? 
                                        <span className='text-sm'><b>Q. {product.inventory || 0}</b></span>
                                        :
                                        <span className='text-sm'><b>Q. {product.stores_quantities ? product.stores_quantities.find(st=> st.warehouse_id == warehouse.id)?.quantity_available || 0 : 0}</b></span>
                                    }
                                    <span className='flex justify-center items-center' style={{width:20,height:20,borderRadius:20,backgroundColor:'#000',color:'#fff'}}>+</span>
                                </div>
                            </div>
                        ))}

                        {products?.filter(p=> (p.categories?.indexOf(category?.name) > -1) || (category?.id == 0))
                            .filter(prod=> ((!filterText) || (filterText && (prod.name.toLowerCase().indexOf(filterText.toLowerCase()) > -1)))).length == 0 && (
                            <p className='mt-2'>{filterText.length ? 'No search results':'No products avaiable'}</p>
                        )}
                    </Paper>
                </Paper>
                <Paper className="w-2/7 h-full p-3 flex flex-col" style={{backgroundColor:'#fff'}}>
                    <div className='flex justify-between'>
                        <h1 className='text-xl'><b>Add Products</b></h1>
                        {/* <FuseSvgIcon
                            className="mx-3 cursor-pointer"
                            color="action"
                            onClick={openHeldItems}
                        >
                            heroicons-outline:adjustments-horizontal
                        </FuseSvgIcon> */}
                    </div>

                    {/* {user.role === 'admin' && (
                        <Autocomplete
                            disabled={currentOrder.length>0}
                            className="my-2"
                            fullWidth
                            options={warehouses}
                            value={warehouse}
                            getOptionLabel={(option:any) => option.name}
                            onChange={(event, newValue) => {
                                setWarehouse(newValue)
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Select store"
                                    label="Store"
                                    variant="outlined"
                                    sx={{
                                        "& .MuiOutlinedInput-input": {
                                            height: 5, // Sets the height of the actual input element
                                        },
                                    }}
                                />
                            )}
                        />
                    )} */}
                    
                    {/* <div className='flex items-center py-2'>
                        <img 
                            src='https://img.favpng.com/17/24/10/computer-icons-user-profile-male-avatar-png-favpng-jhVtWQQbMdbcNCahLZztCF5wk.jpg'
                            style={{width:40,height:40,borderRadius:40}}
                        />
                        <div className="ml-2">
                            <p className='line-clamp-1'>{warehouse || 'No store set'}</p>
                        </div>
                    </div> */}
                    <div className='grow-1 flex flex-col'>
                        <div className='grow-1 overflow-y-auto' style={{height:'200px'}}>
                            {currentOrder.map((product,i)=> (
                                <div className='flex mb-3 items-start py-2 pr-2' key={product.id ?? i}>
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
                                    <div className='ml-2 flex flex-1 flex-col gap-1 min-w-0'>
                                        <div>
                                            <p className='mb-0'>{product.name}</p>
                                            <span className='text-sm'><b>Q. {product.stq}</b></span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-end gap-1">
                                            <FormControl size="small" sx={{ minWidth: 110 }}>
                                                <InputLabel id={`adj-type-${String(product.id)}`}>Type</InputLabel>
                                                <Select
                                                    labelId={`adj-type-${String(product.id)}`}
                                                    label="Type"
                                                    value={product.adjustment_type ?? 'addition'}
                                                    onChange={(e) => {
                                                        const v = String(e.target.value);
                                                        setCurrentOrder((co) =>
                                                            co.map((p) =>
                                                                p.id === product.id ? { ...p, adjustment_type: v } : p
                                                            )
                                                        );
                                                    }}
                                                >
                                                    <MenuItem value="addition">Add</MenuItem>
                                                    <MenuItem value="subtraction">Subtract</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <input
                                                value={product.order_quantity}
                                                type="number"
                                                style={{
                                                    width: 60,
                                                    height: 25,
                                                    borderWidth: 1,
                                                    paddingLeft: 5,
                                                    borderColor: '#ccc',
                                                    borderRadius: 3
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val.length < 9) {
                                                        if (/^\d+$/.test(val)) {
                                                            const co = currentOrder.map((p) => {
                                                                if (p.id == product.id) {
                                                                    const x = totalQuantity - p.order_quantity;
                                                                    const y = x + Number(val);
                                                                    p.order_quantity = val;
                                                                    setTotalQuantity(y);
                                                                }
                                                                return p;
                                                            });

                                                            setCurrentOrder(co);
                                                        } else {
                                                            const co = currentOrder.map((p) => {
                                                                if (p.id == product.id) {
                                                                    p.order_quantity = '';
                                                                }
                                                                return p;
                                                            });

                                                            setCurrentOrder(co);
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className='p-4 my-2' style={{backgroundColor:'#eee',borderRadius:4}}>
                            {/* <div className='flex justify-between mb-2'>
                                <p>Subtotal</p>
                                <p>₵ {Number(currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div> */}
                            
                            <div className='flex justify-between mb-2'>
                                <p>Items</p>
                                <p>{currentOrder.reduce((a,b)=> a + Number(b.order_quantity), 0)}</p>
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
                            {/* <hr className='mb-2'/>
                            <div className='flex justify-between'>
                                <p>Total</p>
                                <p>₵ {Number((currentOrder.reduce((pr,c)=> pr + (c.order_quantity*c.unit_price), 0)) - Number(discount)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</p>
                            </div> */}
                        </div>
                        <Button
                            className="my-2"
                            variant="contained"
                            color="secondary"
                            disabled={saving}
                            // component={NavLinkAdapter}
                            // to="/setups/locations/new"
                            onClick={()=> {
                                if(!warehouse) {
                                    enqueueSnackbar('Select warehouse', { variant: 'warning' })
                                    return;
                                }
                                if(!invoice) {
                                    enqueueSnackbar('Provide reference number', { variant: 'warning' })
                                    return;
                                }
                                if(currentOrder?.length == 0) {
                                    enqueueSnackbar('Select at least 1 product', { variant: 'warning' });
                                    return;
                                }
                                const tmp = currentOrder.find(co=> !co.order_quantity);
                                if(tmp) {
                                    enqueueSnackbar(`${tmp.name} should have a valid quantity`, { variant: 'warning' })
                                    return;
                                }
                                if(!note) {
                                    enqueueSnackbar('Please add note or reason for the changes', { variant: 'warning' })
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
                    message='Are you sure you want to make these changes?'
                    rightText='Yes'
                    title='Confirm Updates'
                />
			</div>
		</>
	);
}

export default NewQuantities;