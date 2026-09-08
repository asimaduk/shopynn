import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3, s3Configured } from './s3Upload.js';

/**
 * Delete objects from the app S3 bucket. Swallows per-key errors so DB updates can still proceed.
 * @param {string[]} keys - S3 object keys (same as stored in products.thumbnail, etc.)
 */
export async function deleteS3Objects(keys) {
    const bucket = process.env.S3_BUCKET_NAME;
    if (!s3Configured || !s3 || !bucket || !Array.isArray(keys) || keys.length === 0) return;

    const unique = [...new Set(keys.map((k) => (k == null ? '' : String(k).trim())).filter(Boolean))];
    await Promise.all(
        unique.map(async (Key) => {
            try {
                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
            } catch (err) {
                console.error('[s3Delete] Failed to delete object', Key, err?.message || err);
            }
        })
    );
}
