import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import dayjs, { Dayjs } from 'dayjs';
import { PickersShortcutsItem } from '@mui/x-date-pickers/PickersShortcuts';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import { StaticDateRangePicker } from '@mui/x-date-pickers-pro/StaticDateRangePicker';

const shortcutsItems: PickersShortcutsItem<DateRange<Dayjs>>[] = [
  {
    label: 'This Week',
    getValue: () => {
      const today = dayjs();
      return [today.startOf('week'), today];
    },
  },
  {
    label: 'Last Week',
    getValue: () => {
      const today = dayjs();
      const prevWeek = today.subtract(7, 'day');
      return [prevWeek.startOf('week'), prevWeek.endOf('week')];
    },
  },
  {
    label: 'Last 7 Days',
    getValue: () => {
      const today = dayjs();
      return [today.subtract(7, 'day'), today];
    },
  },
  {
    label: 'Current Month',
    getValue: () => {
      const today = dayjs();
      return [today.startOf('month'), today];
    },
  },
  { label: 'Reset', getValue: () => [null, null] },
];

let startDate = '';
let endDate = '';

export default function DateRangeDialog({ open, handleClose }) {
    return (
        <React.Fragment>
            <Dialog
                // className='w-2/3'
                open={open}
                onClose={()=> handleClose(null)}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogContent>
                    <StaticDateRangePicker
                        slotProps={{
                            shortcuts: {
                                items: shortcutsItems,
                            },
                        }}
                        maxDate={dayjs()}
                        onChange={(val)=> {
                          // console.log('on change val',val);
                          
                            if(val && val[0]) {
                              startDate = val[0].toDate().toJSON()
                            }

                            if(val && val[1]) {
                              endDate = val[1].set('hour', 23).set('minute', 59).set('second', 59).toDate().toJSON()
                              // endDate = val[1].toDate().toJSON()
                            }
                        }}
                      
                        // onAccept={(a)=> console.log('on accp',a)}
                        onClose={()=> {
                            if(startDate && endDate) {
                                handleClose({startDate, endDate})
                            }
                            else {
                                handleClose(null)
                            }
                        }}
                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    );
}