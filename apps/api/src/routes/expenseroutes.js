import express from "express";
import { createExpense, getAllExpenses, updateExpense,  } from "../controllers/expense.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post('/', requirePermission('expenses.create'), createExpense);
router.get('/', requirePermission('expenses.view'), getAllExpenses);
router.put('/:id', requireAnyPermission('expenses.update', 'expenses.create'), updateExpense);

export default router;