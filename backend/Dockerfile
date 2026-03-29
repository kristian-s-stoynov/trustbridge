FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# Remove dev deps after compilation
RUN npm prune --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
