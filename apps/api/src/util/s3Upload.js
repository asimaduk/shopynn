import dotenv from "dotenv";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";

dotenv.config();

const hasS3 =
	Boolean(process.env.S3_BUCKET_NAME) &&
	Boolean(process.env.S3_BUCKET_REGION) &&
	Boolean(process.env.AWS_ACCESSKEYID) &&
	Boolean(process.env.AWS_SECRETACCESSKEY);

export const s3Configured = hasS3;

export const s3 = hasS3
	? new S3Client({
			region: process.env.S3_BUCKET_REGION,
			credentials: {
				accessKeyId: process.env.AWS_ACCESSKEYID,
				secretAccessKey: process.env.AWS_SECRETACCESSKEY,
			},
		})
	: null;

export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

const DEFAULT_LIMITS = { fileSize: 8 * 1024 * 1024, files: 5 };

const imageOnlyFilter = (req, file, cb) => {
	if (IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) return cb(null, true);
	const err = new Error("Only JPEG, PNG, WebP, GIF or HEIC images can be uploaded.");
	err.status = 400;
	cb(err);
};

/**
 * Use S3 when configured; otherwise memory storage so local API can boot without AWS.
 */
export function createUpload(options = {}) {
	const { key, metadata } = options;
	const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
	if (!hasS3) {
		return multer({
			storage: multer.memoryStorage(),
			limits,
			fileFilter: imageOnlyFilter,
		});
	}

	return multer({
		storage: multerS3({
			contentType: multerS3.AUTO_CONTENT_TYPE,
			s3,
			acl: "public-read",
			bucket: process.env.S3_BUCKET_NAME,
			...(metadata ? { metadata } : {}),
			key,
		}),
		limits,
		fileFilter: imageOnlyFilter,
	});
}
