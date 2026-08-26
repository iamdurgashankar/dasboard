/**
 * DevInquire JavaScript Backend API Server
 * Ports the legacy PHP backend to Node.js/Express.
 * Production hardened: env validation, helmet CSP/HSTS,
 * rate limiting, persistent session store, structured logs,
 * generic error responses, explicit CORS whitelist.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import crypto from "crypto";

// Load environment variables
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

/* ============================================================
 *  Env validation — fail-fast on misconfigured production
 * ============================================================ */
const REQUIRED_ENV = isProd
  ? ["SESSION_SECRET", "DATABASE_URL", "ALLOWED_ORIGINS"]
  : [];

const missing = REQUIRED_ENV.filter(
  (k) =>
    !process.env[k] ||
    process.env[k].includes("your-") ||
    process.env[k].length < 16,
);
if (missing.length) {
  console.error(
    "[FATAL] Missing or insecure required environment variables: " +
      missing.join(", "),
  );
  console.error("        Set them in server/.env before starting the server.");
  process.exit(1);
}

const SESSION_SECRET = process.env.SESSION_SECRET || "";
if (isProd && SESSION_SECRET.length < 32) {
  console.error(
    "[FATAL] SESSION_SECRET must be >= 32 chars in production. Generate with:",
  );
  console.error(
    "        node -e \"console.log(crypto.randomBytes(48).toString('hex'))\"",
  );
  process.exit(1);
}

// Import routers
import authRouter from "./routes/auth.js";
import projectsRouter from "./routes/projects.js";
import tasksRouter from "./routes/tasks.js";
import blogRouter from "./routes/blog.js";
import dashboardRouter from "./routes/dashboard.js";
import usersRouter from "./routes/users.js";
import contactsRouter from "./routes/contacts.js";
import notificationsRouter from "./routes/notifications.js";
import analyticsRouter from "./routes/analytics.js";
import publicRouter from "./routes/public.js";
import feedbackRouter from "./routes/feedback.js";

// Conditionally import persistent session store when Postgres is available
let PgStore = null;
try {
  const pgStoreModule = await import("connect-pg-simple");
  const pgModule = await import("pg");
  // Resolve default exports for CJS interop inside ESM
  const StoreFactory = pgStoreModule.default || pgStoreModule;
  const PoolCtor = pgModule.Pool || pgModule.default?.Pool || pgModule;
  const connectionString = process.env.DATABASE_URL || "";
  const usePg =
    connectionString &&
    connectionString.startsWith("postgres://") &&
    !connectionString.includes("localhost:5432") &&
    process.env.DB_TYPE !== "mysql";
  if (StoreFactory && PoolCtor && usePg) {
    PgStore = StoreFactory(session);
    global.__sessionPool = new PoolCtor({
      connectionString,
      ssl: connectionString.includes(".supabase.co")
        ? { rejectUnauthorized: false }
        : false,
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      idleTimeoutMillis: parseInt(
        process.env.DB_POOL_IDLE_TIMEOUT || "30000",
        10,
      ),
      connectionTimeoutMillis: parseInt(
        process.env.DB_POOL_CONN_TIMEOUT || "2000",
        10,
      ),
    });
  }
} catch (err) {
  if (isProd) {
    console.warn(
      "[WARN] Persistent session store unavailable. Install connect-pg-simple and provide DATABASE_URL, otherwise sessions are in-memory only.",
      err.message,
    );
  }
}

const app = express();
const port = process.env.PORT || 8001;

// Trust proxy setup for secure cookies behind reverse proxies (Nginx, Heroku, Cloudflare, etc.)
if (isProd) {
  app.set("trust proxy", parseInt(process.env.TRUST_PROXY_HOPS || "1", 10));
}

/* ============================================================
 *  Helmet — strict security headers for production
 * ============================================================ */
