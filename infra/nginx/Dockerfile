FROM node:22-alpine AS build
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root --ignore-scripts
COPY frontend ./frontend
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build -w frontend

FROM nginx:1.27-alpine
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
RUN apk add --no-cache openssl
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/templates /etc/nginx/templates
COPY infra/nginx/spa /etc/nginx/spa
COPY infra/nginx/certs.sh /docker-entrypoint.d/05-certs.sh
COPY infra/nginx/ops.conf /etc/nginx/ops/ops.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/05-certs.sh
ENV SPA_MODE=static UPSTREAM_API=backend:3000 UPSTREAM_STORAGE=rustfs:9000 S3_BUCKET_AUDIO=audio S3_BUCKET_COVERS=covers AUDIO_CACHE_MAX_SIZE=20g COVER_CACHE_MAX_SIZE=2g
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8081/nginx_status >/dev/null || exit 1
