import { handleResponse } from "../util/handleresponse.js";
import {
    getPublicPrintAgentManifestService,
    openPrintAgentDownloadService,
} from "../models/printAgentDownloads.js";

export const publicGetPrintAgentLatest = async (_req, res) => {
    try {
        const data = await getPublicPrintAgentManifestService();
        res.set("Cache-Control", "public, max-age=60");
        return handleResponse(res, 200, "OK", data);
    } catch (err) {
        return handleResponse(res, err.status || 500, err.message || "Failed to load print agent manifest.", null);
    }
};

export const publicDownloadPrintAgent = async (req, res) => {
    try {
        const file = await openPrintAgentDownloadService(req.params.platform);
        res.set("Content-Type", file.contentType);
        res.set("Content-Disposition", `attachment; filename="${file.filename.replace(/"/g, "")}"`);
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Cache-Control", "private, max-age=300");
        if (file.contentLength != null) res.set("Content-Length", String(file.contentLength));
        if (file.sha256) res.set("X-Checksum-SHA256", file.sha256);
        file.stream.on("error", () => {
            if (!res.headersSent) res.status(500).end();
            else res.destroy();
        });
        file.stream.pipe(res);
    } catch (err) {
        if (res.headersSent) {
            res.destroy();
            return;
        }
        return handleResponse(res, err.status || 500, err.message || "Download failed.", null);
    }
};
