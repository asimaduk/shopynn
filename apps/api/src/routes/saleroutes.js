import express from "express";
import { createSale, getAllSaleDetails, getAllSales, getSalesByDate, getCogsReport, getRevenueReport, getDailySalesSummary, getSalesByCustomersSummary, getSalesByCustomersReport, getSalesByUserSummary, getSalesSummary, getSaleAttendants, getSaleById, getTopSellingProducts, getMyMtdSalesTotal, getSaleInvoicePdf, sendSaleInvoice } from "../controllers/sale.js";
import auth from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post("/", auth, requirePermission("sales.create"), createSale);
router.get("/", auth, requirePermission("sales.view"), getAllSales);
router.get("/me/mtd-total", auth, requirePermission("sales.view"), getMyMtdSalesTotal);
router.get("/by-date", auth, requireAnyPermission("sales.by_date.view", "sales.view"), getSalesByDate);
router.get("/summary", auth, requirePermission("sales.view"), getSalesSummary);
router.get("/report", auth, requirePermission("sales.view"), getSalesSummary);
router.get("/revenue", auth, requirePermission("reports.view"), getRevenueReport);
router.get("/daily-summary", auth, requireAnyPermission("sales.daily_summary.view", "sales.view"), getDailySalesSummary);
router.get("/cogs", auth, requirePermission("reports.view"), getCogsReport);
router.get("/customers-summary", auth, requirePermission("reports.view"), getSalesByCustomersSummary);
router.get("/customers-report", auth, requirePermission("reports.view"), getSalesByCustomersReport);
router.get("/staff-report", auth, requirePermission("reports.view"), getSalesByUserSummary);
router.get("/top-selling", auth, requirePermission("sales.view"), getTopSellingProducts);
router.get("/attendants", auth, requirePermission("sales.view"), getSaleAttendants);
router.get("/:id/invoice.pdf", auth, requirePermission("sales.share_receipt"), getSaleInvoicePdf);
router.post("/:id/send-invoice", auth, requirePermission("sales.share_receipt"), sendSaleInvoice);
router.get("/:id", auth, requireAnyPermission("sales.details.view", "sales.view"), getSaleById);
router.get("/details-list", auth, requireAnyPermission("sales.details.view", "sales.view"), getAllSaleDetails);

export default router;