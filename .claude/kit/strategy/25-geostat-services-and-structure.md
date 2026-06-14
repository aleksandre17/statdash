# geostat-chat-ai: Services & Project Structure

**Reconnaissance:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## Four Deployable Services

### 1. chat-api (Port 8090)

**Role:** `api` · **Type:** `java-boot`  
**Path:** `apps/backend`

**Manifest:**
```json
{
  "role": "api",
  "type": "java-boot",
  "path": "apps/backend",
  "secretsModule": "backend",
  "spring": {
    "applicationName": "geostat-chat-ai",
    "defaultProfile": "local",
    "portEnv": "API_PORT"
  },
  "hybrid": {
    "bootJar": "apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar"
  }
}
```

**Responsibilities:**
- BFF (Backend for Frontend) — REST API for UI
- RAG orchestration — Query retrieval, Gemini calls
- SSE streaming — Streaming responses to frontend
- Spring Security — API key enforcement (internal + admin)

### 2. retrieval-service (Port 8092)

**Role:** `api` · **Type:** `java-boot`  
**Path:** `apps/retrieval-service`

**Responsibilities:**
- Hybrid search — BM25 + semantic similarity
- RRF (Reciprocal Rank Fusion) — Combine dense + sparse results
- MMR (Maximal Marginal Relevance) — De-duplicate similar chunks
- Qdrant client — Vector search gRPC calls

### 3. ingestion-service (Port 8093)

**Role:** `worker` · **Type:** `java-boot`  
**Path:** `apps/ingestion-service`

**Responsibilities:**
- Crawl → Parse → Chunk
- Embedding (via Spring AI + text-embedding-004)
- Index to Qdrant + PostgreSQL
- Metadata enrichment (LLM-driven)
- Optional RabbitMQ async (P5 roadmap)

### 4. frontend (Port 5177)

**Role:** `ui` · **Type:** `node-vite`  
**Path:** `apps/frontend`

**Manifest:**
```json
{
  "role": "ui",
  "type": "node-vite",
  "path": "apps/frontend",
  "secretsModule": "frontend",
  "debug": { "npmScript": "dev" }
}
```

**Stack:**
- React 19 + Vite
- TypeScript
- Tailwind CSS
- react-router-dom
- react-markdown + rehype (for LLM responses)
- Voice I/O (Google Cloud Speech API)
- Admin UI (curation, corpus management)

## No Traditional Monorepo Structure

**Why NOT at root:**
- No `package.json` — each service owns build
- No `tsconfig.json` — frontend only
- No shared `node_modules` — independent installs
- No ESLint/Vitest at root — per-app tooling

**Why this works:**
- **Heterogeneous** — Java + Node in one repo
- **Deploy-independent** — Each service builds/deploys separately
- **Kit-transparent** — Ops layer treats services as opaque
- **Build order** — No monorepo workspace linking

## Build Artifact Locations

| Service | Build Command | Output |
|---------|---------------|--------|
| chat-api | `./gradlew :chat-api:bootJar` | `apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar` |
| retrieval | `./gradlew :retrieval-service:bootJar` | `apps/retrieval-service/build/libs/retrieval-service-0.1.0-SNAPSHOT.jar` |
| ingestion | `./gradlew :ingestion-service:bootJar` | `apps/ingestion-service/build/libs/ingestion-service-0.1.0-SNAPSHOT.jar` |
| frontend | `npm run build` | `apps/frontend/dist/` |

## Shared Libraries (Clean Arch)

**Path:** `libs/`

```
libs/
├── platform-contracts/       (Shared ports, DTOs, exceptions)
├── embedding-adapters/       (Spring AI wrappers, Gemini/embedding-004)
└── qdrant-client/           (gRPC client, query builders)
```

**Law:** Application layer imports domain ports only. Never infrastructure concrete types.

**Examples:**
- `chat-api` imports `platform-contracts` (search result port) not `qdrant-client` directly
- `retrieval-service` imports `platform-contracts` and `qdrant-client` (internal impl)
- Both import `embedding-adapters` for common embedding logic

## Secrets & Configuration

### ops/config/ Structure

```
ops/config/
├── backend/
│   ├── .env.dev             (SPRING_PROFILES_ACTIVE=dev, local DB URL)
│   ├── .env.prod            (SPRING_PROFILES_ACTIVE=prod, Gemini key)
│   ├── .env.deploy          (DEPLOY_SERVER, DEPLOY_PATH, SSH config)
│   └── google-credentials.json
├── frontend/
│   ├── .env.dev             (VITE_API_URL=http://localhost:8090)
│   ├── .env.prod            (VITE_API_URL=https://api.example.com)
│   ├── nginx.env            (CSP headers, CORS, cache policy)
│   └── nginx.conf.template
├── retrieval/
│   ├── .env.dev
│   └── .env.prod
├── ingestion/
│   ├── .env.dev
│   └── .env.prod
└── deploy.env               (DEPLOY_SERVER, DEPLOY_USER, SSH KEY)
```

**All gitignored** — examples in `ops/config/*.example`

### GCP Credentials Strategy

**Manifest:**
```json
{
  "features": { "gcpCredentials": true },
  "adapters": {
    "gcp": {
      "credentialsFile": "google-credentials.json",
      "containerMount": "/app/google-credentials.json",
      "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
    }
  }
}
```

**Python Resolution:**
```python
def global_gcp_credentials(manifest):
    if manifest["features"]["gcpCredentials"]:
        return [{
            "file": "google-credentials.json",
            "mount": "/app/google-credentials.json",
            "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
        }]
    return []
```

All JVM api/worker modules auto-mount GCP creds if feature enabled. No per-module duplication.

## Dockerfile Strategy

### Backend (Java)

```dockerfile
# Dockerfile.dev
FROM gradle:latest
WORKDIR /app
COPY . .
RUN ./gradlew bootRun -x test

# Dockerfile (prod)
FROM eclipse-temurin:21-jdk as builder
WORKDIR /app
COPY . .
RUN ./gradlew bootJar -x test

FROM eclipse-temurin:21-jre
COPY --from=builder /app/build/libs/app.jar /app/app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

### Frontend (Node)

```dockerfile
# Dockerfile (base)
FROM node:20 AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:latest AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

Dockerfile location resolved by driver at compose-gen time.
