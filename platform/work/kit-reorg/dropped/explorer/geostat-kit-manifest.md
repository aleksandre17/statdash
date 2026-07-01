---
name: geostat-kit-manifest
description: geostat.ops.json manifest schema and configuration structure
metadata:
  type: reference
---

# geostat.ops.json — Manifest Structure

Single source of truth (v2) that drives all kit operations. No app constants or module IDs hardcoded in kit runtime.

## Root Schema

```json
{
  "version": 2,
  "package": "kits/geostat-kit",         // kit location (submodule)
  "secrets": "ops/config",               // secrets root (per-module subfolders)
  "features": { "gcpCredentials": true },

  "compose": {
    "catalog": "ops/compose/catalog.json",    // consumer compose templates
    "syncModules": "apps/backend/ops.modules" // gradle module sync
  },

  "stack": {
    "composeDir": "ops/compose/stack",
    "composeModules": ["chat-api", "retrieval", "ingestion", "frontend"],
    "deployBaseSecretsModule": "chat-api",    // DEPLOY_PATH base
    "networkName": "geostat-chat-ai-net",
    "infraComposeDir": "ops/compose/infra",
    "infra": {
      "services": ["postgres", "redis", "qdrant", "rabbitmq", "prometheus", "grafana", "loki", "tempo", "pgbouncer", "minio"]
    }
  },

  "cli": {
    "aliases": {
      "fe": "frontend",
      "be": "chat-api",
      "ret": "retrieval",
      "ing": "ingestion"
    }
  },

  "modules": { /* module definitions */ },
  "adapters": { /* integrations: gcp, nginx, embed */ },
  "ci": { /* ci/cd script references */ },
  "vscode": { /* vs code launch config */ }
}
```

## Module Definition

```json
"modules": {
  "chat-api": {
    "role": "api|worker|ui|gateway|data|other",
    "type": "java-boot|node-vite|node-api|...",
    "path": "apps/backend",                    // app source location
    "secretsModule": "backend",                // ops/config/<name>
    "target": "chat-api",                      // docker-compose service slug
    
    "hybrid": {
      "springProfiles": "local",               // SPRING_PROFILES_ACTIVE
      "preferJar": true,                       // use pre-built JAR
      "bootJar": "apps/backend/build/libs/..."
    },
    
    "debug": {
      "npmScript": "dev",
      "java": { "mainClass": "...", "projectName": "..." }
    },
    
    "configGen": {
      "mode": "simple|postgres-profiles|env-profiles"
    },
    
    "spring": {
      "applicationName": "geostat-chat-ai",
      "defaultProfile": "local",
      "portEnv": "API_PORT",
      "profileGroups": {
        "hybrid": ["db", "hybrid-env"],
        "docker": ["db", "docker-env"]
      },
      "envProfiles": {
        "dev": { "envFile": ".env.dev", "devtools": true },
        "prod": { "envFile": ".env.prod", "prodLogging": true }
      }
    },
    
    "datastores": {
      "postgres": { "schema": "ingestion", "database": "geostat", "flyway": true },
      "qdrant": { "optional": true },
      "rabbitmq": { "optional": true },
      "events": { "enabledEnv": "INGESTION_EVENTS_ENABLED" }
    },
    
    "credentials": [
      {
        "file": "google-credentials.json",
        "mount": "/app/google-credentials.json",
        "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
      }
    ],
    
    "catalog": {
      "sourceEnv": "GEOSTAT_CHAT_CATALOG_SOURCE",
      "defaultSource": "derived|yaml",
      "presentationResources": ["topic-style.yaml", "terminology-overlay.yaml"]
    },
    
    "derivation": {
      "phase": "P1",
      "planDoc": "docs/app/plan/PHASE-8.md",
      "flywayRange": "V9-V43",
      "enrichment": {
        "enabledEnv": "INGESTION_ENRICHMENT_ENABLED",
        "chatModelEnv": "INGESTION_ENRICHMENT_CHAT_MODEL",
        "defaultChatModel": "gemini-2.5-flash-lite"
      }
    }
  }
}
```

## Adapters & CI

```json
"adapters": {
  "gcp": {
    "credentialsFile": "google-credentials.json",
    "containerMount": "/app/google-credentials.json"
  },
  "nginx": {
    "template": "apps/frontend/nginx.conf.template",
    "output": "apps/frontend/nginx.conf",
    "envExample": "ops/config/frontend/nginx.env.example"
  }
},

"ci": {
  "integration": "ops/ci/integration-stack.sh",
  "prepareEnv": "kits/geostat-kit/ci/prepare-integration-env.sh",
  "waitHealth": "kits/geostat-kit/ci/wait-health.sh",
  "ragSmoke": "ops/ci/rag-pipeline-smoke.sh",
  "chatDerivedCatalogSmoke": "ops/ci/chat-derived-catalog-smoke.ps1",
  "ragEvalGate": "ops/ci/rag-eval-gate.ps1",
  "ragP1Cutover": "ops/ci/rag-p1-cutover.ps1",
  "healthModules": ["chat-api", "retrieval", "ingestion"]
},

"vscode": {
  "folder": ".vscode",
  "geostatScript": "tools/geostat.ps1"
}
```

## Design Rules

1. **No module ID hardcodes in kit** — all resolved via ProjectContext query
2. **No port defaults in code** — use manifest `portEnv` (e.g., `API_PORT`)
3. **No role assumptions** — lookup `modules.<id>.role`
4. **Credentials isolated per-module** — global GCP fallback only if no override
5. **Deploy paths structured** — inherit from `deployBaseSecretsModule` (DEPLOY_PATH + runtime/<module>/)
6. **Type-driven dispatch** — drivers registered by type (java-boot, node-vite), not module ID
