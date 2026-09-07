import express from "express";
import { createCustomer, deleteCustomer, getAllCustomers, getCustomerById, getCustomerSales, updateCustomer } from "../controllers/customer.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
const router = express.Router();

router.post('/', requirePermission('customers.create'), createCustomer);
router.get('/', requirePermission('customers.view'), getAllCustomers);
router.get('/:id/sales', requireAnyPermission('customers.sales.view', 'customers.view'), getCustomerSales);
router.get('/:id', requireAnyPermission('customers.details.view', 'customers.view'), getCustomerById);
router.put('/:id', requirePermission('customers.update'), updateCustomer);
router.delete('/:id', requirePermission('customers.delete'), deleteCustomer);

export default router;