import { Readable } from "stream";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
import { handleResponse } from "../util/handleresponse.js";
dotenv.config();

const s3 = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESSKEYID, 
        secretAccessKey: process.env.AWS_SECRETACCESSKEY
    }
})

export const uploadImages = multer({
    storage: multerS3({
        contentType: multerS3.AUTO_CONTENT_TYPE,
        s3: s3,
        acl: 'public-read',
        bucket: process.env.S3_BUCKET_NAME,
        metadata: function (req, file, cb) {
            // console.log('metax1 file',file);
            cb(null, {fieldName: file.fieldname});
        },
        key: function (req, file, cb) {
            // console.log('key file',file);
            cb(null, file.fieldname)
        }
    })
})

export const getImage = async (req, res) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: req.query.id
    }

    // console.log('image params',params);
    
    try {
        const command = new GetObjectCommand(params);
        const data = await s3.send(command);
        if(data && data.Body) {
            res.set("Content-Length",data.ContentLength)
                .set("Content-Type",data.ContentType);

            const readableStream = Readable.fromWeb(
                data.Body?.transformToWebStream()
            );

            readableStream.pipe(res);
        }
        else {
            // console.log('image data',data);
            handleResponse(res, 400, "Failed to load image", null);
        }
    }
    catch(err) {
        // console.log('image error',err);
        handleResponse(res, 500, "Failed to load image", null);
    }
}

export const saveImage = (req, res) => {
    try {
        if(req.files) {
            handleResponse(res, 200, "Image(s) upload success", {ids: req.files.map(file=> file.key)});
        }
        else {
            handleResponse(res, 400, "Failed", {});
        }
    } catch(err) {
        next(err);
    }
}