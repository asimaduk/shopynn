// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Lovable's built-in nitro defaults to cloudflare-module + a forced `dist/` layout.
// On Vercel we need plain `nitro()` so it selects the vercel preset and writes
// `.vercel/output` (Build Output API). Keep Lovable nitro off outside Vercel.
const onVercel = Boolean(process.env.VERCEL);

const viteWebAppUrl = process.env.VITE_WEB_APP_URL?.replace(/\/$/, "") ?? "";
const viteApiBaseUrl = process.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

if (onVercel && (!viteWebAppUrl || !viteApiBaseUrl)) {
	throw new Error(
		`Missing Vercel env for @shopynn/site build. Set VITE_WEB_APP_URL and VITE_API_BASE_URL on the shopynn-site project, then Redeploy (env is baked in at build time). Got WEB=${JSON.stringify(viteWebAppUrl)} API=${JSON.stringify(viteApiBaseUrl)}`,
	);
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
	tanstackStart: {
		server: { entry: "server" },
	},
	nitro: false,
	plugins: onVercel ? [nitro()] : [],
	// On Vercel, bake dashboard env into the client bundle (Vite inlines import.meta.env at build time).
	// Locally, leave Lovable's loadEnv(.env) alone.
	vite: onVercel
		? {
				define: {
					"import.meta.env.VITE_WEB_APP_URL": JSON.stringify(viteWebAppUrl),
					"import.meta.env.VITE_API_BASE_URL": JSON.stringify(viteApiBaseUrl),
				},
			}
		: {},
});
