FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg python3 make g++ py3-pip
RUN pip3 install --upgrade yt-dlp --break-system-packages
RUN ln -sf python3 /usr/bin/python

# RUN mkdir -p /app/media /app/temp /app/logs && chown -R node:node /app

COPY package*.json ./
RUN npm ci --only=production

RUN ls node_modules/fs-extra && echo "fs-extra installed"

COPY . .

# RUN chown -R node:node /usr/src/app
# USER node


EXPOSE 3000

CMD ["npm", "start"]
