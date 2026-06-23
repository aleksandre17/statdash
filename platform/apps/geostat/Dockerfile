# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY platform/package*.json ./
RUN npm ci

# ─── Stage 2: Development ────────────────────────────────────────────────────
FROM deps AS development
COPY platform/ .
EXPOSE 5171
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ─── Stage 3: Builder ────────────────────────────────────────────────────────
FROM deps AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY platform/ .
RUN npm run build

# ─── Stage 4: Production ─────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/apps/geostat/dist /usr/share/nginx/html
COPY ops/compose/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5171
CMD ["nginx", "-g", "daemon off;"]