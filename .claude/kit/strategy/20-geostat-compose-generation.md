# geostat-chat-ai: Compose Generation Pipeline

**Reconnaissance:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## The Catalog Pattern

**File:** `ops/compose/catalog.json` (1500+ lines)

Separates **templates** (reusable YAML blocks) from **targets** (where to write, what services).

### Template Library

```json
{
  "templates": {
    "api_dev": "  {api_service}:\n    image: {api_image}\n    build:\n      context: {api_context}\n      dockerfile: {api_dockerfile_dev}\n    ports:\n      - \"${{API_PORT:-8090}}:8090\"\n    env_file:\n      - {secrets_backend}/.env.dev\n    environment:\n      SPRING_PROFILES_ACTIVE: dev\n    healthcheck:\n      test: [\"CMD-SHELL\", \"wget -qO- http://localhost:8090/actuator/health | grep -q UP || exit 1\"]\n      ...",
    
    "api_prod": "  {api_service}:\n    image: {api_image}\n    build:\n      context: {api_context}\n      dockerfile: {api_dockerfile_prod}\n    ports:\n      - \"${{API_PORT:-8090}}:8090\"\n    environment:\n      SPRING_PROFILES_ACTIVE: prod\n      JAVA_TOOL_OPTIONS: >-\n        -XX:+UseContainerSupport\n        -XX:MaxRAMPercentage=75.0\n        -XX:+UseG1GC\n    volumes:\n      - {secrets_backend}/google-credentials.json:/app/google-credentials.json:ro\n    ...",
    
    "app_dev_overlay": "  {app_service}:\n    build:\n      target: development\n    ports:\n      - \"${{DEPLOY_HOST_PORT:-5177}}:5177\"\n    volumes:\n      - {app_dev_mount}:/app\n      - /app/node_modules\n    environment:\n      VITE_API_URL: ${{VITE_API_URL:-http://localhost:8090}}\n    develop:\n      watch:\n        - action: sync\n          path: ./src\n          target: /app/src\n        - action: rebuild\n          path: package.json\n    ...",
    
    "net_internal": "networks:\n  {network_key}:\n    name: {network_name}\n"
  }
}
```

### Target Map

```json
{
  "targets": {
    "apps/backend/docker-compose.dev.yml": {
      "services": ["api_dev", "worker_dev"],
      "services_if": {
        "worker_dev": "worker"  // Conditional: include worker_dev only if worker feature enabled
      },
      "fmt": {
        "api_context": ".",
        "api_dockerfile_dev": "Dockerfile.dev",
        "worker_context": ".",
        "worker_dockerfile_dev": "worker/Dockerfile.dev",
        "secrets_backend": "../../ops/config/backend",
        "health_interval": "15s",
        "health_retries": "5",
        "health_start": "60s"
      },
      "networks": "net_internal"
    },
    
    "apps/backend/docker-compose.prod.yml": {
      "services": ["api_prod", "worker_prod"],
      "fmt": {
        "api_dockerfile_prod": "Dockerfile",
        "worker_dockerfile_prod": "worker/Dockerfile",
        "worker_health_start_prod": "60s"
      },
      "networks": "net_internal",
      "volumes": "vols_prod"
    },
    
    "apps/frontend/docker-compose.yml": {
      "services": ["app_base"],
      "fmt": { "app_context": "." },
      "networks": "net_internal"
    },
    
    "apps/frontend/docker-compose.override.yml": {
      "services": ["app_dev_overlay"],
      "fmt": { "app_dev_mount": "." }
    },
    
    "apps/frontend/docker-compose.prod.yml": {
      "services": ["app_prod_overlay"],
      "fmt": {}
    }
  }
}
```

## Compose Generation Flow

**Script:** `kits/geostat-kit/compose/manifest_compose.py` (120 lines read)

```python
def build_compose_files(manifest, catalog):
    ctx = ProjectContext(manifest)
    
    for target_path, target_def in catalog["targets"].items():
        compose = {"services": {}, "networks": {}}
        
        # Iterate requested templates
        for template_key in target_def["services"]:
            # Check conditional: only include if feature enabled
            if template_key in target_def.get("services_if", {}):
                feature = target_def["services_if"][template_key]
                if not ctx.is_feature_enabled(feature):
                    continue
            
            template = catalog["templates"][template_key]
            
            # Render with format vars
            fmt_vars = target_def.get("fmt", {})
            resolved_vars = resolve_vars(ctx, fmt_vars)
            rendered = template.format(**resolved_vars)
            
            # Parse service block from rendered YAML
            service_block = yaml.safe_load(rendered)
            compose["services"].update(service_block)
        
        # Add networks
        if "networks" in target_def:
            network_template_key = target_def["networks"]
            network_template = catalog["templates"][network_template_key]
            network_block = network_template.format(
                network_key=ctx.docker_network_key(),
                network_name=ctx.docker_network_name()
            )
            compose["networks"].update(yaml.safe_load(network_block))
        
        # Write docker-compose file
        (ctx.root / target_path).write_text(
            yaml.dump(compose, default_flow_style=False)
        )
```

## Variable Resolution

**Key variables resolved at generation time:**

| Variable | Source | Example |
|----------|--------|---------|
| `{api_service}` | Manifest module ID + deploy.env | `geostat-chat-ai-backend` |
| `{api_image}` | Module type + repo name | `geostat-chat-ai:latest` |
| `{api_context}` | Module path from manifest | `.` (apps/backend) |
| `{api_dockerfile_dev}` | Driver discovery | `Dockerfile.dev` or `Dockerfile` |
| `{secrets_backend}` | Manifest secretsModule path | `../../ops/config/backend` |
| `{network_name}` | Manifest stack.networkName | `geostat-chat-ai-net` |
| `{api_port}` | ENV var or compose default | `8090` |

## Conditional Services

**Pattern:** `services_if` + feature flags

```json
{
  "services": ["api_dev", "worker_dev"],
  "services_if": {
    "worker_dev": "worker"
  }
}
```

**Logic (Python):**
```python
def is_feature_enabled(manifest, feature):
    # Check if catalog feature is true
    catalog = load_catalog(manifest)
    return catalog.get("features", {}).get(feature, False)
```

**Usage:** Ingestion service has optional embedded worker. If `catalog.features.worker = false`, worker_dev block is skipped.

## Output Structure

After `geostat compose-gen`:

```
ops/compose/stack/
├── docker-compose.yml          (Full stack, all modules)
├── docker-compose.dev.yml      (Dev overrides)
└── docker-compose.prod.yml     (Prod overrides)

apps/backend/
├── docker-compose.dev.yml      (API + worker dev)
├── docker-compose.prod.yml     (API + worker prod)
└── Dockerfile.dev

apps/frontend/
├── docker-compose.yml          (Base)
├── docker-compose.override.yml (Dev overlay, auto-merged)
├── docker-compose.prod.yml     (Prod overlay)
└── Dockerfile
```

## Why Catalog + Targets Pattern?

1. **DRY** — Templates reused across multiple output files
2. **Discoverable** — All available templates and targets in one file
3. **Versioned** — Catalog.json is part of consumer project; versions independently
4. **Extensible** — Add new target = new entry; templates unchanged
5. **Parameterized** — Format vars allow customization per-target without duplicate templates
