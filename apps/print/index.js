const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');

let device;

const app = express();
app.use(express.json());
app.use(cors());

const formatDate = (dt) => {
    let t1 = `${dt}`.split('T')[0];
    let y = t1.split('-')[0]
    let m = t1.split('-')[1]
    let d = t1.split('-')[2]

    if(m === '01') {
        m = "Jan"
    }
    else if(m === '02') {
        m = "Feb"
    }
    else if(m === '03') {
        m = "Mar"
    }
    else if(m === '04') {
        m = "Apr"
    }
    else if(m === '05') {
        m = "May"
    }
    else if(m === '06') {
        m = "Jun"
    }
    else if(m === '07') {
        m = "Jul"
    }
    else if(m === '08') {
        m = "Aug"
    }
    else if(m === '09') {
        m = "Sep"
    }
    else if(m === '10') {
        m = "Oct"
    }
    else if(m === '11') {
        m = "Nov"
    }
    else if(m === '12') {
        m = "Dec"
    }

    return `${d}/${m}/${y}`;
}

const formatTime = (dt) => {
    let t2 = `${dt}`.split('T')[1];
    let h = t2.split(':')[0];
    let m = t2.split(':')[1];

    const apm = h > 11 ? 'PM':'AM';
    if(h>12) {
        h = h%12;
    }

    return `${h}:${m} ${apm}`;
}

app.post('/print', async (req, res) => {
    // console.log('req.body',req.body);

    try {
        if(!device){
            device = new escpos.USB();
            // console.log('created new device');
        }
        // else console.log('already have device');

        const { invoice_number, customer, sale_date, cashier } = req.body;
        const companyName = req.body?.company?.name || req.body?.company_name || req.body?.business_name || 'Shopynn';
        const companyTagline = req.body?.company?.organization || req.body?.company_organization || req.body?.company_tagline || '';
        const companyAddress = req.body?.company?.address || req.body?.company_address || '';
        const companyLandmark = req.body?.company?.landmark || req.body?.company_landmark || '';
        const companyPhone =
            req.body?.company?.phone ||
            req.body?.company_phone ||
            req.body?.company?.contact ||
            req.body?.company_contact ||
            '';
        const options = { encoding: "GB18030" /* default */ }
 
        const printer = new escpos.Printer(device, options);

        const cartItems = req.body.products;
    
        // get total per line items
        // const totalPerItemList = (item) => {
        //     let totalPerItem = 0
        //     totalPerItem = item.quantityToSell * item.price
        //     return totalPerItem
        // }
    
        // get the total price
        let total = 0;
        for (let cartItem of cartItems) {
            var unitSum  = cartItem.quantity * cartItem.unit_price;
            total += unitSum;
        }
    
        device.open(function(err){
            printer
            .font('b')
            .align('ct')
            .style('b')
            .size(0.05, 0.02)
            .encode('utf8')
            .text(`\n${companyName}\n${companyTagline}\n`)
            .style('NORMAL')
            .style('a')
            .text(
                `${companyAddress || ''}\n` +
                `${companyLandmark || ''}\n\n` +
                `${companyPhone || ''}\n`
            )
            // .table(["Buyer Name :", `${customer}`, ""])
            .tableCustom([
                { text: "Buyer Name:", align: "LEFT", width: 0.3 },
                { text: customer, align: "LEFT", width: 0.7 }
            ])
            .tableCustom([
                { text: "Receipt #:", align: "LEFT", width: 0.3 },
                { text: invoice_number, align: "LEFT", width: 0.7 }
            ])
            .tableCustom([
                { text: "Date:", align: "LEFT", width: 0.3 },
                { text: formatDate(sale_date)+', '+formatTime(sale_date), align: "LEFT", width: 0.7 }
            ])
            // .text("----------------------------------------------")
            .text("---------------------------------------------------------")
            .tableCustom([
                { text: "Item", align: "LEFT", width: 0.4 },
                { text: "Qty", align: "CENTER", width: 0.15 },
                { text: "Price", align: "RIGHT", width: 0.2 },
                { text: "Amount", align: "RIGHT", width: 0.25 }
            ])
            .text("--------------------------------------------------------")
            
            cartItems.forEach(item=> {
                printer.tableCustom([
                    { text: item.name, align: "LEFT", width: 0.4 },
                    { text: item.quantity, align: "CENTER", width: 0.15 },
                    { text: `${item.unit_price}`.toLocaleString('en-US', { style: 'currency', currency: 'GHS'}), align: "RIGHT", width: 0.2 },
                    { text: `${Number(item.quantity*item.unit_price).toFixed(2)}`.toLocaleString('en-US', { style: 'currency', currency: 'GHS'}), align: "RIGHT", width: 0.25 }
                ])
            })

            printer
            .text("--------------------------------------------------------")
            // .tableCustom([
            //     { text: "Sub Total", align: "RIGHT", width: 0.6 },
            //     { text: `GHS ${Number(total - (total*0.15)).toFixed(2)}`, align: "RIGHT", width: 0.4 }
            // ])
            // .tableCustom([
            //     { text: "Covid Levy (1.0%)", align: "RIGHT", width: 0.6 },
            //     { text: `GHS ${Number(total*0.01).toFixed(2)}`, align: "RIGHT", width: 0.4 }
            // ])
            // .tableCustom([
            //     { text: "NHL (2.5%)", align: "RIGHT", width: 0.6 },
            //     { text: `GHS ${Number(total*0.025).toFixed(2)}`, align: "RIGHT", width: 0.4 }
            // ])
            // .tableCustom([
            //     { text: "VAT (15.0%)", align: "RIGHT", width: 0.6 },
            //     { text: `GHS ${Number(total*0.15).toFixed(2)}`, align: "RIGHT", width: 0.4 }
            // ])
            .tableCustom([
                { text: "Total", align: "RIGHT", width: 0.6 },
                { text: `GHS ${Number(total).toFixed(2)}`, align: "RIGHT", width: 0.4 }
            ])
            .tableCustom([
                { text: "No. of Items", align: "RIGHT", width: 0.6 },
                { text: cartItems.reduce((pr,c)=> pr + c.quantity, 0), align: "RIGHT", width: 0.4 }
            ])
            .text(`\nOperator: ${cashier}`)
            // .barcode('123456789012')
            // .beep(1,100)
            .cut()
            .close();
        });
 
        // device.open(function(error) {
        //     printer
        //         .font('b')
        //         .align('ct')
        //         // .style('bu')
        //         // .size(1, 1)
        //         .text('The quick brown fox jumps over the lazy dog')
        //         // .barcode('1234567', 'EAN8')
        //         .table(["One", "Two"])
        //         .tableCustom(
        //             [
        //                 { text:"Left", align:"LEFT", width:0.5 },
        //                 // { text:"Center", align:"CENTER", width:0.33},
        //                 { text:"Right", align:"RIGHT", width:0.5 }
        //             ],
        //             // { encoding: 'cp857', size: [1, 1] } // Optional
        //         )
        //         // .qrimage('https://github.com/song940/node-escpos', function(err){
        //         //     this.cut();
        //         //     this.close();
        //         // });
        //         .cut()
        //         .close()
        // });

        console.log('Print done!');
        res.status(200).send({status: 200, message: 'Print successful'});
    } catch (error) {
        console.error('Print failed:', error);
        res.status(500).send({status: 500, message: 'Print failed: '+error.message});
    }
});

app.listen(3001, () => {
    console.log('Print server listening on port 3001');
});