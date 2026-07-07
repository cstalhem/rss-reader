# Builder stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (frozen lockfile for reproducible builds).
# --ignore-scripts: the `prepare` lifecycle script installs git hooks via
# ../scripts/install-hooks.sh, which is outside this build context (frontend/
# only) and irrelevant to the image — running it would fail the build.
RUN bun install --frozen-lockfile --ignore-scripts

# Copy application code
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application (standalone output; API URLs are relative — routed by
# the reverse proxy in prod, so there is no NEXT_PUBLIC_API_URL to bake in)
RUN bun run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone output and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port (reverse proxy maps this)
EXPOSE 3000

# Health check — target 127.0.0.1 explicitly: node:alpine resolves `localhost`
# to ::1 (IPv6) first, but the server binds IPv4 (0.0.0.0), so a localhost
# probe fails and Traefik silently skips the "unhealthy" container.
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the server
CMD ["node", "server.js"]
