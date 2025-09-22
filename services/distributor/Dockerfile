FROM node:20-alpine AS deps
WORKDIR /app
COPY services/distributor/package.json services/distributor/package-lock.json* services/distributor/pnpm-lock.yaml* services/distributor/yarn.lock* ./
RUN npm ci || (echo "No lockfile, falling back to npm install" && npm install)

FROM deps AS builder
WORKDIR /app
COPY services/distributor/package.json ./package.json
COPY services/distributor/tsconfig.json ./tsconfig.json
COPY services/distributor/src ./src
# Include Cadence sources for runtime loading
COPY flow /app/flow
ENV CADENCE_DIR=/app/flow/cadence
RUN npm run build || (echo "Build failed, ensure TypeScript is configured" && exit 1)

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY services/distributor/package.json services/distributor/package-lock.json* services/distributor/pnpm-lock.yaml* services/distributor/yarn.lock* ./
RUN npm ci --omit=dev || (echo "No lockfile, falling back to npm install --omit=dev" && npm install --omit=dev)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/flow ./flow
ENV CADENCE_DIR=/app/flow/cadence
CMD ["npm", "run", "start"]

