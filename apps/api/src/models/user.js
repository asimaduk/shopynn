import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { sendEmailService } from "./mail.js";
import { createWarehouseService } from "./warehouse.js";
import {
    resolveSubscriptionFeatureCodesService,
    checkTenantCanAddUser,
    checkTenantCanAddWarehouse,
    getTenantSubscriptionUsageService,
} from "./subscription.js";
import { SUPER_ADMIN_EXCLUDED_PERMISSION_CODES } from "../constants/permissionCodes.js";

const saltRounds = 12;

const updateLastLogin = (id) => {
    pool.query("UPDATE users SET last_login=$1 WHERE id=$2",[new Date(), id])    
}

export const loginService = async (payload) => {
    const { email, password } = payload;

    if (!email || !password) return {};

    const result = await pool.query(
        "SELECT id, password, temporary_password, password_expires_at, tenant_id, is_active, warehouse_id FROM users WHERE email = $1",
        [email.trim().toLowerCase()]
    );

    if (result.rowCount) {
        const foundUser = result.rows[0];

        if (foundUser.is_active) {
            if (foundUser.password_expires_at && new Date(foundUser.password_expires_at) < new Date()) {
                return { passwordExpired: true };
            }
            if (!foundUser.password) {
                return {};
            }
            const cmp = await bcrypt.compare(password, foundUser.password);
            if (cmp) {
                const _payload = {
                    id: foundUser.id,
                    warehouse_id: foundUser.warehouse_id,
                    tenant_id: foundUser.tenant_id
                }
                // console.log('..._payload',_payload);
                const token = jwt.sign(_payload, process.env.JWT_SECRET);
                updateLastLogin(foundUser.id)
                return { token };
            }
            else {
                return {};
            }
        }
        else {
            return {isActive: false};
        }
    }
    else {
        return {};
    }
}

export const getAllUsersService = async (currentUser) => {
    const params = [currentUser.tenant_id, currentUser.id];
    // console.log('params',params);
    const result = await pool.query(
        `SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.merchant_id,
            w.name AS warehouse_name,
            u.created_at,
            u.deleted,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) 
                     FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON ur.role_id = r.id
         LEFT JOIN warehouses w ON w.id = u.warehouse_id
         WHERE u.tenant_id = $1
           AND u.id <> $2
           AND NOT EXISTS (
               SELECT 1
               FROM customer_profiles cp
               WHERE cp.user_id = u.id
                 AND cp.tenant_id = u.tenant_id
                 AND (cp.profile_type IS NULL OR lower(trim(cp.profile_type)) = 'customer')
           )
         GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.merchant_id, w.name, u.created_at, u.deleted
         ORDER BY u.first_name, u.last_name`,
        params
    );
    // console.log('result',result.rows);
    return result.rows;
}

export const toggleUserActiveService = async (payload) => {
    const { id, is_active } = payload;
    const result = await pool.query(
        `UPDATE users
         SET is_active = $1,
             updated_at = $2
         WHERE id = $3
         RETURNING id, first_name, is_active`,
        [is_active, new Date(), id]
    );
    return result.rows[0] || null;
}

