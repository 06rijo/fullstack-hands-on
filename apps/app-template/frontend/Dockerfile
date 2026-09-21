# Frontend image for the app-template starter.

FROM node:22-alpine

WORKDIR /app

# Install dependencies first so they can be cached independently of source changes.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5173

CMD ["node", "src/index.js"]