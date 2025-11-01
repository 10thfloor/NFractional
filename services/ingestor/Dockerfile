FROM node:20-alpine AS deps
WORKDIR /app
# Copy service-level manifests from repo root context
COPY services/ingestor/package.json services/ingestor/package-lock.json* services/ingestor/pnpm-lock.yaml* services/ingestor/yarn.lock* ./
RUN npm ci || (echo "No lockfile, falling back to npm install" && npm install)

FROM deps AS builder
WORKDIR /app
# Copy only the ingestor service sources from repo root context
COPY services/ingestor/package.json ./package.json
COPY services/ingestor/tsconfig.json ./tsconfig.json
COPY services/ingestor/src ./src
RUN npm run build || (echo "Build failed, ensure TypeScript is configured" && exit 1)

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY services/ingestor/package.json services/ingestor/package-lock.json* services/ingestor/pnpm-lock.yaml* services/ingestor/yarn.lock* ./
RUN npm ci --omit=dev || (echo "No lockfile, falling back to npm install --omit=dev" && npm install --omit=dev)
COPY --from=builder /app/dist ./dist
# Copy event type files for file-based configuration
COPY infra/ingestor/events-emulator.txt infra/ingestor/events-testnet.txt /app/events/
CMD ["npm", "run", "start"]


