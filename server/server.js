/**
 * DevInquire JavaScript Backend API Server
 * Ports the legacy PHP backend to Node.js/Express.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';

// Import routers
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import blogRouter from './routes/blog.js';
import dashboardRouter from './routes/dashboard.js';
import usersRouter from './routes/users.js';
import contactsRouter from './routes/contacts.js';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import publicRouter from './routes/public.js';
import feedbackRouter from './routes/feedback.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8001;

// CORS configuration matching PHP config.php
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173', 'https://devinquire.com'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl) or in allowedOrigins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
}));

const isProd = process.env.NODE_ENV === 'production';

// Trust proxy setup for secure cookies behind reverse proxies (Nginx, Heroku, Cloudflare, etc.)
if (isProd) {
    app.set('trust proxy', 1);
}

// Body parsers and cookie/session middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || 'devinquire-secure-session-key-321-xyz',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProd ? (process.env.COOKIE_SECURE !== 'false') : false,
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax'),
        maxAge: 24 * 60 * 60 * 1000 // 24 hours (matches SESSION_LIFETIME = 86400)
    }
}));

// Request Logger
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Mount API routes (supporting both clean and .php extensions)
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/blog', blogRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/public', publicRouter);
app.use('/api/feedback', feedbackRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal Orchestration Failure.'
    });
});

// Start Server
app.listen(port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`DevInquire JavaScript Backend Server active on port ${port}`);
    console.log(`Uplink URL: http://localhost:${port}`);
    console.log(`Proxy Target for Vite: http://localhost:8001`);
    console.log(`======================================================\n`);
});
