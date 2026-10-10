# Deployment

The simplest secure setup is **one origin**: the API serves the built SPA. Cookies stay first-party, CSRF origin checks are trivial and no CORS is involved.

## Single service (recommended)

Build and start command for Render, Railway, Fly.io, a VM, or a container:

```bash
npm ci
npm run build
SERVE_WEB_DIST=../web/dist npm start      # runs apps/api/dist/server.js
```

Environment (production):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string for a `readWrite` user on one database |
| `SESSION_SECRET` | 48+ random bytes (never the placeholder; startup refuses it) |
| `APP_ORIGINS` | `https://your-domain.example` (HTTPS required) |
| `TRUST_PROXY` | `1` behind one load balancer / platform proxy |
| `SERVE_WEB_DIST` | `../web/dist` (relative to `apps/api`) |
| `SESSION_STORE_AUTOREMOVE` | `native` |

The process listens on `PORT` (default 4000). Health check: `GET /api/v1/health`.

### Dockerfile example

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production SERVE_WEB_DIST=../web/dist
COPY --from=build /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

## Azure

The repository ships a production `Dockerfile` (API + SPA in one container, listens on `8080`, runs as non-root, has a health check).

### Database

Use **MongoDB Atlas on Azure** or **Azure Cosmos DB for MongoDB (vCore)**. If you use Cosmos DB for MongoDB **RU** instead, set `SESSION_STORE_AUTOREMOVE=interval`. RU accounts only support TTL on `_ts`, so the native session TTL index cannot be created there. Allow the app's outbound IPs (or a VNet / private endpoint) in the database firewall.

### Option A: Azure Container Apps (recommended)

```bash
az group create -n trackforge-rg -l eastus
az acr create -g trackforge-rg -n <acrname> --sku Basic
az acr build -r <acrname> -t trackforge:1 .
az containerapp env create -g trackforge-rg -n trackforge-env -l eastus
az containerapp create -g trackforge-rg -n trackforge --environment trackforge-env \
  --image <acrname>.azurecr.io/trackforge:1 --registry-server <acrname>.azurecr.io \
  --ingress external --target-port 8080 --min-replicas 1 --max-replicas 1 \
  --secrets mongo-uri='<connection string>' session-secret='<48+ random bytes>' \
  --env-vars MONGODB_URI=secretref:mongo-uri SESSION_SECRET=secretref:session-secret \
             APP_ORIGINS=https://<app>.<env>.<region>.azurecontainerapps.io
```

Add a custom domain afterwards and append it to `APP_ORIGINS`. Keep `--max-replicas 1` until rate limits use a shared store (see SECURITY.md).

### Option B: Azure App Service (Linux)

- **Custom container**: point the Web App at the image above and set the app setting `WEBSITES_PORT=8080`.
- **Code deploy (Node 22 LTS)**: deploy the repository source, *not* a locally built `node_modules`, because `argon2` is a native module and must be installed on Linux. Set the app setting `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (Oryx then runs `npm install` and `npm run build` on the server) and the startup command `npm start`. Alternatively, build in CI on `ubuntu-latest` and zip the result. App Service supplies `PORT` itself.

App settings for both: `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`, `APP_ORIGINS=https://<app>.azurewebsites.net`, `TRUST_PROXY=1`, `SERVE_WEB_DIST=../web/dist`. Set the health check path to `/api/v1/health`, and turn on **HTTPS Only**. Keep secrets in Key Vault references or app-setting secrets, never in the image.

## Separate web host (optional)

If the SPA is hosted elsewhere (e.g. a static host), keep both on the **same site** (`app.example.com` and `api.example.com`) so the `SameSite=Lax` cookie is sent, build the web app with `VITE_API_URL=https://api.example.com`, and set `APP_ORIGINS=https://app.example.com`. Cross-site deployments (different registrable domains) are not supported because the session cookie would be third-party.

## Checklist

- HTTPS everywhere; HSTS is enabled automatically in production.
- `TRUST_PROXY` matches your proxy count (needed for `Secure` cookies and per-IP rate limits).
- One API instance, or a shared rate-limit store before scaling out (see SECURITY.md).
- Atlas network allowlist, least-privilege user, backups enabled.
- Do not run `npm run seed` in production unless it is a deliberate demo (`ALLOW_SEED_IN_PRODUCTION=true`).
- `npm audit --omit=dev` clean; CI green against the MongoDB service container.
