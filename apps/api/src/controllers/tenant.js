import { handleResponse } from "../util/handleresponse.js";
import {
    createTenantService,
    getAllTenantsService,
    getTenantByIdService,
    updateTenantService,
    listTenantsDirectoryService,
    getTenantDirectoryDetailService,
} from "../models/tenant.js";
import { assignServingMerchantService } from "../models/merchant.js";
import { getPrinterSetupEntitlementForTenantService } from "../models/onboardingQuote.js";
import { createAuditLogService } from "../models/auditLog.js";
import pool from "../config/db.js";

const COMPANY_AUDIT_FIELDS = [
    "name",
    "organization",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "website",
    "logo",
    "industry_id",
    "notes",
    "product_categorization",
];

async function loadCompanyAuditSnapshot(tenantId) {
    if (!tenantId) return null;
    const result = await pool.query(
        `SELECT name, organization, phone, email, address, city, state, country, postal_code,
                website, logo, industry_id, notes, product_categorization, settings
         FROM tenants
         WHERE id = $1
         LIMIT 1`,
        [tenantId]
    );
    const row = result.rows[0];
    if (!row) return null;
    let bulk = null;
    try {
        const settings =
            typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings;
        bulk = settings?.bulk_discount ?? null;
    } catch (_) {
        bulk = null;
    }
    const snap = {};
    for (const field of COMPANY_AUDIT_FIELDS) {
        snap[field] = row[field] ?? null;
    }
    snap.bulk_discount = bulk;
    return snap;
}

function snapshotCompanyForAudit(tenant) {
    if (!tenant) return null;
    const snap = {};
    for (const field of COMPANY_AUDIT_FIELDS) {
        snap[field] = tenant[field] ?? null;
    }
    snap.bulk_discount = tenant.settings?.bulk_discount ?? null;
    return snap;
}

function diffCompanySnapshots(before, after) {
    const changes = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of keys) {
        const from = before?.[key] ?? null;
        const to = after?.[key] ?? null;
        if (JSON.stringify(from) !== JSON.stringify(to)) {
            changes[key] = { from, to };
        }
    }
    return changes;
}

async function logCompanyProfileUpdate(req, { tenantId, before, after, source }) {
    if (!req?.user?.id || !tenantId) return;
    const changes = diffCompanySnapshots(before, after);
    if (!Object.keys(changes).length) return;
    try {
        await createAuditLogService({
            user_id: req.user.id,
            tenant_id: tenantId,
            action: "COMPANY_PROFILE_UPDATE",
            entity_type: "company_profile",
            entity_id: tenantId,
            details: JSON.stringify({
                source: source || "company_profile",
                actor: {
                    id: req.user.id,
                    email: req.user.email || null,
                },
                changed_fields: Object.keys(changes),
                changes,
            }),
            ip_address: req.ip,
        });
    } catch (err) {
        console.error("[audit] Failed to log company profile update", err?.message || err);
    }
}

export const createTenant = async (req, res, next) => {
    try {
        const result = await createTenantService({ ...req.body, tenant_id: req.body.tenant_id });
        handleResponse(res, 201, "Tenant, subscription and user created.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("already exists") ||
            error.code === "23505"
        ) {
            return handleResponse(res, 400, error.message || "Invalid input or duplicate phone.", null);
        }
        next(error);
    }
};

export const getTenants = async (req, res, next) => {
    try {
        const tenants = await getAllTenantsService(req.query);
        handleResponse(res, 200, "Tenants list.", tenants);
    } catch (error) {
        next(error);
    }
};

export const getTenantById = async (req, res, next) => {
    try {
        const tenant = await getTenantByIdService(req.params.id);
        if (!tenant) return handleResponse(res, 404, "Tenant not found.", null);
        handleResponse(res, 200, "Tenant found.", tenant);
    } catch (error) {
        next(error);
    }
};

/** GET /tenants/admin/list — permission tenants.directory.view */
export const listTenantsDirectory = async (req, res, next) => {
    try {
        const tenants = await listTenantsDirectoryService(req.query);
        handleResponse(res, 200, "Tenant directory.", { tenants });
    } catch (error) {
        next(error);
    }
};

/** GET /tenants/admin/:id — permission tenants.directory.view */
export const getTenantDirectoryDetail = async (req, res, next) => {
    try {
        const data = await getTenantDirectoryDetailService(req.params.id);
        if (!data) return handleResponse(res, 404, "Tenant not found.", null);
        handleResponse(res, 200, "Tenant detail.", data);
    } catch (error) {
        next(error);
    }
};

