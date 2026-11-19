FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:init && exec node server.js"]
