FROM node:22-alpine AS build
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN npm ci --workspace backend --workspace packages/db --workspace packages/shared --include-workspace-root --ignore-scripts
COPY packages ./packages
RUN npm run generate --workspace packages/db
COPY backend ./backend

FROM node:22-alpine
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "src/server.js"]
