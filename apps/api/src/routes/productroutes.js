import express from "express";
import { createProduct, getAllProducts, getProductsByCategory, updateProduct, updateProductImages, uploadProductImages, changeProductPrice, getProductById, deleteProduct, getProductBySlug, changeProductStatus, getAllTransfers, createTransfer, getAllTransferById, getAllProductsCount, getProductsForExport, getCatalog, getCatalogProductById } from "../controllers/product.js";
import { uploadImages } from "../controllers/image.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
import requireFeature from "../middleware/requireFeature.js";

const router = express.Router();

router.post("/", requirePermission("products.create"), createProduct);
router.put("/toggle-status", requirePermission("products.toggle_status"), changeProductStatus);
router.post("/change-price", requirePermission("products.change_price"), changeProductPrice);
router.get("/", requirePermission("products.view"), getAllProducts);
router.get("/catalog", requireFeature("orders.view"), requirePermission("orders.view"), getCatalog);
router.get("/catalog/:id", requireFeature("orders.view"), requirePermission("orders.view"), getCatalogProductById);
router.get("/by-category/:categoryId", requireAnyPermission("products.by_category.view", "products.view"), getProductsByCategory);
router.put("/:id", requirePermission("products.update"), updateProduct);
router.get("/count", requirePermission("products.view"), getAllProductsCount);
router.get("/export", requirePermission("products.export"), getProductsForExport);
router.get("/transfers", requirePermission("transfers.view"), getAllTransfers);
router.get("/transfers/:id", requireAnyPermission("transfers.details.view", "transfers.view"), getAllTransferById);
router.post("/transfers", requirePermission("transfers.create"), createTransfer);
router.get("/slug/:slug", requirePermission("products.view"), getProductBySlug);
router.get("/:id", requirePermission("products.view"), getProductById);
router.post("/update-images", requirePermission("products.update_images"), updateProductImages);
router.post("/:id/images/upload", requirePermission("products.update_images"), uploadImages.any(), uploadProductImages);
router.delete("/:id", requirePermission("products.delete"), deleteProduct);

export default router;