# Production Dockerfile for Instant Print SaaS on Render
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all dependencies across workspaces
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy all source files
COPY . .

# Build Client production bundle, Prisma client, and Server TS
RUN npm run build

# Production runner image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV DATABASE_URL="file:./dev.db"

# Copy built application from builder stage
COPY --from=builder /app /app

EXPOSE 10000

CMD ["npm", "start"]
