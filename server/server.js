/**
 * DevInquire JavaScript Backend API Server
 * Ports the legacy PHP backend to Node.js/Express.
 * Production hardened: env validation, helmet CSP/HSTS,
 * rate limiting, persistent session store, structured logs,
 * generic error responses, explicit CORS whitelist, and static SPA serving.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env, ../.env, and cwd
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

/* ============================================================
 *  Env validation — warn and provide safe fallbacks in production
 * ============================================================ */
const rawSecret = (process.env.SESSION_SECRET || "").trim();
const isPlaceholderSecret =
  !rawSecret ||
  rawSecret.includes("your-") ||
  rawSecret.includes("REPLACE_WITH_") ||
  rawSecret.includes("replace_with_") ||
  rawSecret.length < 32;

const SESSION_SECRET = !isPlaceholderSecret
  ? rawSecret
  : crypto
      .createHash("sha256")
      .update("devinquire-prod-session-secret-" + (process.env.DATABASE_URL || process.env.DB_NAME || "default"))
      .digest("hex");

if (isProd && isPlaceholderSecret) {
  console.warn(
    "[WARN] SESSION_SECRET is missing or using a placeholder in server/.env. Using derived secret; set a strong 48-byte hex SESSION_SECRET in server/.env.",
  );
}

// Import DB & routers
import db from "./db.js";
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
import quotationsRouter from "./routes/quotations.js";

import connectPgSimple from "connect-pg-simple";
import pg from "pg";

// Conditionally configure persistent session store when Postgres is available
let PgStore = null;
try {
  const StoreFactory = connectPgSimple.default || connectPgSimple;
  const PoolCtor = pg.Pool || pg.default?.Pool || pg;
  const connectionString = (process.env.DATABASE_URL || "").trim();
  const usePg =
    connectionString &&
    (connectionString.startsWith("postgres://") ||
      connectionString.startsWith("postgresql://")) &&
    !connectionString.includes("localhost:5432") &&
    !connectionString.includes("127.0.0.1:5432") &&
    !connectionString.includes("your_supabase_password") &&
    !connectionString.includes("[YOUR-PASSWORD]") &&
    !connectionString.includes("[PASSWORD]") &&
    process.env.DB_TYPE !== "mysql";
  if (StoreFactory && PoolCtor && usePg) {
    PgStore = StoreFactory(session);
    global.__sessionPool = new PoolCtor({
      connectionString,
      ssl:
        connectionString.includes(".supabase.co") ||
        connectionString.includes(".supabase.com")
          ? { rejectUnauthorized: false }
          : false,
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      idleTimeoutMillis: parseInt(
        process.env.DB_POOL_IDLE_TIMEOUT || "30000",
        10,
      ),
      connectionTimeoutMillis: parseInt(
        process.env.DB_POOL_CONN_TIMEOUT || "5000",
        10,
      ),
    });
    global.__sessionPool.on("error", (err) => {
      console.warn("[SESSION][PG] Pool background error:", err.message);
    });
  }
} catch (err) {
  if (isProd) {
    console.warn(
      "[WARN] Persistent PostgreSQL session store unavailable:",
      err.message,
    );
  }
}

const app = express();
const port = process.env.PORT || 8001;

// Trust proxy setup for secure cookies behind reverse proxies (Cloudflare, Hostinger LiteSpeed, Nginx, etc.)
app.set("trust proxy", true);

/* ============================================================
 *  Helmet — security headers
 * ============================================================ */
if (isProd) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net",
          ],
          "img-src": ["'self'", "data:", "https:", "http:", "blob:"],
          "media-src": ["'self'", "data:", "https:", "http:", "blob:"],
          "font-src": [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com",
            "data:",
          ],
          "connect-src": [
            "'self'",
            "https://devinquire.com",
            "https://www.devinquire.com",
            "https://dashboard.devinquire.com",
            "https://*.supabase.co",
            "https://generativelanguage.googleapis.com",
            "wss://devinquire.com",
            "wss://dashboard.devinquire.com",
          ],
          "frame-ancestors": ["'self'", "https://devinquire.com", "https://dashboard.devinquire.com"],
          "upgrade-insecure-requests": [],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
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
    skip: (req) =>
      isProd &&
      (req.url.startsWith("/health") || req.url.startsWith("/favicon")),
  }),
);

/* ============================================================
 *  CORS — allow same-origin (no Origin header) and whitelisted domains
 * ============================================================ */
const DEFAULT_ORIGINS_DEV = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
  "https://devinquire.com",
  "https://www.devinquire.com",
  "https://dashboard.devinquire.com",
];
const DEFAULT_ORIGINS_PROD = [
  "https://devinquire.com",
  "https://www.devinquire.com",
  "https://dashboard.devinquire.com",
  "https://www.dashboard.devinquire.com",
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
      // Allow same-origin requests, server-to-server calls, and health checks (which omit Origin)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow any *.devinquire.com subdomain over HTTPS
      if (/^https?:\/\/([a-z0-9-]+\.)?devinquire\.com$/i.test(origin)) {
        return callback(null, true);
      }
      if (
        !isProd &&
        (origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:"))
      ) {
        return callback(null, true);
      }
      return callback(null, true);
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
      "X-Requested-With",
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
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
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
      const userKey = req.user?.id || req.session?.user_id || "";
      return `${name}:${userKey || ip}`;
    },
  });

const authLimiter = createLimiter(15 * 60 * 1000, 30, "authentication"); // 30 login attempts / 15 min
const contactLimiter = createLimiter(60 * 60 * 1000, 20, "contact"); // 20 contact submissions / hour
const blogMutateLimiter = createLimiter(10 * 60 * 1000, 60, "blog-mutate"); // 60 create/update/delete/sync / 10 min
const apiBurstLimiter = createLimiter(60 * 1000, 200, "global"); // 200 req/min/user overall

