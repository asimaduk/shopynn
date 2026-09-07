'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Autocomplete, TextField } from '@mui/material';
import { useThemeMediaQuery } from '@fuse/hooks';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';

export default function PaymentDialog({ open, handleClose }) {
    const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
    const [paymentType,setPaymentType] = React.useState('');
    const [transNumber, setTransNumber] = React.useState('');

    const dispatch = useAppDispatch();

    const handleSave = () => {
        if(paymentType == 'Momo' && (!transNumber || transNumber.length < 10)) {
            console.log('dispatch');
            
            dispatch(showMessage({ message: 'Specify full transaction number' }));
            return;
        }
        
        handleClose({paymentType, transNumber})
    }
    return (
        <React.Fragment>
            <Dialog
                // className='w-2/3'
                open={open}
                onClose={()=> handleClose(false)}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    Make Payment
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Specify the mode of payment for this transaction
                    </DialogContentText>

                    <Autocomplete
                        className="w-full my-4"
                        fullWidth
                        freeSolo
                        options={['Cash','Momo']}
                        value={paymentType as string}
                        onChange={(event, newValue) => setPaymentType(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Select payment mode"
                                label="Payment"
                                variant="outlined"
                                InputLabelProps={{
                                    shrink: true
                                }}
                            />
                        )}
                    />

                    {paymentType === 'Momo' && ( 
                        <div>
                            <TextField
                                className='mt-2 w-full'
                                placeholder="Momo number"
                                label="Momo"
                                variant="outlined"
                                value={transNumber}
                                onChange={(event) => {
                                    const newValue = event.target.value;
                                    if(newValue.length > 10) return;
                                    if(!newValue) {
                                        setTransNumber(newValue)
                                    }
                                    else {
                                        if(/^\d+$/.test(newValue)) {
                                            setTransNumber(newValue)
                                        }
                                    }
                                }}
                                InputLabelProps={{
                                    shrink: true
                                }}
                            />

                            <Button
                                className="my-4 w-full"
                                variant="contained"
                                color="secondary"
                                // component={NavLinkAdapter}
                                // to="/setups/locations/new"
                                onClick={()=> {
                                    // setOpenPayment(true);
                                }}
                                size={isMobile ? 'small' : 'medium'}
                            >
                                <span>Send</span>
                            </Button>
                        </div>
                    )}

                </DialogContent>
                <DialogActions>
                    <Button onClick={()=> handleClose(false)}>Cancel</Button>
                    <Button 
                        variant='outlined'
                        color='secondary'
                        disabled={!paymentType}
                        onClick={handleSave}>
                        <span>Save & Print</span>
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}