FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip curl ffmpeg && \
    pip3 install --break-system-packages yt-dlp

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src/ ./src/

RUN mkdir -p /app/temp /app/media /app/logs

CMD ["node", "src/index.js"]