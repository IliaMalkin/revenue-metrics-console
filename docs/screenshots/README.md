Run the screenshot capture after PostgreSQL has been started, migrated, and seeded:

```powershell
docker compose up -d
pnpm --filter server db:migrate
pnpm --filter server db:seed
pnpm --filter client screenshots
```

The script writes:

- `docs/screenshots/overview.png`
- `docs/screenshots/cohorts.png`
- `docs/screenshots/admin.png`
- `docs/screenshots/overview-dark.png`

Screenshots can also be regenerated in CI via the manual `Screenshots` workflow (Actions tab), which boots a seeded Postgres service and uploads the PNGs as an artifact.
