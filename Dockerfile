# Multi-stage build for Node.js TypeScript application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the TypeScript application
RUN yarn build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any additional files that might be needed at runtime
COPY --from=builder /app/src/config ./src/config

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the default port (configurable via API_PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.API_PORT || 8080) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"] 