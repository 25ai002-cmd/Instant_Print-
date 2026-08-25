# Production Dockerfile for Instant Print SaaS on Render
FROM node:20-alpine AS builder

# Install build dependencies for native modules on Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies across workspaces
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source files
COPY . .

# Build Client production bundle and Server TS
RUN npm run build

# Production runner image with LibreOffice for PDF conversion
FROM node:20-alpine

RUN apk add --no-cache libreoffice font-dejavu ttf-droid ttf-freefont ttf-liberation

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy built application from builder stage
COPY --from=builder /app /app

EXPOSE 10000

CMD ["npm", "start"]
