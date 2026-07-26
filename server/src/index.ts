// ============================================================
// PrintATM Cloud SaaS Platform — Server Entry Point
// Sets up Express, HTTP Server, Socket.IO WebSockets, Prisma DB,
// Helmet, CORS, session GC, and routing.
// ============================================================

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables immediately before services load
dotenv.config({ path: path.join(__dirname, '../.env') });

import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sessionService } from './services/sessionService.js';
import { initSocketService } from './services/socketService.js';
import { seedDatabase } from './db/seed.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Security Headers & CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve temporary uploads directory statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} (from ${req.ip})`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Serve React Frontend static production bundle in production/cloud deployment
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO WebSockets for real-time Kiosk machine job dispatch
initSocketService(server);

// Start Session Store Garbage Collector
sessionService.startCleanupInterval();

// Seed initial Database data (Admin user, ATM001, ATM002, Rate cards)
seedDatabase().catch((err) => console.error('[Seed Error]:', err));

server.listen(PORT, () => {
  console.log(`==============================================`);
  console.log(` Instant Print Cloud SaaS Server is running on port ${PORT} `);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'} `);
  console.log(` Allowed Client Origin: ${CLIENT_URL} `);
  console.log(`==============================================`);
});