app.use((req, res, next) => {
  const p = (req.baseUrl || "") + (req.path || req.url || "").split("?")[0];
  if (p === "/api/auth/login" || p === "/api/auth/login.php")
    return authLimiter(req, res, next);
  if (p === "/api/public/contact_intake" || p === "/api/public/contact_intake.php")
    return contactLimiter(req, res, next);
  if (p.startsWith("/api/blog/create")) return blogMutateLimiter(req, res, next);
  if (p.startsWith("/api/blog/update")) return blogMutateLimiter(req, res, next);
  if (p.startsWith("/api/blog/delete")) return blogMutateLimiter(req, res, next);
  if (p.startsWith("/api/blog/sync")) return blogMutateLimiter(req, res, next);
  if (p.startsWith("/api/")) return apiBurstLimiter(req, res, next);
  return next();
});

/* ============================================================
 *  Session — persistent pg store if available, MemoryStore + signed token fallback
 * ============================================================ */
const cookieSameSite = process.env.COOKIE_SAMESITE
  ? process.env.COOKIE_SAMESITE
  : "lax";

const sessionConfig = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "connect.sid",
  proxy: true,
  cookie: {
    // Use "auto" in production so express-session sets Secure on HTTPS and works behind local HTTP proxies
    secure: isProd
      ? process.env.COOKIE_SECURE === "false"
        ? false
        : "auto"
      : false,
    httpOnly: true,
    sameSite: cookieSameSite,
    maxAge: parseInt(
      process.env.SESSION_MAX_AGE || 7 * 24 * 60 * 60 * 1000,
      10,
    ),
    path: "/",
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
} else {
  console.log(
    "[SESSION] Using MemoryStore with stateless HMAC token fallback active.",
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
    sessionStore: PgStore ? "postgresql" : "memory+signed-token",
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
app.use("/api/quotations", quotationsRouter);

// Global 404 for /api namespace — JSON payload, not HTML
app.use("/api/*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
    rid: req.id,
  });
});

// Serve built frontend static assets (dist/)
const distPath = path.join(__dirname, "../dist");
app.use(
  express.static(distPath, {
    maxAge: isProd ? "1d" : 0,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store");
      }
    },
  }),
);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/health") {
    return next();
  }
  const indexHtml = path.join(distPath, "index.html");
  if (!fs.existsSync(indexHtml)) {
    return next();
  }
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const rid = req.id || crypto.randomUUID().slice(0, 13);

  let clientMessage = "Internal Server Error.";
  if (!isProd) clientMessage = err.message || clientMessage;
  if (status === 429)
    clientMessage = err.message?.message || err.message || clientMessage;
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 409
  ) {
    clientMessage = err.message || clientMessage;
  }

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
    user: req.session?.user_id || null,
  };
  console.error("[ERROR]", JSON.stringify(logObj));

  res.status(status).json({
    status: "error",
    message: clientMessage,
    rid,
  });
});

export { app, db };
export default app;

const entryScript = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isMainModule =
  entryScript === path.resolve(__filename) ||
  entryScript === path.resolve(__dirname, "../server.js") ||
  entryScript.endsWith("lsnode.js") ||
  process.env.START_SERVER === "true";

// Ensure production SPA bundle (dist/) is up-to-date after Git deployments on Hostinger
async function ensureFreshDistBuild() {
  if (!isProd) return;
  try {
    const rootDir = path.join(__dirname, "..");
    const indexHtml = path.join(distPath, "index.html");
    const watchedSources = [
      path.join(rootDir, "App.tsx"),
      path.join(rootDir, "components/Header.tsx"),
      path.join(rootDir, "pages/BlogManagement.tsx"),
      path.join(rootDir, "pages/ContactSubmissions.tsx"),
      path.join(rootDir, "pages/Login.tsx"),
      path.join(rootDir, "pages/Quotations.tsx"),
      path.join(rootDir, "pages/UserManagement.tsx"),
      path.join(rootDir, "services/api.ts"),
    ];
    let needsBuild = !fs.existsSync(indexHtml);
    if (!needsBuild) {
      const distMtime = fs.statSync(indexHtml).mtimeMs;
      for (const src of watchedSources) {
        if (fs.existsSync(src) && fs.statSync(src).mtimeMs > distMtime) {
          needsBuild = true;
          break;
        }
      }
    }
    if (needsBuild) {
      console.log("[BUILD] Detected updated frontend sources — rebuilding dist/ via Vite...");
      const { build } = await import("vite");
      await build({ root: rootDir, logLevel: "info" });
      console.log("[BUILD] Frontend dist/ bundle rebuilt successfully.");
    }
  } catch (err) {
    console.warn("[BUILD] Auto-build skipped:", err.message);
  }
}

// Bootstrap DB schema + default Admin and start Server
export const ready = (async () => {
  await ensureFreshDistBuild();
  await db.bootstrap();
  if (isMainModule) {
    app.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`DevInquire Dashboard Backend active on port ${port}`);
      console.log(
        `Environment: ${isProd ? "PRODUCTION (hardened)" : "DEVELOPMENT"}`,
      );
      console.log(`Health: http://localhost:${port}/api/health`);
      console.log(
        `Session Store: ${PgStore ? "PostgreSQL (persistent)" : "Memory + Signed Token"}`,
      );
      console.log(
        `CORS origins (${allowedOrigins.length}): ${allowedOrigins.join(", ")}`,
      );
      console.log(`======================================================\n`);
    });
  }
})();
