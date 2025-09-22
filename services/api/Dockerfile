FROM node:20-alpine AS deps
WORKDIR /app
# Copy service-level manifests from repo root context
COPY services/api/package.json services/api/package-lock.json* services/api/pnpm-lock.yaml* services/api/yarn.lock* ./
RUN npm ci || (echo "No lockfile, falling back to npm install" && npm install)

FROM deps AS builder
WORKDIR /app
# Copy only the API service sources from repo root context, excluding node_modules
COPY services/api/package.json ./package.json
COPY services/api/tsconfig.json ./tsconfig.json
COPY services/api/src ./src
COPY services/api/README.md ./README.md
# Include Cadence sources for runtime loading
COPY flow /app/flow
ENV CADENCE_DIR=/app/flow/cadence
RUN npm run build || (echo "Build failed, ensure TypeScript is configured" && exit 1)

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY services/api/package.json services/api/package-lock.json* services/api/pnpm-lock.yaml* services/api/yarn.lock* ./
RUN npm ci --omit=dev || (echo "No lockfile, falling back to npm install --omit=dev" && npm install --omit=dev)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/flow ./flow
ENV CADENCE_DIR=/app/flow/cadence
CMD ["npm", "run", "start"]
