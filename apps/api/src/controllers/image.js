import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { handleResponse } from "../util/handleresponse.js";
import { createUpload, s3, s3Configured } from "../util/s3Upload.js";

dotenv.config();

const EXTENSION_BY_MIME = {
	"image/jpeg": ".jpg",
	"image/jpg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
	"image/gif": ".gif",
	"image/heic": ".heic",
	"image/heif": ".heif",
};

/** Keys are generated server-side so uploads can never overwrite another object. */
export const uploadImages = createUpload({
	metadata: function (req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key: function (req, file, cb) {
		const ext = EXTENSION_BY_MIME[String(file.mimetype || "").toLowerCase()] || "";
		cb(null, `tenants/${req.user.tenant_id}/images/${uuidv4()}${ext}`);
	},
});

const isReadableImageKey = (key) =>
	typeof key === "string" && key.length > 0 && key.length <= 512 && !key.includes("..") && !key.startsWith("/");

export const getImage = async (req, res) => {
	if (!s3Configured || !s3) {
		return handleResponse(res, 503, "File storage is not configured.", null);
	}
	if (!isReadableImageKey(req.query.id)) {
		return handleResponse(res, 400, "Invalid image id.", null);
	}

	const params = {
		Bucket: process.env.S3_BUCKET_NAME,
		Key: req.query.id,
	};

	try {
		const command = new GetObjectCommand(params);
		const data = await s3.send(command);
		if (data && data.Body) {
			const contentType = String(data.ContentType || "").toLowerCase();
			const safeInline = contentType.startsWith("image/") && !contentType.includes("svg");
			res.set("Content-Length", data.ContentLength)
				.set("Content-Type", data.ContentType)
				.set("X-Content-Type-Options", "nosniff")
				.set("Cache-Control", "public, max-age=86400");
			if (!safeInline) res.set("Content-Disposition", "attachment");

			const readableStream = Readable.fromWeb(data.Body?.transformToWebStream());

			readableStream.pipe(res);
		} else {
			handleResponse(res, 404, "Image not found", null);
		}
	} catch (err) {
		handleResponse(res, 404, "Image not found", null);
	}
};

export const saveImage = (req, res) => {
	try {
		if (!s3Configured) {
			return handleResponse(res, 503, "File uploads require S3 configuration.", null);
		}
		if (req.files) {
			handleResponse(res, 200, "Image(s) upload success", {
				ids: req.files.map((file) => file.key),
			});
		} else {
			handleResponse(res, 400, "Failed", {});
		}
	} catch (err) {
		handleResponse(res, 500, "Failed", null);
	}
};
