FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p /app/data

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
