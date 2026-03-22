# use node 20 slim for a smaller image footprint
FROM node:20-slim AS base

# install openssl for prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# install pnpm
RUN npm install -g pnpm

WORKDIR /app

# ─── BUILD STAGE ──────────────────────────────────────────────────────────────
FROM base AS build

# copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# copy source code
COPY . .

# generate prisma client
RUN pnpm prisma generate

# build typescript to javascript
RUN pnpm build

# ─── PRODUCTION STAGE ─────────────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# copy built files and necessary assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# expose the port defined in env
EXPOSE 10000

# start the server
CMD ["node", "dist/server.js"]
