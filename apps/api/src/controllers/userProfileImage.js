import dotenv from "dotenv";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { handleResponse } from "../util/handleresponse.js";
import { getPreferencesService, updatePreferencesService } from "../models/userPreferences.js";
import { createAuditLogService } from "../models/auditLog.js";
import { deleteS3Objects } from "../util/s3Delete.js";

dotenv.config();

const s3 = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESSKEYID,
        secretAccessKey: process.env.AWS_SECRETACCESSKEY,
    },
});

const sanitizeFilename = (name = "file") =>
    String(name)
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120);

const logProfileImageAudit = async (req, action, details = {}) => {
    if (!req?.user?.id) return;
    try {
        await createAuditLogService({
            user_id: req.user.id,
            tenant_id: req.user.tenant_id,
            action,
            entity_type: "user_profile_image",
            entity_id: req.user.id,
            details: JSON.stringify(details),
            ip_address: req.ip,
        });
    } catch (err) {
        console.error("[audit] Failed to log profile image action", action, err?.message || err);
    }
};

export const uploadProfileImage = multer({
    storage: multerS3({
        contentType: multerS3.AUTO_CONTENT_TYPE,
        s3,
        acl: "public-read",
        bucket: process.env.S3_BUCKET_NAME,
        key: (req, file, cb) => {
            const userId = req.user?.id || "anonymous";
            const safeName = sanitizeFilename(file.originalname);
            cb(null, `users/${userId}/profile/${Date.now()}-${uuidv4()}-${safeName}`);
        },
    }),
    limits: { files: 1 },
});

export const setMyProfileImage = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file?.key) {
            return handleResponse(res, 400, "Profile image file is required.", null);
        }

        const prefs = await getPreferencesService(req.user.id);
        const existingKey = prefs?.profile?.image_key || null;

        const patch = {
            profile: {
                image_key: file.key,
                image_url: file.location || null,
            },
        };

        const preferences = await updatePreferencesService(req.user.id, patch);

        // Best-effort cleanup of previous S3 object when replacing avatar.
        if (existingKey && existingKey !== file.key) {
            await deleteS3Objects([existingKey]);
        }

        await logProfileImageAudit(req, "PROFILE_IMAGE_UPDATE", {
            replaced_existing: Boolean(existingKey),
            previous_image_key: existingKey,
            new_image_key: file.key,
        });

        return handleResponse(res, 200, "Profile image updated.", {
            image_key: file.key,
            image_url: file.location || null,
            preferences,
        });
    } catch (err) {
        next(err);
    }
};

export const removeMyProfileImage = async (req, res, next) => {
    try {
        const prefs = await getPreferencesService(req.user.id);
        const existingKey = prefs?.profile?.image_key || null;

        if (existingKey) {
            // Best-effort delete: don't block user-facing removal on storage errors.
            await deleteS3Objects([existingKey]);
        }

        const preferences = await updatePreferencesService(req.user.id, {
            profile: { image_key: null, image_url: null },
        });

        await logProfileImageAudit(req, "PROFILE_IMAGE_REMOVE", {
            removed_existing: Boolean(existingKey),
            previous_image_key: existingKey,
        });

        return handleResponse(res, 200, "Profile image removed.", { preferences });
    } catch (err) {
        next(err);
    }
};

