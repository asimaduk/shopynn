import pkg from "pg";
const { Pool } = pkg;

function poolConfigFromEnv() {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRIVATE_URL;
    if (url && String(url).trim()) {
        return {
            connectionString: String(url).trim(),
            // Railway / managed Postgres often need SSL in production
            ssl: process.env.PGSSL === "0" || process.env.PGSSL === "false"
                ? false
                : process.env.NODE_ENV === "production"
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
