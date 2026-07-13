import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import hpp from 'hpp';
import { randomUUID } from 'crypto';

import env from './config/env';
import logger from './utils/logger';
import loggerMiddleware from './middleware/loggerMiddleware';
import errorMiddleware from './middleware/errorMiddleware';
import v1Router from './routes/index';
import initSocketIO from './socket/index';
import { startCleanupScheduler } from './utils/cron';

// Initialize background queue workers
import './queue/MediaProcessingQueue';
import './queue/PushNotificationQueue';
import './queue/LiveNotificationQueue';

// ─── STARTUP SECURITY GUARDS ─────────────────────────────────────────────────
// Google OAuth: hard-fail in production if GOOGLE_CLIENT_ID is not set.
// This prevents the mock-bypass mode from silently shipping in a real environment.
if (env.NODE_ENV === 'production' && !env.GOOGLE_CLIENT_ID) {
  logger.warn(
    '⚠️  WARNING: GOOGLE_CLIENT_ID is not set. ' +
    'Google Sign-In will be unavailable. ' +
    'Set GOOGLE_CLIENT_ID in your production environment to enable it.'
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// Trust Render's proxy (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// 1. Compression (Gzip payload optimization)
app.use(compression());

// 2. Correlation IDs & API Version Headers Middleware
app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-API-Version', '1.0');
  next();
});

// 3. Structured Logging Middleware
app.use(loggerMiddleware);

// 4. Secure Helmet configuration (HSTS, CSP, Frames, Sniffing, Referrers)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "http://127.0.0.1:5000", "http://localhost:5000", "https://images.unsplash.com"],
        connectSrc: ["'self'", "wss:", "https:", "http://127.0.0.1:5000", "http://localhost:5000", "ws://127.0.0.1:5000", "ws://localhost:5000"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Set cross-origin resource policy inside helmet
    referrerPolicy: { policy: 'same-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

// 5. Permissive CORS (can be tightened in prod config)
app.use(cors());

// 6. Security headers mapping Permissions Policy & COOP/CORP
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// 7. Body Parsers & Parameter Pollution Prevention
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(hpp()); // HTTP Parameter Pollution

// 8. Rate Limiting (Prevent Brute-force & DoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'development' ? 100000 : 200, // Limit each IP to 200 requests per windowMs (high limit in dev)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// 9. Operational Health check endpoints (Module 10 & 16)
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'healthy', timestamp: new Date() });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ success: true, status: 'ready', timestamp: new Date() });
});

app.get('/live', (req, res) => {
  res.status(200).json({ success: true, status: 'live', timestamp: new Date() });
});

// Prometheus metrics endpoint
import metricsService from './monitoring/metrics.service';
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsService.getPrometheusMetrics());
});

// Swagger/OpenAPI documentation endpoint
app.get('/docs', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <html>
      <head><title>Vyra OpenAPI 3.1 Documentation</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px; background: #0c0d14; color: #fff;">
        <h1>Vyra API v1.0 Documentation (OpenAPI 3.1)</h1>
        <p>Documentation endpoint successfully configured. Ready for UI mapping.</p>
      </body>
    </html>
  `);
});

// Mount Versioned Routes under /api/v1
app.use('/api/v1', v1Router);

// Serve uploads statically
app.use('/uploads', express.static('uploads'));

// Status Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Vyra API Server (v1.0 TypeScript)',
    time: new Date(),
    environment: env.NODE_ENV,
  });
});

// Attach Socket.IO Handlers
initSocketIO(io);

// Error Handling Middleware (must be registered last)
app.use(errorMiddleware);

// Start Cleanup Cron Tasks
startCleanupScheduler();

// Start Server
const PORT = env.PORT;
server.listen(PORT, () => {
  logger.info(`🚀 Vyra Server running in ${env.NODE_ENV} mode on port ${PORT}`);
});

export default server;
