# ==========================================
# Backend Dockerfile (NestJS API) - Updated for Robustness
# ==========================================

# Stage 1: Base Builder (Shared stage for dependencies and initial build)
FROM node:20-alpine AS base-builder

WORKDIR /app

# Install Chromium and necessary dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files and install all dependencies (including devDependencies)
COPY backend/package*.json ./
RUN npm ci

# Copy configuration files (tsconfig, nest-cli) before source code
COPY backend/tsconfig*.json ./
COPY backend/nest-cli.json ./

# Copy source code (containing the /src directory)
COPY backend/src ./src

# Build the application
# This should reliably output to /app/dist
RUN npm run build

# ==========================================
# Stage 2: Development (Target: development)
# ==========================================
FROM base-builder AS development

# Copy necessary config files needed for runtime if required, though usually handled by volume mounts
COPY backend/nest-cli.json ./
COPY backend/tsconfig.json ./

EXPOSE 3000

# CMD for Development: Runs with a watcher for hot reloading
CMD ["npm", "run", "start:dev"]

# ==========================================
# Stage 3: Production (Target: production)
# Minimal image with only production dependencies and built code.
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# Install Chromium and necessary dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copy package files (only to install production dependencies efficiently)
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built artifacts from the base-builder stage
COPY --from=base-builder /app/dist ./dist
COPY backend/public ./public

# --------------------------
# 1. CREATE USER/GROUP FIRST
# --------------------------
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# After that run chown and set data
RUN mkdir -p /app/data/raw && \
    # Assign ownership to the 'nestjs' user (user already exists)
    chown -R nestjs:nodejs /app/data && \
    # Assign ownership to the other application directories
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

# CMD for Production
CMD ["node", "dist/main.js"]
