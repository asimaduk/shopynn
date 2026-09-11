const path = require('path');
const Service = require('node-windows').Service;

const script = path.join(__dirname, 'index.js');

const svc = new Service({
    name: 'Shopynn Print Service',
    description: 'Shopynn USB thermal receipt print agent (port 3001).',
    script,
    env: [
        { name: 'PRINT_HOST', value: process.env.PRINT_HOST || '0.0.0.0' },
        { name: 'PRINT_PORT', value: process.env.PRINT_PORT || '3001' },
    ],
});

svc.on('install', function () {
    svc.start();
    console.log('Shopynn Print Service installed and started.');
});

svc.on('alreadyinstalled', function () {
    console.log('Shopynn Print Service already installed — starting.');
    svc.start();
});

svc.on('error', function (err) {
    console.error('Service error:', err);
    process.exitCode = 1;
});

svc.install();
