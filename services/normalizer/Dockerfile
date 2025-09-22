FROM node:20-alpine AS deps
WORKDIR /app
# Copy service-level manifests from repo root context
COPY services/normalizer/package.json services/normalizer/package-lock.json* services/normalizer/pnpm-lock.yaml* services/normalizer/yarn.lock* ./
RUN npm ci || (echo "No lockfile, falling back to npm install" && npm install)

FROM deps AS builder
WORKDIR /app
# Copy only the normalizer service sources from repo root context
COPY services/normalizer/package.json ./package.json
COPY services/normalizer/tsconfig.json ./tsconfig.json
COPY services/normalizer/src ./src
RUN npm run build || (echo "Build failed, ensure TypeScript is configured" && exit 1)

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY services/normalizer/package.json services/normalizer/package-lock.json* services/normalizer/pnpm-lock.yaml* services/normalizer/yarn.lock* ./
RUN npm ci --omit=dev || (echo "No lockfile, falling back to npm install --omit=dev" && npm install --omit=dev)
COPY --from=builder /app/dist ./dist
CMD ["npm", "run", "start"]


