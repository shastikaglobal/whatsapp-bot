import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import webhookRoutes from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for production reverse proxy (Nginx / Cloudflare)
app.set('trust proxy', 1);

// Security Headers Middleware (Helmet-style)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Sensible CORS Configuration (User domain + local development)
const allowedOrigins = [
  'https://shastikachatbot.co.in',
  'https://www.shastikachatbot.co.in',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server, Meta webhooks have no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256']
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Enhanced Health Check Endpoint (Item 9)
// Reduced public health endpoint: status, database ok, uptime
const publicHealthHandler = async (req, res) => {
  let dbOk = false;
  try {
    const { default: pool } = await import('./config/db.js');
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }

  const statusCode = dbOk ? 200 : 503;
  res.status(statusCode).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'ok' : 'down',
    uptime: Math.floor(process.uptime())
  });
};

app.get('/health', publicHealthHandler);
app.get('/api/health', publicHealthHandler);

// API and Webhook routes (Mount both /api/webhook and /webhook for flexible integration)
app.use('/api/webhook', webhookRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// In production, serve the built React frontend from dist/
if (NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // All non-API routes go to index.html (React SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Shastika Bot API is running (development mode)');
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${NODE_ENV} mode`);
});
