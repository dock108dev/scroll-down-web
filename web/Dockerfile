FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must be supplied here — runtime env on the server is too late.
ARG NEXT_PUBLIC_ADS_ENABLED
ARG NEXT_PUBLIC_ADSENSE_CLIENT_ID
ARG NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT
ARG NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT
ARG NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT
ARG NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT
ENV NEXT_PUBLIC_ADS_ENABLED=${NEXT_PUBLIC_ADS_ENABLED}
ENV NEXT_PUBLIC_ADSENSE_CLIENT_ID=${NEXT_PUBLIC_ADSENSE_CLIENT_ID}
ENV NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT=${NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT}
ENV NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT=${NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT}
ENV NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT=${NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT}
ENV NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT=${NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT}

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