if (isProd) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdn.jsdelivr.net/npm/@tailwindcss",
          ],
          "img-src": ["'self'", "data:", "https:", "http:"],
          "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
          "connect-src": [
            "'self'",
            "https://devinquire.com",
            "https://dashboard.devinquire.com",
            "wss://devinquire.com",
            "wss://dashboard.devinquire.com",
          ],
          "frame-ancestors": ["'none'"],
          "upgrade-insecure-requests": [],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: false,
    }),
  );
}

/* ============================================================
 *  Request ID + Structured Logging (morgan)
 * ============================================================ */
app.use((req, res, next) => {
  req.id = crypto.randomUUID().slice(0, 13);
  res.setHeader("X-Request-ID", req.id);
  next();
});

const logFormat = isProd
  ? '{"ts":":date[iso]","rid":":req[x-request-id]","ip":":remote-addr","method":":method","path":":url","status":":status","ms":":response-time","ua":":user-agent"}'
  : "[:date[iso]] :method :url :status :response-time ms - :res[content-length]";
app.use(
  morgan(logFormat, {
    skip: (req, res) =>
      isProd &&
      (req.url.startsWith("/health") || req.url.startsWith("/favicon")),
  }),
);

/* ============================================================
 *  CORS — explicit whitelist, no localhost bypass in prod
 * ============================================================ */
const DEFAULT_ORIGINS_DEV = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://devinquire.com",
  "https://www.devinquire.com",
  "https://dashboard.devinquire.com",
];
const DEFAULT_ORIGINS_PROD = [
  "https://devinquire.com",
  "https://www.devinquire.com",
  "https://dashboard.devinquire.com",
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : isProd
    ? DEFAULT_ORIGINS_PROD
    : DEFAULT_ORIGINS_DEV;

app.use(
  cors({
    origin: (origin, callback) => {
      // Always allow same-origin curl in dev; reject naked origins in prod unless explicitly empty-allowed
      if (!origin) {
        if (isProd)
          return callback(
            new Error("CORS: Origin header required in production."),
            false,
          );
        return callback(null, true);
      }
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (
        !isProd &&
        (origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:"))
      ) {
        return callback(null, true);
      }
      return callback(
        new Error(`CORS policy blocked request from origin: ${origin}`),
        false,
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "X-CSRF-Token",
      "X-API-Key",
      "X-Request-ID",
    ],
    exposedHeaders: ["X-Request-ID"],
    maxAge: 600,
  }),
);
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();
  res.status(204).end();
});

// Body parsers and cookie/session middleware
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));
app.use(cookieParser());

/* ============================================================
 *  Rate Limiting — strict for auth/contact/blog mutations
 * ============================================================ */
const createLimiter = (windowMs, max, name) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message: `Too many ${name} requests. Please try again later.`,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    keyGenerator: (req) => {
      const ip = (
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        ""
      )
        .toString()
        .split(",")[0]
        .trim();
      const userKey = req.user?.id || req.session?.user?.id || "";
      return `${name}:${userKey || ip}`;
    },
  });

const authLimiter = createLimiter(15 * 60 * 1000, 10, "authentication"); // 10 login attempts / 15 min
const contactLimiter = createLimiter(60 * 60 * 1000, 20, "contact"); // 20 contact submissions / hour
const blogMutateLimiter = createLimiter(10 * 60 * 1000, 60, "blog-mutate"); // 60 create/update/delete/sync / 10 min
const apiBurstLimiter = createLimiter(60 * 1000, 200, "global"); // 200 req/min/user overall

app.use((req, res, next) => {
    const p = (req.baseUrl || '') + (req.path || req.url || '').split('?')[0];
    if (p === '/api/auth/login' || p === '/api/auth/login.php') return authLimiter(req, res, next);
    if (p.startsWith('/api/contact')) return contactLimiter(req, res, next);
    if (p.startsWith('/api/blog/create')) return blogMutateLimiter(req, res, next);
    if (p.startsWith('/api/blog/update')) return blogMutateLimiter(req, res, next);
    if (p.startsWith('/api/blog/delete')) return blogMutateLimiter(req, res, next);
    if (p.startsWith('/api/blog/sync')) return blogMutateLimiter(req, res, next);
    if (p.startsWith('/api/')) return apiBurstLimiter(req, res, next);
    return next();
});

