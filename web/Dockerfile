FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy packages that web depends on (for workspace linking)
COPY packages/cadence packages/cadence
COPY scripts scripts
COPY flow flow
# Copy web workspace files (exclude pnpm-workspace.yaml to avoid workspace confusion)
COPY web/package.json web/pnpm-lock.yaml web/tsconfig.json web/next.config.ts web/postcss.config.mjs web/eslint.config.mjs web/components.json web/
COPY web/src web/src
COPY web/public web/public

WORKDIR /app/web

# Install all dependencies (including dev) for build
RUN pnpm install --frozen-lockfile

# Build with production env
# Note: NEXT_PUBLIC_* vars need to be set at build time for Next.js standalone mode
# They should be provided via Fly.io's build secrets or env vars
ENV NODE_ENV=production
ARG NEXT_PUBLIC_FLOW_NETWORK=testnet
ARG NEXT_PUBLIC_ACCESS_NODE=https://rest-testnet.onflow.org
ARG NEXT_PUBLIC_DISCOVERY_WALLET=https://fcl-discovery.onflow.org/testnet/authn
ARG NEXT_PUBLIC_API_URL=https://flow-gql-api.fly.dev/graphql
ARG NEXT_PUBLIC_API_BASE=https://flow-gql-api.fly.dev

ENV NEXT_PUBLIC_FLOW_NETWORK=$NEXT_PUBLIC_FLOW_NETWORK
ENV NEXT_PUBLIC_ACCESS_NODE=$NEXT_PUBLIC_ACCESS_NODE
ENV NEXT_PUBLIC_DISCOVERY_WALLET=$NEXT_PUBLIC_DISCOVERY_WALLET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output from build stage
COPY --from=base /app/web/.next/standalone ./
COPY --from=base /app/web/.next/static ./.next/static
COPY --from=base /app/web/public ./public

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]


