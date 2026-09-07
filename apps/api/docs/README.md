# IMS API Documentation

This folder contains API documentation for the Inventory Management System (IMS) backend.

## Files

| File | Description |
|------|-------------|
| **API.md** | Human-readable API reference: all endpoints, methods, paths, auth requirements, and common query parameters. |
| **openapi.yaml** | OpenAPI 3.0 specification for the API. Use with Swagger UI, Postman, or other tools. |

## Base URL

All endpoints are under the `/api` prefix. Example: `https://your-host.com/api/users/login`.

## Authentication

- **Login:** `POST /api/users/login` with `{ "email", "password" }` returns a JWT in `data.token`.
- **Authenticated requests:** Send the token in the header:  
  `Authorization: Bearer <token>`
- Many routes also require an **active subscription** for the tenant.

## Using the OpenAPI spec

- **Swagger UI:** Serve `openapi.yaml` and point Swagger UI at it (or use a relative path). Set the server URL to your API base (e.g. `https://your-host.com/api`).
- **Postman:** Import → Link → paste the path to `openapi.yaml` or import the file. Configure the collection auth to Bearer Token and use your JWT.
- **Other tools:** Any OpenAPI 3.0–compatible client or mock server can use `openapi.yaml`.

## Response format

All JSON responses use:

```json
{
  "status": 200,
  "message": "Description",
  "data": { ... }
}
```

Errors use the same structure with a 4xx/5xx `status` and an appropriate `message`.
