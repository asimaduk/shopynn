import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3, s3Configured } from './s3Upload.js';

/** Folder that uploads for a shop are written under (see controllers/image.js). */
export const tenantImagePrefix = (tenantId) => `tenants/${tenantId}/`;

/** Folder that a user's profile images are written under (see controllers/userProfileImage.js). */
export const userImagePrefix = (userId) => `users/${userId}/`;

export const keyHasPrefix = (key, prefixes) => {
    const k = key == null ? '' : String(key).trim();
    return Boolean(k) && !k.includes('..') && prefixes.some((p) => p && k.startsWith(p));
};

/**
 * Delete objects from the app S3 bucket. Swallows per-key errors so DB updates can still proceed.
 * Keys are client-influenced, so only keys under one of `allowedPrefixes` (the caller's own
 * folder) are deleted; anything else is skipped.
 * @param {string[]} keys - S3 object keys (same as stored in products.thumbnail, etc.)
 * @param {{ allowedPrefixes: string[] }} options
 */
export async function deleteS3Objects(keys, { allowedPrefixes } = {}) {
    if (!Array.isArray(allowedPrefixes) || allowedPrefixes.length === 0) {
        throw new Error('deleteS3Objects requires allowedPrefixes.');
    }
    const bucket = process.env.S3_BUCKET_NAME;
    if (!s3Configured || !s3 || !bucket || !Array.isArray(keys) || keys.length === 0) return;

    const unique = [...new Set(keys.map((k) => (k == null ? '' : String(k).trim())).filter(Boolean))];
    await Promise.all(
        unique.map(async (Key) => {
            if (!keyHasPrefix(Key, allowedPrefixes)) {
                console.warn('[s3Delete] Skipped object outside the allowed folder', Key);
                return;
            }
            try {
                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
            } catch (err) {
                console.error('[s3Delete] Failed to delete object', Key, err?.message || err);
            }
        })
    );
}
