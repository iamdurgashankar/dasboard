<div align="center">
<img width="1200" height="475" alt="DevInquire Header" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DevInquire Pro Dashboard
**Advanced Administrative Orchestration & Telemetry Terminal**

A premium, secure, and AI-powered administrative console for the DevInquire ecosystem, featuring high-fidelity data visualization and real-time system signaling.

## 🚀 Overview
The DevInquire Pro Dashboard is built with a decoupled "Headless" architecture:
- **Frontend**: A performance-optimized React 19 application built with Vite 6.
- **Backend API**: A secure, high-velocity Pure PHP framework using PDO.
- **Intelligence**: Integrated Google Gemini AI for metrics summarization and technical orchestration.

## ✨ Key Features
- **Real-time Signal Ledger**: Identity-aware notification terminal with 30s telemetry polling.
- **AI Orchestration**: Integrated Lead Assistant for metrics analysis and blog content generation.
- **Dynamic Personalization**: Time-aware greetings and role-based identity context.
- **Data Visualization**: Interactive system health and velocity tracking via Recharts.
- **Build Optimization**: Advanced manual chunk splitting for superior cacheability and load times.

## 🔒 Security Hardening
- **Statful CSRF Protection**: Mandatory token validation on all mutating operations.
- **Neural Identity Vault**: Secure session management and Bcrypt password hashing.
- **SQLi Prevention**: 100% usage of PDO prepared statements in the API layer.
- **XSS Sanitization**: Centralized input filtering and output escaping.

## 📥 Setup & Installation

### 1. Requirements
- **Runtime**: Node.js v18+ & PHP v7.4+
- **Database**: MySQL v5.7+ or v8.0+

### 2. Deployment Steps
1. **Dependency Sync**: 
   ```bash
   npm install
   ```
2. **Environment Configuration**: 
   Add your `GEMINI_API_KEY` to `.env.local`.
3. **Database Ledger**: 
   Configure your live MySQL credentials in `includes/config.php`.
4. **System Initialization**: 
   Run `setup.php` on your server to provision the database schema and default admin.
   > **Note**: Initial credentials: `admin@devinquire.com` / `DevInquire2025!` (Change immediately).

### 3. Build Orchestration
```bash
# Generate optimized production assets
npm run build
```

---
**© 2026 DevInquire | Neural Architecture for Modern Developers**