export const getUserByIdService = async (id) => {
    const userRes = await pool.query("SELECT u.id, u.first_name, u.last_name, u.deleted, u.merchant_id, u.email, u.phone, u.last_login, u.tenant_id, u.is_active, u.temporary_password, u.warehouse_id, w.name AS warehouse_name FROM users u LEFT JOIN warehouses w ON u.warehouse_id = w.id WHERE u.id = $1", [id]);
    if(userRes.rowCount){
        const merchantRes = await pool.query(`SELECT id FROM merchants WHERE user_id = $1 LIMIT 1`, [userRes.rows[0].id]);
        userRes.rows[0].merchant_id = merchantRes.rows[0]?.id ?? null;
        // Fetch tenant details (name, address, phone, email) as "company" in response data
        let company = null;
        if(userRes.rows[0]?.tenant_id){
            const tenantRes = await pool.query(
                `SELECT t.name, t.phone, t.address, t.organization, t.email, t.industry_id, t.logo, t.subscription_id
                 FROM tenants t
                 WHERE t.id = $1`,
                [userRes.rows[0].tenant_id]
            );

            if (tenantRes.rowCount) {
                let industry = "Not set";
                if (tenantRes.rows[0].industry_id) {
                    const industryRes = await pool.query(
                        `SELECT name FROM industries WHERE id = $1`,
                        [tenantRes.rows[0].industry_id]
                    );
                    if (industryRes.rowCount && industryRes.rows[0].name) {
                        industry = industryRes.rows[0].name;
                    }
                }
                const planUsage = await getTenantSubscriptionUsageService(userRes.rows[0].tenant_id);
                let subscription = null;
                if (tenantRes.rows[0].subscription_id) {
                    const subRes = await pool.query(
                        `SELECT id, name, status, amount, billing_interval, start_at, end_at, features
                         FROM subscriptions
                         WHERE id = $1
                         LIMIT 1`,
                        [tenantRes.rows[0].subscription_id]
                    );
                    if (subRes.rowCount) {
                        const subRow = subRes.rows[0];
                        const entitlementFeatures = await resolveSubscriptionFeatureCodesService({
                            subscriptionId: subRow.id,
                            subscriptionName: subRow.name,
                            fallbackFeatures: subRow.features,
                        });
                        subscription = {
                            id: subRow.id,
                            name: subRow.name,
                            status: subRow.status,
                            amount: subRow.amount != null ? Number(subRow.amount) : null,
                            billing_interval: subRow.billing_interval ?? null,
                            start_at: subRow.start_at,
                            end_at: subRow.end_at,
                            features: entitlementFeatures,
                            limits: {
                                maxUsers: planUsage.maxUsers,
                                maxWarehouses: planUsage.maxWarehouses,
                                maxLocations: planUsage.maxLocations,
                                userCount: planUsage.userCount,
                                warehouseCount: planUsage.warehouseCount,
                                locationCount: planUsage.locationCount,
                            },
                        };
                    }
                }

                company = {
                    name: tenantRes.rows[0].name || null,
                    address: tenantRes.rows[0].address || null,
                    phone: tenantRes.rows[0].phone || null,
                    email: tenantRes.rows[0].email || null,
                    organization: tenantRes.rows[0].organization || null,
                    industry,
                    industry_id: tenantRes.rows[0].industry_id ?? null,
                    logo: tenantRes.rows[0].logo || null,
                    subscription,
                    plan_usage: planUsage,
                };
            }

            // Load user roles and permissions and return it as settings

            // Get roles for this user
            let roles = [];
            let permissions = [];
            if (userRes.rows[0]?.id) {
                // Load roles
                const rolesRes = await pool.query(
                    `SELECT r.name, r.description
                    FROM user_roles ur
                    INNER JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1`,
                    [userRes.rows[0].id]
                );
                if (rolesRes.rowCount) {
                    roles = rolesRes.rows.map(r => ({
                        name: r.name,
                        description: r.description
                    }));
                }

                // Load permissions via role -> role_permissions -> permissions
                const permsRes = await pool.query(
                    `SELECT DISTINCT p.code
                    FROM user_roles ur
                    INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
                    INNER JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur.user_id = $1`,
                    [userRes.rows[0].id]
                );
                if (permsRes.rowCount) {
                    permissions = permsRes.rows.map(p => ({
                        code: p.code,
                    }));
                }
            }

            // Add settings with roles and permissions
            userRes.rows[0].settings = { roles, permissions };

            // Include profile image persisted in user_preferences.profile.image_url
            // so frontends can render avatar directly from /users/me.
            const prefsRes = await pool.query(
                `SELECT preferences
                 FROM user_preferences
                 WHERE user_id = $1
                 LIMIT 1`,
                [userRes.rows[0].id]
            );
            const prefs = prefsRes.rows[0]?.preferences || {};
            const profileImageUrl =
                prefs?.profile?.image_url ||
                prefs?.profile?.imageUrl ||
                null;
            if (profileImageUrl) {
                userRes.rows[0].profile_image = profileImageUrl;
                userRes.rows[0].settings = {
                    ...userRes.rows[0].settings,
                    profile: {
                        ...(userRes.rows[0].settings?.profile || {}),
                        image_url: profileImageUrl,
                    },
                };
            }
        } 

        const rtn = { ...userRes.rows[0], company };
        
        if(rtn.temporary_password) {
            rtn.reset_password = true;
        }

        delete rtn['temporary_password'];
        delete rtn['tenant_id'];
        delete rtn['id'];
        /** merchant_id retained for client routing / portal gating */

        // console.log('rtn', rtn);
        return rtn;
    }

    return null;
}

