import pkg from "pg";
const { Pool } = pkg;

/**
 * Build a pg Pool config from env.
 * Railway public URLs include sslmode=require; newer pg treats that as verify-full,
 * which fails on Railway's proxy cert chain. We strip sslmode and set relaxed SSL.
 */
function poolConfigFromEnv() {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRIVATE_URL;
    if (url && String(url).trim()) {
        const raw = String(url).trim();
        const pgssl = process.env.PGSSL;

        let connectionString = raw;
        let urlWantsSsl = false;
        try {
            const u = new URL(raw);
            const sslmode = (u.searchParams.get("sslmode") || "").toLowerCase();
            urlWantsSsl = ["require", "verify-ca", "verify-full", "prefer", "true", "1"].includes(sslmode);
            // Drop sslmode so pg-connection-string does not force verify-full
            u.searchParams.delete("sslmode");
            u.searchParams.delete("uselibpqcompat");
            connectionString = u.toString();
        } catch {
            // non-URL connection strings fall through
        }

        const wantsSsl =
            pgssl === "1" ||
            pgssl === "true" ||
            process.env.NODE_ENV === "production" ||
            urlWantsSsl ||
            /\.rlwy\.net|\.railway\.(app|internal)/i.test(raw);

        return {
            connectionString,
            ssl:
                pgssl === "0" || pgssl === "false"
                    ? false
                    : wantsSsl
                      ? { rejectUnauthorized: false }
                      : undefined,
        };
    }
    return {
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    };
}

const pool = new Pool(poolConfigFromEnv());

pool.on("connect", () => {
    console.log("connection established.");
});

export default pool;
