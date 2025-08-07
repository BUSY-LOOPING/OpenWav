FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg python3 make g++
RUN ln -sf python3 /usr/bin/python

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
