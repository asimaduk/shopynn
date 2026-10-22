import { PassThrough } from "stream";
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

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** Image type from the file's magic bytes, or null if it isn't one of the allowed formats. */
export function sniffImageType(head) {
	const ascii = (start, end) => head.subarray(start, end).toString("latin1");
	if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
	if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return "image/png";
	}
	if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
	if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
	if (ascii(4, 8) === "ftyp") {
		const brand = ascii(8, 12);
		if (HEIF_BRANDS.has(brand)) return brand === "mif1" || brand === "msf1" ? "image/heif" : "image/heic";
	}
	return null;
}

/**
 * S3 objects are public and served with the stored Content-Type, so it must come from the bytes,
 * not the client. SVG (scriptable), PDF, HTML etc. are rejected even when declared as an image.
 */
export function safeImageContentType(req, file, cb) {
	const reject = () => {
		const err = new Error("Only JPEG, PNG, WebP, GIF or HEIC images can be uploaded.");
		err.status = 400;
		cb(err);
	};
	let started = false;
	file.stream.once("end", () => {
		if (!started) reject();
	});
	file.stream.once("data", (firstChunk) => {
		started = true;
		const type = sniffImageType(firstChunk);
		if (!type) {
			file.stream.resume();
			return reject();
		}
		const out = new PassThrough();
		out.write(firstChunk);
		file.stream.pipe(out);
		cb(null, type, out);
	});
}

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
			contentType: safeImageContentType,
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
