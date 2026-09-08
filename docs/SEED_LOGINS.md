# Shopynn local seed logins

Local-only accounts from the API seed scripts. Do not use these passwords in production.

| Role | Email | Password | Seed command |
|------|-------|----------|--------------|
| Platform admin | `admin@shopynn.local` | `Admin1234!` | `npm run seed:admin -w @shopynn/api` |
| Merchant manager | `manager@shopynn.local` | `Manager1234!` | `npm run seed:merchants -w @shopynn/api` |
| Field agent | `agent@shopynn.local` | `Agent1234!` | `npm run seed:merchants -w @shopynn/api` |
| Test shop owner | `test@shopynn.local` | `Test1234!` | `npm run seed:test -w @shopynn/api` |

## Notes

- Web: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:4001`
- Mobile (simulator) uses `http://127.0.0.1:4001/api` in `__DEV__`
- After re-seeding roles/permissions, sign out and sign back in