export const getUserDetailsService = async (id) => {
    const result = await pool.query(
        `SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.last_login,
            u.created_at,
            u.deleted,
            u.deleted_reason,
            u.deleted_at,
            u.deleted_by,
            u.phone,
            u.is_active,
            u.warehouse_id,
            w.name AS warehouse_name
         FROM users u
         LEFT JOIN warehouses w ON u.warehouse_id = w.id
         WHERE u.id = $1`,
        [id]
    );

    if (!result.rowCount) {
        return null;
    }

    const user = result.rows[0];

    // Load roles
    let roles = [];
    const rolesRes = await pool.query(
        `SELECT r.id, r.name
         FROM user_roles ur
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1`,
        [id]
    );
    if (rolesRes.rowCount) {
        roles = rolesRes.rows.map(r => ({
            id: r.id,
            name: r.name
        }));
    }

    // Load permissions via role -> role_permissions -> permissions
    let permissions = [];
    const permsRes = await pool.query(
        `SELECT DISTINCT p.id, p.code, p.name
         FROM user_roles ur
         INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
         INNER JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = $1`,
        [id]
    );
    if (permsRes.rowCount) {
        permissions = permsRes.rows.map(p => ({ id: p.id, code: p.code, name: p.name }));
    }

    return {
        ...user,
        roles,
        permissions,
    };
}

const sendCredentials = async (data) => {
    // console.log('email data',data);
    const resp = await sendEmailService(data);
}

const sendNewPassword = async (data) => {
    // console.log('email data',data);
    const resp = await sendEmailService(data);
    // console.log('forgot pass . email response',resp);
}

