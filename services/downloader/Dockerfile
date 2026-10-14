FROM node:22-alpine AS build
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY services/downloader/package.json services/downloader/
RUN npm ci --workspace services/downloader --workspace packages/db --workspace packages/shared --include-workspace-root --ignore-scripts
COPY packages ./packages
RUN npm run generate --workspace packages/db
COPY services/downloader ./services/downloader

FROM node:22-alpine
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
RUN apk add --no-cache ffmpeg python3 py3-pip && pip3 install --no-cache-dir --break-system-packages "yt-dlp[default]"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/temp && chown node:node /app/temp
ENV TEMP_DOWNLOAD_PATH=/app/temp
USER node
WORKDIR /app/services/downloader
EXPOSE 9464
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:9464/health >/dev/null || exit 1
CMD ["node", "src/index.js"]
