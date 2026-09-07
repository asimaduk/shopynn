import { handleResponse } from "../util/handleresponse.js";
import { createSaleService, getAllSalesService, getSalesByDateService, getAllSaleDetailsService, getCogsReportService, getRevenueReportService, getDailySalesSummaryService, getSalesByCustomerSummaryService, getSalesByCustomersReportService, getSalesByUserSummaryService, getSaleByIdService, getSaleAttendantsService, getSalesSummaryService, getTopSellingProductsService, getMyMtdSalesTotalService, buildSaleInvoicePackageService, sendSaleInvoiceEmailService } from "../models/sale.js";

export const createSale = async (req, res, next) => {
    try {
        const newSale = await createSaleService(req.body);
        handleResponse(res, 201, "Sale creation success.", newSale);
    } catch (error) {
        next(error);
    }
}

export const getAllSales = async (req, res, next) => {
    try {
        const sales = await getAllSalesService(req.user,req.query);
        handleResponse(res, 200, "Sales list.", sales);
    } catch (error) {
        next(error);
    }
};

export const getSalesByDate = async (req, res, next) => {
    try {
        const sales = await getSalesByDateService(req.user, req.query);
        handleResponse(res, 200, "Sales list by date.", sales);
    } catch (error) {
        next(error);
    }
};

export const getSalesSummary = async (req, res, next) => {
    try {
        const summary = await getSalesSummaryService(req.user, req.query);
        handleResponse(res, 200, "Sales summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getRevenueReport = async (req, res, next) => {
    try {
        const report = await getRevenueReportService(req.user, req.query);
        handleResponse(res, 200, "Revenue report.", report);
    } catch (error) {
        next(error);
    }
};

export const getDailySalesSummary = async (req, res, next) => {
    try {
        const summary = await getDailySalesSummaryService(req.user, req.query);
        handleResponse(res, 200, "Daily sales summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getCogsReport = async (req, res, next) => {
    try {
        const report = await getCogsReportService(req.user, req.query);
        handleResponse(res, 200, "COGS report.", report);
    } catch (error) {
        next(error);
    }
};

export const getSalesByCustomersSummary = async (req, res, next) => {
    try {
        const summary = await getSalesByCustomerSummaryService(req.user, req.query);
        handleResponse(res, 200, "Sales by customers summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getSalesByCustomersReport = async (req, res, next) => {
    try {
        const report = await getSalesByCustomersReportService(req.user, req.query);
        handleResponse(res, 200, "Sales by customers report.", report);
    } catch (error) {
        next(error);
    }
};

export const getSalesByUserSummary = async (req, res, next) => {
    try {
        const summary = await getSalesByUserSummaryService(req.user, req.query);
        handleResponse(res, 200, "Sales by user summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getMyMtdSalesTotal = async (req, res, next) => {
    try {
        const summary = await getMyMtdSalesTotalService(req.user);
        handleResponse(res, 200, "My MTD sales total.", summary);
    } catch (error) {
        next(error);
    }
};

export const getTopSellingProducts = async (req, res, next) => {
    try {
        const products = await getTopSellingProductsService(req.user, req.query);
        handleResponse(res, 200, "Top 5 selling products.", products);
    } catch (error) {
        next(error);
    }
};

export const getSaleById = async (req, res, next) => {
    try {
        const sale = await getSaleByIdService(req.params.id);
        if(!sale) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Sale found.", sale);
    } catch (error) {
        next(error);
    }
}

export const getSaleInvoicePdf = async (req, res, next) => {
    try {
        const pkg = await buildSaleInvoicePackageService(req.params.id, req.user.tenant_id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
        res.send(pkg.pdfBuffer);
    } catch (error) {
        next(error);
    }
};

export const sendSaleInvoice = async (req, res, next) => {
    try {
        const result = await sendSaleInvoiceEmailService(req.params.id, req.user.tenant_id, req.body || {});
        handleResponse(res, 200, "Invoice sent.", result);
    } catch (error) {
        next(error);
    }
};

export const getAllSaleDetails = async (req, res, next) => {
    try {
        const saleItems = await getAllSaleDetailsService();
        handleResponse(res, 200, "Sales items list.", saleItems);
    } catch (error) {
        next(error);
    }
}

export const getSaleAttendants = async (req, res, next) => {
    try {
        const saleAttendants = await getSaleAttendantsService();
        handleResponse(res, 200, "Sales attendants.", saleAttendants);
    } catch (error) {
        next(error);
    }
}