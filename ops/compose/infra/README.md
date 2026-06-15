# statdash infra

Two-stack pattern: infra runs independently, app stack connects via `statdash-net`.

## Start (dev)

```bash
# 1. Copy and fill secrets
cp ops/config/db/.env.example ops/config/db/.env

# 2. Start infra (postgres + pgAdmin)
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/services/pgadmin.yml \
  up -d

# pgAdmin: http://localhost:5050
# postgres: localhost:5432

# 3. Start app
docker compose -f ops/compose/docker-compose.yml up
```

## Start (prod)

```bash
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/docker-compose.prod.yml \
  up -d

docker compose \
  -f ops/compose/docker-compose.yml \
  -f ops/compose/docker-compose.prod.yml \
  up -d
```

## Reset data

```bash
docker compose -f ops/compose/infra/docker-compose.base.yml down -v
```
