# ---------- Etapa 1: compilar la app Angular ----------
# Imagen Debian (glibc): evita problemas con dependencias nativas del build en Alpine
FROM node:24-slim AS build
WORKDIR /app

# Primero solo los manifiestos: la capa de dependencias se reutiliza si no cambian
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Etapa 2: servir con nginx (sin root) ----------
FROM nginxinc/nginx-unprivileged:stable-alpine

# La imagen procesa /etc/nginx/templates/*.template con envsubst al arrancar
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/bizagi2-front/browser /usr/share/nginx/html

# A donde se reenvia /api (nombre del servicio del backend en Docker Compose)
ENV BACKEND_URL=http://backend:8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
