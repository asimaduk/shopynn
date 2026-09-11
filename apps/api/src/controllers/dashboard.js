import { handleResponse } from "../util/handleresponse.js";
import { getDashboardDataService, getProfitAndLossService, getCashFlowService } from "../models/dashboard.js";
import { buildReportPdfBuffer } from "../utils/reportPdf.js";
import { buildReportExcelBuffer } from "../utils/reportExcel.js";
import pool from "../config/db.js";

async function resolveCompanyName(req) {
    let companyName = String(req.body?.companyName || "").trim();
    if (!companyName && req.user?.tenant_id) {
        const tenantRes = await pool.query(
            `SELECT name, organization FROM tenants WHERE id = $1 LIMIT 1`,
            [req.user.tenant_id]
        );
        companyName =
            tenantRes.rows[0]?.name || tenantRes.rows[0]?.organization || "Shopynn";
    }
    return companyName || "Shopynn";
}

function parseReportExportBody(req) {
    const title = String(req.body?.title || "Report").trim() || "Report";
    const dateRangeLabel = String(req.body?.dateRangeLabel || "All time").trim();
    const cards = Array.isArray(req.body?.cards) ? req.body.cards : [];
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : [];
    return { title, dateRangeLabel, cards, rows };
}

export const getDashboard = async (req, res, next) => {
    try {
        const data = await getDashboardDataService(req.user, { recentLimit: req.query.recentLimit });
        handleResponse(res, 200, "Dashboard data.", data);
    } catch (error) {
        next(error);
    }
};

export const getProfitAndLoss = async (req, res, next) => {
    try {
        const report = await getProfitAndLossService(req.user, req.query);
        handleResponse(res, 200, "Profit and loss.", report);
    } catch (error) {
        next(error);
    }
};

export const getCashFlow = async (req, res, next) => {
    try {
        const report = await getCashFlowService(req.user, req.query);
        handleResponse(res, 200, "Cash flow.", report);
    } catch (error) {
        next(error);
    }
};

/** POST body: { title, dateRangeLabel, cards, rows, companyName? } → application/pdf */
export const exportReportPdf = async (req, res, next) => {
    try {
        const { title, dateRangeLabel, cards, rows } = parseReportExportBody(req);
        const companyName = await resolveCompanyName(req);

        const pdfBuffer = await buildReportPdfBuffer({
            title,
            companyName,
            dateRangeLabel,
            cards,
            rows: rows.slice(0, 2000),
        });

        const safe = title.replace(/[^\w.-]+/g, "_").slice(0, 60) || "report";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safe}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

/** POST body: { title, dateRangeLabel, cards, rows, companyName? } → .xlsx */
export const exportReportExcel = async (req, res, next) => {
    try {
        const { title, dateRangeLabel, cards, rows } = parseReportExportBody(req);
        const companyName = await resolveCompanyName(req);

        const excelBuffer = await buildReportExcelBuffer({
            title,
            companyName,
            dateRangeLabel,
            cards,
            rows,
        });

        const safe = title.replace(/[^\w.-]+/g, "_").slice(0, 60) || "report";
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${safe}.xlsx"`);
        res.setHeader("Content-Length", excelBuffer.length);
        res.send(excelBuffer);
    } catch (error) {
        next(error);
    }
};
