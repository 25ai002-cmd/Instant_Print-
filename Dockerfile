# Production Dockerfile for Instant Print SaaS on Render
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all dependencies
RUN npm run install:all

# Copy source files
COPY . .

# Build Client, Prisma, and Server
RUN npm run build

# Production runner image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy built application from builder stage
COPY --from=builder /app /app

EXPOSE 10000

CMD ["npm", "start"]
