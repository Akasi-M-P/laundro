# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY src ./src

# Copy config example (actual config should come from environment variables)
COPY config.env.example ./config.env.example

# Create logs directory
RUN mkdir -p logs

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "src/server.js"]