export const createUserService = async (payload) => {
    const { 
        first_name, 
        last_name, 
        email, 
        tenant_id, 
        phone, 
        registration_method, 
        isOnboarding = false, 
        password,
        role_id,
        warehouse_id,
        user_permissions = [],
        assigned_by_user_id,
        email_credentials = false,
    } = payload;

    // console.log('user create payload',payload);

    if (!first_name || !last_name || !tenant_id) {
        return { message: "Missing params first_name, last_name and tenant_id are required." };
    }

    if (!email || !String(email).trim()) {
        return { message: "Missing parameter email is required." };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const phoneForInsert =
        phone != null && String(phone).trim() !== "" ? String(phone).trim() : null;

    if (!isOnboarding && !phoneForInsert) {
        return { message: "Missing parameter phone is required." };
    }

    const userCap = await checkTenantCanAddUser(tenant_id, { isOnboarding });
    if (!userCap.ok) {
        return { message: userCap.message };
    }

    const existingEmail = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [normalizedEmail]);
    if (existingEmail.rowCount > 0) {
        return { message: "An account with this email already exists." };
    }

    if (phoneForInsert) {
        const existingPhone = await pool.query(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [phoneForInsert]);
        if (existingPhone.rowCount > 0) {
            return { message: "An account with this phone number already exists." };
        }
    }

    const id = uuidv4();
    const method = registration_method || "manual";
    const isManual = method === "manual";

    let plainPassword = null;
    let passwordHash = null;

    if (isManual) {
        if (isOnboarding && password) {
            plainPassword = password;
        } else if (!isOnboarding && password != null && String(password).trim() !== "") {
            plainPassword = String(password).trim();
        } else {
            plainPassword = generatePassword(10);
            console.log("gen pass plain", plainPassword);
        }
        passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    }

    let resolvedWarehouseId = warehouse_id ?? null;
    if (isOnboarding) {
        const whCap = await checkTenantCanAddWarehouse(tenant_id);
        if (!whCap.ok) {
            return { message: whCap.message };
        }
        const wh = await createWarehouseService({
            name: "Main warehouse",
            manager: `${first_name} ${last_name}`.trim(),
            phone: phoneForInsert,
            tenant_id,
            address: null,
            is_refrigerated: false,
            location_id: null,
            creator_id: null,
            printer_type: "any",
        });
        if (!wh?.id) {
            return { message: "Failed to create default warehouse." };
        }
        resolvedWarehouseId = wh.id;
    }

    const values = [
        id,
        first_name,
        last_name,
        normalizedEmail,
        tenant_id,
        phoneForInsert,
        passwordHash,
        passwordHash,
        new Date(),
        true,
        method,
        resolvedWarehouseId,
        new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    ]
    // console.log('values',values);
    const result = await pool.query(
        `INSERT INTO users 
            (id, first_name, last_name, email, tenant_id, phone, password, temporary_password, created_at, is_active, registration_method, warehouse_id, password_expires_at)
         VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        values
    );

    const newUser = result.rows[0];

    if (isOnboarding && newUser?.id && resolvedWarehouseId) {
        await pool.query(`UPDATE warehouses SET creator_id = $1, updated_at = $2 WHERE id = $3`, [
            newUser.id,
            new Date(),
            resolvedWarehouseId,
        ]);
    }

    // 1. Create admin role for this tenant (if not exists)
    const roleId = isOnboarding ? uuidv4() : role_id;
    const roleName = 'Super Admin';
    const roleDesc = 'System Super Administrator (full permissions)';
    // let adminRole = null;
    let permissions = [];

    if(isOnboarding) {
    // Check if admin role already exists for this tenant
        // const roleCheck = await pool.query(
        //     `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`,
        //     [roleName, tenant_id]
        // );

        // if (roleCheck.rows.length > 0) {
        //     adminRole = roleCheck.rows[0];
        // } 
        // else {
            // const newRoleResult = 
            await pool.query(
                `INSERT INTO roles (id, name, description, tenant_id, created_at)
                VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [roleId, roleName, roleDesc, tenant_id, new Date()]
            );
        //     adminRole = { id: newRoleResult.rows[0].id };
        // }

        // 2. Assign all permissions to this role in role_permissions table
        // Find all permissions
        const excludedPlaceholders = SUPER_ADMIN_EXCLUDED_PERMISSION_CODES.map((_, i) => `$${i + 1}`).join(", ");
        const permsResult = await pool.query(
            `SELECT id FROM permissions WHERE code NOT IN (${excludedPlaceholders})`,
            SUPER_ADMIN_EXCLUDED_PERMISSION_CODES
        );
        permissions = permsResult.rows.map(row => row.id);
    }
    else {
        permissions = user_permissions.length > 0 ? user_permissions : [];
    }

    // console.log('permissions to assign',permissions);

    // Find already assigned permissions (avoid duplicates)
    const existingPermsRes = await pool.query(
        `SELECT permission_id FROM role_permissions WHERE role_id = $1`,
        [roleId]
    );

    const existingPermIds = new Set(existingPermsRes.rows.map(r => r.permission_id));

    // Insert missing role_permissions
    for (const permId of permissions) {
        if (!existingPermIds.has(permId)) {
            await pool.query(
                `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)`,
                [uuidv4(), roleId, permId]
            );
        }
    }

    // 3. Assign role to this user (user_roles)
    // Check if user already has the role
    const userRoleRes = await pool.query(
        `SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2`,
        [id, roleId]
    );
    const assignedByForRole = assigned_by_user_id || id;
    if (userRoleRes.rows.length === 0) {
        await pool.query(
            `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at) VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), id, roleId, assignedByForRole, new Date()]
        );
    }

    if (newUser.id) {
        const sendCreds =
            Boolean(plainPassword) && !password &&
            isManual &&
            (isOnboarding || email_credentials);
        if (sendCreds) {
            const data = {
                sender_name: "Shopynn Support",
                receipient: normalizedEmail,
                subject: "Welcome to Shopynn - Your account is ready",
                title: "Your temporary login credentials",
                message: `Hello ${first_name},<br/><br/>Your Shopynn account has been created successfully.<br/><br/>You can sign in with the credentials below:<br/>- Email: <strong>${normalizedEmail}</strong><br/>- Temporary password: <strong>${plainPassword}</strong><br/><br/>For your security, this temporary password expires in 30 minutes and must be changed at first login.<br/><br/>If you did not expect this account setup, please contact Shopynn Support immediately.<br/><br/>Regards,<br/>Shopynn Support Team`,
            };
            sendCredentials(data);
        }
        return { id: newUser.id };
    }

    return { status: "Errored" };
}

export const updateUserService = async (payload) => {
    const { id, first_name, last_name, email, fcm_token, phone, is_active, role_id, warehouse_id, user_permissions = [] } = payload;
    const updates = [];
    const values = [];
    let i = 1;
    if (first_name !== undefined) { updates.push(`first_name = $${i++}`); values.push(first_name); }
    if (last_name !== undefined) { updates.push(`last_name = $${i++}`); values.push(last_name); }
    if (email !== undefined) { updates.push(`email = $${i++}`); values.push(email); }
    if (fcm_token !== undefined) { updates.push(`fcm_token = $${i++}`); values.push(fcm_token === "" ? null : fcm_token); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(phone); }
    if (is_active !== undefined) { updates.push(`is_active = $${i++}`); values.push(is_active); }
    if (warehouse_id !== undefined) { updates.push(`warehouse_id = $${i++}`); values.push(warehouse_id); }
    
    if (updates.length === 0) return null;
    
    updates.push(`updated_at = $${i++}`);
    values.push(new Date(), id);
    
    const result = await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${i} RETURNING id`,
        values
    );

    // Update user role if role_id is provided and different from the current
    if (role_id) {
        // Get current roles for user
        const currentRolesRes = await pool.query(
            "SELECT role_id FROM user_roles WHERE user_id = $1",
            [id]
        );
        // Only update if the user doesn't already have the same role
        const currentRoleIds = currentRolesRes.rows.map(r => r.role_id);
        if (!currentRoleIds.includes(role_id) || currentRoleIds.length !== 1) {
            // Remove existing roles for this user
            await pool.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
            // Add the new role
            await pool.query(
                `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [uuidv4(), id, role_id, id, new Date()]
            );
        }
    }

    // Update user permissions if user_permissions is provided (array)
    if (Array.isArray(user_permissions) && user_permissions.length > 0) {
        // Remove all previous direct user permissions
        await pool.query("DELETE FROM role_permissions WHERE role_id = $1", [role_id]);
        // Insert new permissions
        for (const permissionId of user_permissions) {
            await pool.query(
                `INSERT INTO role_permissions (id, role_id, permission_id)
                VALUES ($1, $2, $3)`,
                [uuidv4(), role_id, permissionId]
            );
        }
    }

    return result.rows[0];
};

export const deleteUserService = async (payload) => {
    const { id, deleted_by, deleted_reason } = payload;
    const result = await pool.query(
        `UPDATE users
         SET is_active = false,
             deleted = true,
             deleted_at = $1,
             deleted_by = $2,
             deleted_reason = $3,
             updated_at = $1
         WHERE id = $4
         RETURNING id, first_name`,
        [new Date(), deleted_by || null, deleted_reason || null, id]
    );

    return result.rows[0];
}

function generatePassword(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$_';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
}

export const resetPasswordService = async (newPassword, oldPassword, id) => {    
    if(!newPassword || !oldPassword) return {status: 400, message: "New password and old password are required"};

    // Ensure the old password is correct before changing
    // Fetch current hashed password for this user
    const userResult = await pool.query("SELECT password FROM users WHERE id = $1", [id]);
    if (userResult.rowCount === 0) {
        return {status: 404, message: "User not found"};
    }
    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(oldPassword, user.password);

    if (!passwordMatch) {
        return {status: 400, message: "Old password is incorrect"};
    }
    const password = await bcrypt.hash(newPassword, saltRounds);
    // console.log('bcrypt',password);
 
    const result = await pool.query(`
        UPDATE users SET password=$1, temporary_password=$2, password_expires_at=$3, updated_at=$4  WHERE id=$5 RETURNING *`,
        [ password, null, null, new Date(), id]
    );

    if(result.rows[0]) {
        // console.log('result.rows[0]',result.rows[0]);
        return {status: 201}
    }

    return {status: 500}
}

export const changePasswordWithTemporaryService = async (payload = {}) => {
    const {
        user_id,
        current_password,
        new_password,
    } = payload;

    if (!user_id || !current_password || !new_password) {
        return { status: 400, message: "Current password and new password are required." };
    }

    if (String(new_password).length < 8) {
        return { status: 400, message: "Password must be at least 8 characters." };
    }

    const userResult = await pool.query(
        "SELECT id, password, temporary_password, password_expires_at FROM users WHERE id = $1",
        [user_id]
    );

    if (!userResult.rowCount) {
        return { status: 404, message: "User not found." };
    }

    const user = userResult.rows[0];
    if (!user.temporary_password) {
        return { status: 400, message: "No password is set for this user." };
    }

    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) {
        return { status: 400, message: "Password expired." };
    }

    const temporaryMatches = await bcrypt.compare(
        String(current_password),
        String(user.temporary_password)
    );

    if (!temporaryMatches) {
        return { status: 400, message: "Current password is incorrect." };
    }

    const passwordHash = await bcrypt.hash(String(new_password), saltRounds);
    await pool.query(
        `UPDATE users
         SET password = $1,
             temporary_password = NULL,
             password_expires_at = NULL,
             updated_at = $2
         WHERE id = $3`,
        [passwordHash, new Date(), user_id]
    );

    return { status: 200 };
}

export const forgotPasswordService = async (email) => {
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalized) return { status: 400, message: "Email is required." };

    const result = await pool.query(
        "SELECT id, first_name, email FROM users WHERE email = $1 AND is_active = true",
        [normalized]
    );

    if (result.rowCount) {
        const user = result.rows[0];
        const plainPassword = generatePassword(10);
        // console.log('forgotPasswordService plainPassword',plainPassword);
        const password = await bcrypt.hash(plainPassword, saltRounds);
        const passwordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await pool.query(
            `UPDATE users
             SET password = $1,
                 temporary_password = $2,
                 password_expires_at = $3,
                 updated_at = $4
             WHERE id = $5`,
            [password, password, passwordExpiresAt, new Date(), user.id]
        );

        const data = {
            sender_name: "Shopynn Support",
            receipient: user.email,
            subject: "Reset your password",
            title: "Your password has been reset",
            message: `Hello ${user.first_name},\n\nA temporary password has been generated for your account. Please log in with this password and then set a new one from your profile.\n\nTemporary password: ${plainPassword}\n\nThis password will expire in 30 minutes. Thank you.\n\nRegards,\nShopynn Support Team`,
        };
        sendNewPassword(data);
    }
    else {
        return { status: 400, message: "User not found." };
    }

    return { status: 200 };
}

/**
 * Tie merchant-related permissions to a role and assign that role to a user.
 * Body: { user_id, role_id }
 */
export const assignMerchantPermissionsToUserRoleService = async ({
    user_id,
    role_id,
    tenant_id,
    assigned_by,
}) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const userRes = await client.query(
            `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [user_id, tenant_id]
        );
        if (userRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return { status: 404, message: "User not found for this tenant." };
        }

        const roleRes = await client.query(
            `SELECT id FROM roles WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) LIMIT 1`,
            [role_id, tenant_id]
        );
        if (roleRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return { status: 404, message: "Role not found for this tenant." };
        }

        const permissionCodes = ["merchants.view", "merchants.operate", "tenants.directory.view"];
        const permsResult = await client.query(
            `SELECT id, code FROM permissions WHERE code = ANY($1::text[])`,
            [permissionCodes]
        );
        if (permsResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return { status: 404, message: "Required permissions are missing." };
        }

        let permissionsLinked = 0;
        for (const row of permsResult.rows) {
            const inserted = await client.query(
                `INSERT INTO role_permissions (id, role_id, permission_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (role_id, permission_id) DO NOTHING
                 RETURNING id`,
                [uuidv4(), role_id, row.id]
            );
            if (inserted.rowCount > 0) permissionsLinked++;
        }

        await client.query(
            `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, role_id) DO UPDATE
             SET assigned_by = EXCLUDED.assigned_by`,
            [uuidv4(), user_id, role_id, assigned_by || null, new Date()]
        );

        await client.query("COMMIT");
        return {
            status: 200,
            user_id,
            role_id,
            permissions: permsResult.rows.map((r) => r.code),
            permissions_linked: permissionsLinked,
            role_assigned: true,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};