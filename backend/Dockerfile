FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg python3 make g++
RUN ln -sf python3 /usr/bin/python

COPY package*.json ./
RUN npm ci --only=production

RUN ls node_modules/fs-extra && echo "fs-extra installed"

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
