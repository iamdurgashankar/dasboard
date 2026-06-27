# DevInquire Dashboard: Production Deployment Guide

This guide details how to deploy the JavaScript (Express/Node.js) backend and Vite/React frontend to a production server (VPS, Hostinger, Heroku, etc.) and connect it securely to Supabase.

---

## 💾 1. Database Setup (Supabase)

1. **Create Supabase Account**: Log in to [Supabase](https://supabase.com) and create a new project.
2. **Retrieve Connection String**:
   - Go to **Project Settings** -> **Database**.
   - Under **Connection string**, copy the URI (choose **Transaction** pooler mode or direct connection).
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres`
3. **Deploy Schema**:
   - Go to **SQL Editor** in Supabase dashboard.
   - Copy the contents of your [supabase_schema.sql](file:///Users/durgashankardasmangaraj/Downloads/devinquire/devinquire-dashboard/supabase_schema.sql) file.
   - Run the query to create all tables, indexes, constraints, and custom enums.

---

## 🖥️ 2. Backend Deployment (VPS or Node Server Host)

### A. Environment Configuration
Create a `.env` file inside your server directory in production:
```env
PORT=8001
NODE_ENV=production
SESSION_SECRET=your-random-long-session-secret-here

# Supabase Postgres Connection String
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres

# CORS allowed domains (comma separated)
ALLOWED_ORIGINS=https://dashboard.yourdomain.com

# Cookie settings
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

### B. PM2 Process Manager (Recommended for VPS)
Use `pm2` to run your backend process in the background and ensure it automatically restarts if the server reboots:
```bash
# Install PM2 globally
npm install pm2 -g

# Start server in production mode
pm2 start server.js --name "devinquire-backend"

# Ensure PM2 starts on boot
pm2 startup
pm2 save
```

---

## 🌐 3. Web Server & Proxy Config (Nginx)

We recommend using Nginx as a reverse proxy to handle SSL, serve built static React assets, and route API calls to the Express backend.

1. Install Nginx:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```
2. Copy the configuration template [nginx.conf.example](file:///Users/durgashankardasmangaraj/Downloads/devinquire/devinquire-dashboard/server/nginx.conf.example) to `/etc/nginx/sites-available/devinquire`.
3. Enable it and reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/devinquire /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 🎨 4. Frontend Deployment (CDNs or Static Web Hosts)

1. Create a `.env.production` file in your dashboard root directory:
   ```env
   VITE_API_BASE=https://dashboard.yourdomain.com/api
   ```
2. Build the optimized static assets:
   ```bash
   npm run build
   ```
3. Upload/deploy the contents of the `dist/` directory to your static hosting provider (Nginx web root, Firebase Hosting, Netlify, Hostinger public_html, etc.).
