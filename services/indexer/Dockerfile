FROM node:20-alpine AS deps
WORKDIR /app
# Copy service-level manifests from repo root context
COPY services/indexer/package.json services/indexer/package-lock.json* services/indexer/pnpm-lock.yaml* services/indexer/yarn.lock* ./
RUN npm ci || (echo "No lockfile, falling back to npm install" && npm install)

FROM deps AS builder
WORKDIR /app
# Copy only the indexer service sources from repo root context
COPY services/indexer/package.json ./package.json
COPY services/indexer/tsconfig.json ./tsconfig.json
COPY services/indexer/src ./src
RUN npm run build || (echo "Build failed, ensure TypeScript is configured" && exit 1)

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install production deps only
COPY services/indexer/package.json services/indexer/package-lock.json* services/indexer/pnpm-lock.yaml* services/indexer/yarn.lock* ./
RUN npm ci --omit=dev || (echo "No lockfile, falling back to npm install --omit=dev" && npm install --omit=dev)
# Copy built dist
COPY --from=builder /app/dist ./dist
CMD ["npm", "run", "start"]


