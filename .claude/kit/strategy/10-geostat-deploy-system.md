# geostat-chat-ai: SSH/Docker Deploy Pipeline

**Reconnaissance:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## The 5-Step Deploy Orchestration

**File:** `kits/geostat-kit/toolkit/deploy/` — modular, bash-based, SSH-native.

### Step 1: Local Gradle Build
**Script:** `gradle-build.sh`

```bash
./gradlew build -x test --info
# Output: apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar
```
Runs on **developer machine**. No remote access yet.

### Step 2: JAR Metadata Preparation
**Script:** `jar-prepare.sh`

Extract version, size, checksum. Create deploy metadata.

### Step 3: SCP Upload to Server
**Script:** `upload.sh` (69 lines)

```bash
ssh -n "$SERVER" "mkdir -p '$DEPLOY_PATH/logs' '$DEPLOY_PATH/versions'"

scp "$JAR_SRC" "$SERVER:$DEPLOY_PATH/app.jar"
scp "$SECRETS_DIR/.env.prod" "$SERVER:$DEPLOY_PATH/.env.prod"
scp "$SECRETS_DIR/google-credentials.json" "$SERVER:$DEPLOY_PATH/"

# Keep last N versions for rollback
cp '$DEPLOY_PATH/app.jar' '$DEPLOY_PATH/versions/app-20260614.jar'
ls -t '$DEPLOY_PATH/versions/app-*.jar' | tail -n +6 | xargs rm -f
```

**Structured Deploy Path:**
```
/opt/deploy/runtime/chat-api/
├── app.jar
├── Dockerfile
├── .env.prod
├── google-credentials.json
├── versions/
│   ├── app-20260614.jar
│   ├── app-20260613.jar
│   └── app-20260612.jar
└── logs/
    ├── deploy.log
    ├── build.log
    └── upload.log
```

### Step 4: Compose Generation on Server
**Script:** `server-compose.sh`

SSH into server, generate `docker-compose.prod.yml`:

```bash
ssh "$SERVER" "cat > '$DEPLOY_PATH/docker-compose.prod.yml'" <<EOF
services:
  chat-api:
    image: geostat-chat-ai-backend:prod
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "\${API_PORT:-8090}:8090"
    env_file:
      - .env.prod
    volumes:
      - ./google-credentials.json:/app/google-credentials.json:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8090/actuator/health | grep -q UP || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 90s
EOF
```

### Step 5: Docker Compose Up with Health Check
**Script:** `docker-up.sh` (102 lines)

```bash
ssh "$SERVER" "
  cd '$DEPLOY_PATH'
  docker compose -f docker-compose.prod.yml up -d --build
"

# Poll health (10s intervals, HEALTH_RETRIES times)
for i in $(seq 1 "$HEALTH_RETRIES"); do
  status=$(ssh -n "$SERVER" "docker inspect --format='{{.State.Health.Status}}' chat-api")
  case "$status" in
    healthy)
      echo "[OK] chat-api healthy"
      break
      ;;
    unhealthy)
      echo "[FAIL] chat-api unhealthy - ROLLBACK"
      ssh "$SERVER" "
        cp '$DEPLOY_PATH/versions/app-previous.jar' '$DEPLOY_PATH/app.jar'
        docker compose -f docker-compose.prod.yml up -d --build
      "
      break
      ;;
  esac
  sleep 10
done
```

**Automatic Rollback:** If health check fails in prod, restore previous JAR version and restart.

## Remote Dev Watch (Live Reload)

**Script:** `dev-remote.sh` (310 lines)

For real-time backend development on remote Linux server.

### Flow

1. **rsync source** to server workspace
   ```bash
   rsync -avz --exclude='build' --exclude='.git' \
     /Windows/path/ deploy@host:/opt/deploy/runtime/chat-api/workspace/
   ```

2. **Generate workspace compose** on server
   ```dockerfile
   FROM gradle:latest
   WORKDIR /app
   COPY . .
   RUN ./gradlew bootRun -x test --no-daemon
   ```

3. **Poll for changes** (debounced 1500ms)
   ```bash
   while true; do
     if find src/ -name '*.java' -mmin -0.05 2>/dev/null | grep -q .; then
       rsync ... && docker compose restart
     fi
     sleep 0.5
   done
   ```

**Result:** Code change in IDE → file save → rsync to server → gradlew restart → updated in ~3s.

## SSH Configuration

**Source:** `ops/config/deploy.env` (gitignored)

```bash
DEPLOY_SERVER=deploy@example.com     # SSH host
DEPLOY_USER=deploy
DEPLOY_PATH=/opt/deploy              # Remote root
DEPLOY_LAYOUT=structured             # Use /runtime/{module-id}/ structure
DEPLOY_ENVIRONMENT=prod              # Compose file: docker-compose.prod.yml
VERSIONS_KEEP=5                       # Keep last 5 JARs
HEALTH_RETRIES=24                    # 24 * 10s = 240s timeout
```

**Requirement:** Passwordless SSH via `~/.ssh/config` or agent.

## Why This Architecture?

1. **Modular steps** — each script is independent; can re-run step 3 without rebuilding
2. **Audit trail** — all operations logged to `$DEPLOY_PATH/logs/`
3. **Rollback-ready** — previous versions stored, quick restore
4. **Health-gated** — deployment pauses until service is healthy or times out
5. **Cross-platform** — bash on Linux + Windows (Git Bash)