/** PUT /tenants/admin/:id/serving-merchant — switch field agent for residual commissions */
export const assignTenantServingMerchant = async (req, res, next) => {
    try {
        const result = await assignServingMerchantService({
            tenantId: req.params.id,
            merchantId: req.body?.merchant_id ?? null,
            reason: req.body?.reason,
            assignedBy: req.user?.id,
        });
        handleResponse(
            res,
            200,
            result.unchanged ? "Serving agent unchanged." : "Serving agent updated.",
            result
        );
    } catch (error) {
        if (
            error.message?.includes("not found") ||
            error.message?.includes("required")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const updateTenant = async (req, res, next) => {
    try {
        const tenant_id = req.params.id;
        const setup_inventory = req.body.setup_inventory === true || req.query.setup_inventory === "true";
        const payload = { ...req.body };
        delete payload.setup_inventory;
        const before = await loadCompanyAuditSnapshot(tenant_id);
        const options = { setup_inventory, creator_id: req.user?.id ?? null };
        const tenant = await updateTenantService(tenant_id, payload, options);
        if (!tenant) return handleResponse(res, 404, "Tenant not found.", null);
        handleResponse(res, 200, setup_inventory ? "Tenant updated; inventories created where missing." : "Tenant updated.", tenant);
        await logCompanyProfileUpdate(req, {
            tenantId: tenant_id,
            before,
            after: snapshotCompanyForAudit(tenant),
            source: "admin_tenant_update",
        });
    } catch (error) {
        if (error.message?.includes("Tenant not found")) {
            return handleResponse(res, 404, error.message, null);
        }
        if (error.code === "23505") return handleResponse(res, 400, "Duplicate phone or invalid input.", null);
        next(error);
    }
};

/** Update the authenticated user's tenant (same as PUT /:id but tenant_id from req.user). */
export const updateMyCompanyInfo = async (req, res, next) => {
    try {
        if (!req.user) return handleResponse(res, 401, "Authentication required.", null);
        const tenant_id = req.user.tenant_id;
        if (!tenant_id) return handleResponse(res, 400, "User has no tenant.", null);
        const setup_inventory = true;//req.body.setup_inventory === true || req.query.setup_inventory === "true";
        const payload = { ...req.body };
        // delete payload.setup_inventory;
        const before = await loadCompanyAuditSnapshot(tenant_id);
        const options = { setup_inventory, creator_id: req.user.id };
        const tenant = await updateTenantService(tenant_id, payload, options);
        if (!tenant) return handleResponse(res, 404, "Tenant not found.", null);
        handleResponse(res, 200, setup_inventory ? "Company updated; inventories created where missing." : "Company updated.", tenant);
        await logCompanyProfileUpdate(req, {
            tenantId: tenant_id,
            before,
            after: snapshotCompanyForAudit(tenant),
            source: "company_profile",
        });
    } catch (error) {
        if (error.message?.includes("Tenant not found")) {
            return handleResponse(res, 404, error.message, null);
        }
        if (error.code === "23505") return handleResponse(res, 400, "Duplicate phone or invalid input.", null);
        next(error);
    }
};

/** GET /tenants/me/printer-setup-entitlement — whether thermal setup is unlocked (paid go-live or printer addon). */
export const getMyPrinterSetupEntitlement = async (req, res, next) => {
    try {
        if (!req.user) return handleResponse(res, 401, "Authentication required.", null);
        const tenant_id = req.user.tenant_id;
        if (!tenant_id) return handleResponse(res, 400, "User has no tenant.", null);
        const entitlement = await getPrinterSetupEntitlementForTenantService(tenant_id);
        handleResponse(res, 200, entitlement.message, entitlement);
    } catch (error) {
        next(error);
    }
};

/** GET /tenants/me/go-live-nav — show Go live checklist until the tenant records a first sale. */
export const getMyGoLiveNav = async (req, res, next) => {
    try {
        if (!req.user) return handleResponse(res, 401, "Authentication required.", null);
        const tenant_id = req.user.tenant_id;
        if (!tenant_id) {
            return handleResponse(res, 200, "Go live nav.", {
                show_go_live: false,
                has_first_sale: true,
            });
        }
        const saleCheck = await pool.query(
            `SELECT EXISTS (
                SELECT 1 FROM sales WHERE tenant_id = $1
             ) AS has_first_sale`,
            [tenant_id]
        );
        const has_first_sale = Boolean(saleCheck.rows[0]?.has_first_sale);
        handleResponse(res, 200, "Go live nav.", {
            show_go_live: !has_first_sale,
            has_first_sale,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Setup flow: tenant first, then subscription, then user (same as createTenant; full payload required).
 * Body: tenant fields + subscription_type (1-4) + user fields (first_name, last_name, email, phone?).
 */
export const setupTenant = async (req, res, next) => {
    try {
        const result = await createTenantService(req.body);
        handleResponse(res, 201, "Tenant, subscription and user created (tenant first).", result);
    } catch (error) {
        if (
            error.message?.includes("subscription_type") ||
            error.message?.includes("Tenant not found") ||
            error.message?.includes("required") ||
            error.message?.includes("already exists") ||
            error.message?.includes("User creation") ||
            error.message?.includes("verification")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        if (error.code === "23505") {
            return handleResponse(res, 400, "Invalid input or duplicate phone or email.", null);
        }
        next(error);
    }
};
