import express from "express";
import { createCategory, deleteCategory, getAllCategories, getCategoryById, updateCategory } from "../controllers/category.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post('/', requirePermission('categories.create'), createCategory);
router.get('/', requirePermission('categories.view'), getAllCategories);
router.get('/:id', requirePermission('categories.view'), getCategoryById);
router.put('/:id', requirePermission('categories.update'), updateCategory);
router.delete('/:id', requirePermission('categories.delete'), deleteCategory);

export default router;