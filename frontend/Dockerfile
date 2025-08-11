FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 6330

CMD ["npm", "run", "dev", "--", "--host", "--port", "6330"]
