#!/usr/bin/env node
/**
 * Publish Shopynn Print installers to object storage and refresh manifests.
 *
 * Client-facing URLs are always api.shopynn.app proxies — never raw bucket URLs.
 * Storage objects use private ACL; the API streams downloads with credentials.
 *
 * Prerequisites:
 *   - apps/api/.env with S3_BUCKET_NAME, S3_BUCKET_REGION (or S3_REGION), AWS_ACCESSKEYID, AWS_SECRETACCESSKEY
 *   - Built artifacts in packaging/dist/:
 *       ShopynnPrint-<version>.pkg
 *       ShopynnPrintSetup-<version>.exe
 *
 * Usage:
 *   node apps/print/packaging/publish-release.mjs
 *   node apps/print/packaging/publish-release.mjs --dry-run
 */
import { createHash } from "crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const printRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(printRoot, "../..");
const distDir = path.join(__dirname, "dist");
const webManifestDir = path.join(repoRoot, "apps/web/public/downloads/print-agent");
const webManifestPath = path.join(webManifestDir, "latest.json");
const dryRun = process.argv.includes("--dry-run");
const manifestOnly = process.argv.includes("--manifest-only");

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) return;
	const text = readFileSync(filePath, "utf8");
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadEnvFile(path.join(repoRoot, "apps/api/.env"));
loadEnvFile(path.join(repoRoot, ".env"));

const require = createRequire(path.join(repoRoot, "apps/api/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const pkg = JSON.parse(readFileSync(path.join(printRoot, "package.json"), "utf8"));
const version = String(pkg.version || "0.0.0");

const bucket = process.env.S3_BUCKET_NAME;
const region = process.env.S3_BUCKET_REGION || process.env.S3_REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESSKEYID;
const secretAccessKey = process.env.AWS_SECRETACCESSKEY;
const apiPublicOrigin = (process.env.API_PUBLIC_URL || "https://api.shopynn.app").replace(/\/$/, "");

if (!bucket || !accessKeyId || !secretAccessKey) {
	console.error(
		"Missing S3 credentials. Set S3_BUCKET_NAME, S3_BUCKET_REGION, AWS_ACCESSKEYID, AWS_SECRETACCESSKEY."
	);
	process.exit(1);
}

const ZADIG_URL = "https://zadig.akeo.ie/";
const PLATFORM_FILES = {
	macos: {
		filename: `ShopynnPrint-${version}.pkg`,
		contentType: "application/octet-stream",
		label: "macOS",
	},
	windows: {
		filename: `ShopynnPrintSetup-${version}.exe`,
		contentType: "application/octet-stream",
		label: "Windows",
	},
};

function sha256File(filePath) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("error", reject);
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}

function publicDownloadUrl(platform) {
	return `${apiPublicOrigin}/api/public/print-agent/download/${platform}`;
}

function s3Client() {
	return new S3Client({
		region,
		credentials: { accessKeyId, secretAccessKey },
	});
}

async function uploadBuffer(key, body, contentType, cacheControl) {
	if (dryRun) {
		console.log(`[dry-run] put s3://${bucket}/${key}`);
		return;
	}
	console.log(`Uploading ${key}…`);
	await s3Client().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: cacheControl,
		})
	);
	console.log(`Uploaded ${key}`);
}

async function uploadFile(key, filePath, contentType, cacheControl) {
	if (dryRun) {
		console.log(`[dry-run] put s3://${bucket}/${key} from ${filePath}`);
		return;
	}
	console.log(`Uploading ${key} from ${path.basename(filePath)}…`);
	await s3Client().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: createReadStream(filePath),
			ContentType: contentType,
			CacheControl: cacheControl,
		})
	);
	console.log(`Uploaded ${key}`);
}

const storagePlatforms = {};
const publicPlatforms = {};
const publishedAt = new Date().toISOString();

for (const [id, meta] of Object.entries(PLATFORM_FILES)) {
	const filePath = path.join(distDir, meta.filename);
	if (!existsSync(filePath)) {
		console.warn(`Skipping ${meta.label}: missing ${filePath}`);
		continue;
	}
	console.log(`Hashing ${meta.filename}…`);
	const sha256 = await sha256File(filePath);
	const size = statSync(filePath).size;
	const versionKey = `print-agent/${version}/${meta.filename}`;
	const latestKey = `print-agent/latest/${meta.filename}`;
	if (!manifestOnly) {
		await uploadFile(versionKey, filePath, meta.contentType, "private, max-age=31536000");
		await uploadFile(latestKey, filePath, meta.contentType, "private, max-age=300");
	} else {
		console.log(`--manifest-only: keeping existing object ${versionKey}`);
	}

	storagePlatforms[id] = {
		filename: meta.filename,
		storage_key: versionKey,
		sha256,
		size,
	};
	publicPlatforms[id] = {
		filename: meta.filename,
		url: publicDownloadUrl(id),
		sha256,
		size,
	};
	console.log(`${meta.label} ready → ${publicDownloadUrl(id)}`);
	console.log(`  sha256 ${sha256}`);
}

if (!Object.keys(storagePlatforms).length) {
	console.error("No installers found in packaging/dist. Build packages first.");
	process.exit(1);
}

const notes =
	"Install on the checkout PC with the USB thermal printer, then pair from Settings → Invoice & Receipt.";

/** Internal catalog (includes storage_key). Served only to the API. */
const storageManifest = {
	schema_version: 1,
	name: "Shopynn Print",
	version,
	published_at: publishedAt,
	zadig_url: ZADIG_URL,
	notes,
	platforms: storagePlatforms,
};

/** Client catalog — API proxy URLs only. */
const publicManifest = {
	schema_version: 1,
	name: "Shopynn Print",
	version,
	published_at: publishedAt,
	zadig_url: ZADIG_URL,
	notes,
	platforms: publicPlatforms,
};

const storageJson = `${JSON.stringify(storageManifest, null, 2)}\n`;
const publicJson = `${JSON.stringify(publicManifest, null, 2)}\n`;

mkdirSync(webManifestDir, { recursive: true });
writeFileSync(webManifestPath, publicJson, "utf8");
console.log(`Wrote ${webManifestPath}`);

await uploadBuffer(
	"print-agent/latest.json",
	Buffer.from(storageJson, "utf8"),
	"application/json; charset=utf-8",
	"private, max-age=60"
);
await uploadBuffer(
	`print-agent/${version}/latest.json`,
	Buffer.from(storageJson, "utf8"),
	"application/json; charset=utf-8",
	"private, max-age=31536000"
);

console.log(`API manifest: ${apiPublicOrigin}/api/public/print-agent/latest`);
console.log(dryRun ? "Dry run complete." : "Publish complete.");
