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

# Re-install Chromium on the final clean image
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set production environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copy package files (only to install production dependencies efficiently)
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy the built application directory. If npm run build correctly outputs to 'dist' 
# inside the WORKDIR (/app), this path is correct.
COPY --from=base-builder /app/dist ./dist

# Copy public static files
COPY backend/public ./public
RUN mkdir -p /app/data/raw && \
    # Assign directory ownership to user 'nestjs'
    chown -R nestjs:nodejs /app/data

# Setup non-root user for the application to run
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app
USER nestjs

# Setup non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

# CMD for Production: Ensure it points to the copied dist/main.js
CMD ["node", "dist/main.js"]
