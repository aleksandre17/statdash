#!/bin/sh
# pg_isready probe — exit 0 when Postgres accepts connections for the seeded
# DB/user. Used as the compose healthcheck (and runnable manually inside the
# container). POSTGRES_USER / POSTGRES_DB come from the container environment.
set -eu
pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
