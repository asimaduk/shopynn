import * as React from 'react';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeHeldItem, selectHeldSales } from './newSaleSlice';
import { URLS } from '@/configs/settingsConfig';

export interface SelectHeldSaleProps {
  id: string;
  keepMounted: boolean;
  value: string;
  open: boolean;
  onClose: (value?: string) => void;
  onHoldSelect: (value?: string) => void;
}

function SelectHeldSale(props: SelectHeldSaleProps) {
  const dispatch = useAppDispatch();
  const { onClose, onHoldSelect, value: valueProp, open, ...other } = props;
  const [value, setValue] = React.useState(valueProp);
  const radioGroupRef = React.useRef<HTMLElement>(null);
  const heldSales = useAppSelector(selectHeldSales);

  React.useEffect(() => {
    if (!open) {
      setValue(valueProp);
    }
  }, [valueProp, open]);

  const handleEntering = () => {
    if (radioGroupRef.current != null) {
      radioGroupRef.current.focus();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleOk = () => {
    onClose(value);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue((event.target as HTMLInputElement).value);
  };

  const openHeldItems = (itm) => {
    onHoldSelect(itm)
  }

  return (
    <Dialog
      sx={{ '& .MuiDialog-paper': { width: '80%', maxHeight: 435 } }}
      maxWidth="xs"
      TransitionProps={{ onEntering: handleEntering }}
      open={open}
      {...other}
    >
      <DialogTitle>Select held sales</DialogTitle>
      <DialogContent dividers>
        {heldSales?.map((sale, i) => (
          <div className='flex mb-3 items-center py-2 pr-2' key={i}>
            <div className='flex items-center'>
              <FuseSvgIcon 
                className="cursor-pointer mr-2"
                // size={16}
                color="action"
                onClick={()=> dispatch(removeHeldItem(sale))}>
                  heroicons-outline:trash
              </FuseSvgIcon>
        
              {
                sale.customer?.thumbnail ? (
                <img
                    src={`${URLS.serverUrl}/images?id=${sale.customer.thumbnail}`}
                    alt={'img'}
                    className="w-full max-h-9 max-w-9 block rounded-sm"
                />
              ) : (
                <img
                    src="/assets/images/apps/ecommerce/product-image-placeholder.png"
                    alt={'img'}
                    className="w-full max-h-9 max-w-9 block rounded-sm"
                />
              )}
            </div>

            <div className='ml-2 flex flex-1 justify-between items-center'>
                <div>
                  <p className='mb-2'>{sale.customer || 'Walk In'}</p>
                  <span>{sale.currentOrder.length} product(s)</span>
                </div>

                <FuseSvgIcon
                    className="ml-3 cursor-pointer"
                    color="action"
                    onClick={()=> openHeldItems(Object.assign({},sale))}
                >
                    heroicons-outline:chevron-double-right
                </FuseSvgIcon>
            </div>
        </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleOk}>Ok</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SelectHeldSale;