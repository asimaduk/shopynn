const path = require('path');
var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
    name:'Shopynn Print Service',
    description: 'This service is used to print receipts from Shopynn webapp.',
    script: path.join(__dirname,'index.js')
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
    svc.start();
});

svc.install();