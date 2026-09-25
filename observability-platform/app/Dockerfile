FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1

# Logs go to stdout as JSON (pino) so Promtail can scrape them from the container
CMD ["node", "--require", "./src/telemetry/tracing.js", "src/index.js"]
