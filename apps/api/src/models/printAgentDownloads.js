/**
 * Shopynn Print installer catalog. Binaries stay in private object storage;
 * clients only see api.shopynn.app download URLs.
 */

import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, s3Configured } from "../util/s3Upload.js";

const MANIFEST_KEY = "print-agent/latest.json";
const PLATFORMS = new Set(["macos", "windows"]);

const apiPublicOrigin = () =>
    (process.env.API_PUBLIC_URL || "https://api.shopynn.app").replace(/\/$/, "");

export function printAgentDownloadPublicUrl(platform) {
    return `${apiPublicOrigin()}/api/public/print-agent/download/${encodeURIComponent(platform)}`;
}

export function printAgentManifestPublicUrl() {
    return `${apiPublicOrigin()}/api/public/print-agent/latest`;
}

function toPublicPlatform(platformId, row) {
    if (!row || !row.filename) return null;
    return {
        filename: String(row.filename),
        url: printAgentDownloadPublicUrl(platformId),
        sha256: row.sha256 ? String(row.sha256) : undefined,
        size: Number(row.size) > 0 ? Number(row.size) : undefined,
    };
}

/** Strip storage keys / raw object URLs before returning to browsers. */
export function toPublicPrintAgentManifest(raw) {
    if (!raw || typeof raw !== "object") return null;
    const platforms = {};
    for (const id of PLATFORMS) {
        const pub = toPublicPlatform(id, raw.platforms?.[id]);
        if (pub) platforms[id] = pub;
    }
    return {
        schema_version: Number(raw.schema_version) || 1,
        name: String(raw.name || "Shopynn Print"),
        version: String(raw.version || ""),
        published_at: raw.published_at || undefined,
        zadig_url: raw.zadig_url || "https://zadig.akeo.ie/",
        notes: raw.notes || undefined,
        platforms,
    };
}

async function readManifestObject() {
    if (!s3Configured || !s3) {
        const err = new Error("File storage is not configured.");
        err.status = 503;
        err.code = "STORAGE_UNAVAILABLE";
        throw err;
    }
    const data = await s3.send(
        new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: MANIFEST_KEY,
        })
    );
    const body = await data.Body?.transformToString?.();
    if (!body) {
        const err = new Error("Print agent manifest not found.");
        err.status = 404;
        err.code = "MANIFEST_NOT_FOUND";
        throw err;
    }
    return JSON.parse(body);
}

export async function getPublicPrintAgentManifestService() {
    const raw = await readManifestObject();
    const pub = toPublicPrintAgentManifest(raw);
    if (!pub?.version) {
        const err = new Error("Print agent manifest is invalid.");
        err.status = 500;
        throw err;
    }
    return pub;
}

export async function openPrintAgentDownloadService(platform) {
    const id = String(platform || "").toLowerCase().trim();
    if (!PLATFORMS.has(id)) {
        const err = new Error("Unknown platform. Use macos or windows.");
        err.status = 400;
        err.code = "INVALID_PLATFORM";
        throw err;
    }

    const raw = await readManifestObject();
    const row = raw?.platforms?.[id];
    const storageKey = String(row?.storage_key || "").trim();
    if (!row || !storageKey) {
        const err = new Error(`No ${id} installer published yet.`);
        err.status = 404;
        err.code = "INSTALLER_NOT_FOUND";
        throw err;
    }

    const data = await s3.send(
        new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: storageKey,
        })
    );
    if (!data?.Body) {
        const err = new Error("Installer file not found.");
        err.status = 404;
        throw err;
    }

    const stream = Readable.fromWeb(data.Body.transformToWebStream());
    return {
        stream,
        filename: String(row.filename || `ShopynnPrint-${id}`),
        contentType: data.ContentType || "application/octet-stream",
        contentLength: data.ContentLength,
        sha256: row.sha256 ? String(row.sha256) : null,
    };
}
