# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install dependencies including devDependencies for building
RUN npm ci

COPY . .

# Build the TypeScript project
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy any necessary config files (if not using env vars entirely)
# COPY config.env ./config.env 
# (Best practice for Docker is to use environment variables injected by the platform, not copying .env files)

EXPOSE 5000

CMD ["node", "dist/server.js"]
