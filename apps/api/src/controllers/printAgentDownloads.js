import { handleResponse } from "../util/handleresponse.js";
import {
    getMacosInstallCommandFileService,
    getMacosInstallScriptService,
    getPublicPrintAgentManifestService,
    openPrintAgentDownloadService,
    printAgentMacTerminalCommand,
} from "../models/printAgentDownloads.js";

export const publicGetPrintAgentLatest = async (_req, res) => {
    try {
        const data = await getPublicPrintAgentManifestService();
        data.macos_terminal_command = printAgentMacTerminalCommand();
        data.macos_install_script_url = `${(process.env.API_PUBLIC_URL || "https://api.shopynn.app").replace(/\/$/, "")}/api/public/print-agent/install-macos.sh`;
        res.set("Cache-Control", "public, max-age=60");
        return handleResponse(res, 200, "OK", data);
    } catch (err) {
        return handleResponse(res, err.status || 500, err.message || "Failed to load print agent manifest.", null);
    }
};

export const publicGetMacosInstallScript = async (_req, res) => {
    try {
        const script = getMacosInstallScriptService();
        res.set("Content-Type", "text/plain; charset=utf-8");
        res.set("Content-Disposition", 'inline; filename="install-macos.sh"');
        res.set("Cache-Control", "public, max-age=300");
        res.set("X-Content-Type-Options", "nosniff");
        return res.status(200).send(script);
    } catch (err) {
        return handleResponse(res, err.status || 500, err.message || "Script unavailable.", null);
    }
};

export const publicGetMacosInstallCommand = async (_req, res) => {
    try {
        const body = getMacosInstallCommandFileService();
        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", 'attachment; filename="Install Shopynn Print.command"');
        res.set("Cache-Control", "public, max-age=300");
        res.set("X-Content-Type-Options", "nosniff");
        return res.status(200).send(body);
    } catch (err) {
        return handleResponse(res, err.status || 500, err.message || "Helper unavailable.", null);
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
