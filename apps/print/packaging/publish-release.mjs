#!/usr/bin/env node
/**
 * Publish Shopynn Print installers to S3 and refresh the in-app manifest.
 *
 * Prerequisites:
 *   - apps/api/.env with S3_BUCKET_NAME, S3_BUCKET_REGION (or S3_REGION), AWS_ACCESSKEYID, AWS_SECRETACCESSKEY
 *   - Built artifacts in packaging/dist/:
 *       ShopynnPrint-<version>.pkg
 *       ShopynnPrintSetup-<version>.exe
 *
 * Usage (from repo root or apps/print):
 *   node apps/print/packaging/publish-release.mjs
 *   node apps/print/packaging/publish-release.mjs --dry-run
 */
import { createHash } from "crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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

function publicObjectUrl(key) {
	const encoded = key.split("/").map(encodeURIComponent).join("/");
	if (region === "us-east-1") {
		return `https://${bucket}.s3.amazonaws.com/${encoded}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

async function uploadBuffer(key, body, contentType, cacheControl) {
	if (dryRun) {
		console.log(`[dry-run] put s3://${bucket}/${key} (${body.length || body.byteLength || "stream"} bytes)`);
		return publicObjectUrl(key);
	}
	const client = new S3Client({
		region,
		credentials: { accessKeyId, secretAccessKey },
	});
	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
			ACL: "public-read",
			CacheControl: cacheControl,
		})
	);
	return publicObjectUrl(key);
}

async function uploadFile(key, filePath, contentType, cacheControl) {
	if (dryRun) {
		console.log(`[dry-run] put s3://${bucket}/${key} from ${filePath}`);
		return publicObjectUrl(key);
	}
	const client = new S3Client({
		region,
		credentials: { accessKeyId, secretAccessKey },
	});
	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: createReadStream(filePath),
			ContentType: contentType,
			ACL: "public-read",
			CacheControl: cacheControl,
		})
	);
	return publicObjectUrl(key);
}

const platforms = {};
const publishedAt = new Date().toISOString();

for (const [id, meta] of Object.entries(PLATFORM_FILES)) {
	const filePath = path.join(distDir, meta.filename);
	if (!existsSync(filePath)) {
		console.warn(`Skipping ${meta.label}: missing ${filePath}`);
		continue;
	}
	const sha256 = await sha256File(filePath);
	const versionKey = `print-agent/${version}/${meta.filename}`;
	const latestKey = `print-agent/latest/${meta.filename}`;
	const url = await uploadFile(
		versionKey,
		filePath,
		meta.contentType,
		"public, max-age=31536000, immutable"
	);
	await uploadFile(latestKey, filePath, meta.contentType, "public, max-age=300");
	platforms[id] = {
		filename: meta.filename,
		url,
		sha256,
		size: require("fs").statSync(filePath).size,
	};
	console.log(`Uploaded ${meta.label}: ${url}`);
	console.log(`  sha256 ${sha256}`);
}

if (!platforms.macos && !platforms.windows) {
	console.error("No installers found in packaging/dist. Build packages first.");
	process.exit(1);
}

const manifest = {
	schema_version: 1,
	name: "Shopynn Print",
	version,
	published_at: publishedAt,
	zadig_url: ZADIG_URL,
	notes:
		"Install on the checkout PC with the USB thermal printer, then pair from Settings → Invoice & Receipt.",
	platforms,
};

const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
mkdirSync(webManifestDir, { recursive: true });
writeFileSync(webManifestPath, manifestJson, "utf8");
console.log(`Wrote ${webManifestPath}`);

const manifestUrl = await uploadBuffer(
	"print-agent/latest.json",
	Buffer.from(manifestJson, "utf8"),
	"application/json; charset=utf-8",
	"public, max-age=60"
);
await uploadBuffer(
	`print-agent/${version}/latest.json`,
	Buffer.from(manifestJson, "utf8"),
	"application/json; charset=utf-8",
	"public, max-age=31536000, immutable"
);

console.log(`Manifest CDN: ${manifestUrl}`);
console.log(dryRun ? "Dry run complete." : "Publish complete.");
