FROM node:22-alpine
COPY --from=certs . /usr/local/share/extra-ca/
RUN cat /usr/local/share/extra-ca/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root --ignore-scripts
COPY frontend ./frontend
WORKDIR /app/frontend
EXPOSE 6330
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "6330"]
