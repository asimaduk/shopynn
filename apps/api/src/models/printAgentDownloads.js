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

export function printAgentMacInstallScriptUrl() {
    return `${apiPublicOrigin()}/api/public/print-agent/install-macos.sh`;
}

export function printAgentMacInstallCommandUrl() {
    return `${apiPublicOrigin()}/api/public/print-agent/install-macos.command`;
}

/** One-liner merchants paste into Terminal.app (curl is not Gatekeeper-quarantined). */
export function printAgentMacTerminalCommand() {
    return `curl -fsSL ${printAgentMacInstallScriptUrl()} | bash`;
}

/** Embedded so Railway (apps/api-only deploy) can serve it without apps/print. */
export function getMacosInstallScriptService() {
    const api = apiPublicOrigin();
    return `#!/usr/bin/env bash
# Shopynn Print — macOS install helper (avoids Gatekeeper quarantine from browser downloads).
# Run in Terminal.app:
#   curl -fsSL ${api}/api/public/print-agent/install-macos.sh | bash
set -euo pipefail

API_BASE="\${SHOPYNN_API_BASE:-${api}}"
API_BASE="\${API_BASE%/}"
DOWNLOAD_URL="\${API_BASE}/api/public/print-agent/download/macos"
WORKDIR="\${TMPDIR:-/tmp}/shopynn-print-install-$$"
PKG="\${WORKDIR}/ShopynnPrint.pkg"
KEEP="\${HOME}/Downloads/ShopynnPrint-install.pkg"

cleanup() { rm -rf "\${WORKDIR}" 2>/dev/null || true; }
trap cleanup EXIT

mkdir -p "\${WORKDIR}"
echo "Downloading Shopynn Print…"
if ! curl -fL --progress-bar -o "\${PKG}" "\${DOWNLOAD_URL}"; then
  echo "Download failed. Check your internet connection and try again." >&2
  exit 1
fi

xattr -cr "\${PKG}" 2>/dev/null || true
mkdir -p "\${HOME}/Downloads"
cp "\${PKG}" "\${KEEP}"
xattr -cr "\${KEEP}" 2>/dev/null || true

echo "Opening the installer…"
open "\${KEEP}"

echo ""
echo "Installer opened. Finish the prompts (admin password), then in Shopynn:"
echo "  Settings → Invoice & Receipt → enter this Mac's LAN IP → pair → save."
echo "Package saved at: \${KEEP}"
`;
}

export function getMacosInstallCommandFileService() {
    const api = apiPublicOrigin();
    return `#!/bin/bash
# Double-click to install Shopynn Print (opens Terminal).
# If macOS blocks this file once: Control-click → Open → Open.
curl -fsSL "${api}/api/public/print-agent/install-macos.sh" | bash
echo ""
read -r -p "Press Return to close…"
`;
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
