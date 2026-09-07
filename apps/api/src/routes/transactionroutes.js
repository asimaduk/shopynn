import express from "express";
import { getAllTransactions, getTransacionById } from "../controllers/transactions.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get('/', requirePermission('products.transactions.view'), getAllTransactions);
router.get('/:id', requirePermission('products.transactions.view'), getTransacionById);

export default router;