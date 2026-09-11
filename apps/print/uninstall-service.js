const path = require('path');
const Service = require('node-windows').Service;

const script = path.join(__dirname, 'index.js');

const svc = new Service({
    name: 'Shopynn Print Service',
    script,
});

svc.on('uninstall', function () {
    console.log('Shopynn Print Service uninstalled.');
});

svc.on('error', function (err) {
    console.error('Service error:', err);
    process.exitCode = 1;
});

svc.uninstall();
