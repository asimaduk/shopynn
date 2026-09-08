import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { handleResponse } from "../util/handleresponse.js";
import { createUpload, s3, s3Configured } from "../util/s3Upload.js";

dotenv.config();

export const uploadImages = createUpload({
	metadata: function (req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key: function (req, file, cb) {
		cb(null, file.fieldname);
	},
});

export const getImage = async (req, res) => {
	if (!s3Configured || !s3) {
		return handleResponse(res, 503, "File storage is not configured.", null);
	}

	const params = {
		Bucket: process.env.S3_BUCKET_NAME,
		Key: req.query.id,
	};

	try {
		const command = new GetObjectCommand(params);
		const data = await s3.send(command);
		if (data && data.Body) {
			res.set("Content-Length", data.ContentLength).set("Content-Type", data.ContentType);

			const readableStream = Readable.fromWeb(data.Body?.transformToWebStream());

			readableStream.pipe(res);
		} else {
			handleResponse(res, 400, "Failed to load image", null);
		}
	} catch (err) {
		handleResponse(res, 500, "Failed to load image", null);
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
