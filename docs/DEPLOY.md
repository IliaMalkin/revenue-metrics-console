# Deployment

## Path A: Fly.io server + Vercel client

1. Provision a PostgreSQL database and set the server environment variables from `packages/server/.env.example`.
2. Deploy `packages/server` as the Node/Express API.
3. Set the client deployment's API proxy or environment routing so `/api` and `/ws` reach the server.
4. Deploy `packages/client` to Vercel with `pnpm --filter client build`.

## Path B: Local full stack

```powershell
pnpm install
docker compose up -d
Copy-Item packages/server/.env.example packages/server/.env
pnpm --filter server db:migrate
pnpm --filter server db:seed
pnpm dev
```

Open `http://localhost:5173`.