/* ============================================================
 *  Session — persistent pg store if available, MemoryStore only in dev
 * ============================================================ */
const sessionConfig = {
  secret:
    SESSION_SECRET ||
    "dev-only-insecure-" + crypto.randomBytes(16).toString("hex"),
  resave: false,
  saveUninitialized: false,
  name: "connect.sid",
  proxy: !!isProd,
  cookie: {
    secure: isProd ? process.env.COOKIE_SECURE !== "false" : false,
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE
      ? process.env.COOKIE_SAMESITE
      : isProd
        ? "lax"
        : "lax",
    maxAge: parseInt(
      process.env.SESSION_MAX_AGE || 7 * 24 * 60 * 60 * 1000,
      10,
    ),
    path: "/",
    ...(isProd ? { partitioned: true } : {}),
  },
};

if (PgStore && global.__sessionPool) {
  sessionConfig.store = new PgStore({
    pool: global.__sessionPool,
    tableName: "sessions",
    pruneSessionInterval: 60,
    createTableIfMissing: true,
  });
  console.log(
    "[SESSION] Persistent PostgreSQL session store active (sessions table).",
  );
} else if (isProd) {
  console.error(
    "[SESSION][FATAL] No persistent session store available in production. Either:",
  );
  console.error(
    "   (a) Set a valid postgres:// DATABASE_URL (not localhost) and ensure connect-pg-simple is installed.",
  );
  console.error(
    "   (b) Install and configure connect-redis or another production store.",
  );
  process.exit(1);
} else {
  console.warn(
    "[SESSION] Using MemoryStore (dev only). Sessions are lost on restart.",
  );
}

app.use(session(sessionConfig));

// Health endpoint
app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    status: "ok",
    ts: new Date().toISOString(),
    rid: req.id,
    env: isProd ? "production" : "development",
    sessionStore: PgStore ? "postgresql" : "memory-dev",
  });
});

// Mount API routes (supporting both clean and .php extensions)
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/blog", blogRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", usersRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/public", publicRouter);
app.use("/api/feedback", feedbackRouter);

// Global 404 for /api namespace — JSON payload, not HTML
app.use("/api/*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
    rid: req.id,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const rid = req.id || crypto.randomUUID().slice(0, 13);

  // Never leak internal errors to the client in production
  let clientMessage = "Internal Server Error.";
  if (!isProd) clientMessage = err.message || clientMessage;
  if (status === 429)
    clientMessage = err.message?.message || err.message || clientMessage; // rate limiter
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 409
  ) {
    clientMessage = err.message || clientMessage;
  }

  // Log server-side with full detail + request id so we can trace back
  const logObj = {
    rid,
    status,
    error: err && err.message,
    stack: err && err.stack,
    method: req.method,
    path: req.url,
    ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .toString()
      .split(",")[0]
      .trim(),
    user: req.session?.user?.email || req.user?.id || null,
  };
  console.error("[ERROR]", JSON.stringify(logObj));

  res.status(status).json({
    status: "error",
    message: clientMessage,
    rid,
  });
});

// Start Server
app.listen(port, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`DevInquire Dashboard Backend active on port ${port}`);
  console.log(
    `Environment: ${isProd ? "PRODUCTION (hardened)" : "DEVELOPMENT"}`,
  );
  console.log(`Health: http://localhost:${port}/api/health`);
  console.log(
    `Session Store: ${PgStore ? "PostgreSQL (persistent)" : "Memory (dev only)"}`,
  );
  console.log(
    `CORS origins (${allowedOrigins.length}): ${allowedOrigins.join(", ")}`,
  );
  console.log(`======================================================\n`);
});
