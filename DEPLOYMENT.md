# Vyra — Deployment Guide

> Last updated: 2026-07-13

---

## Project Overview

| Part | Tech Stack | Repo / Location |
|------|-----------|-----------------|
| Backend | Node.js + Express + Prisma + PostgreSQL | `github.com/fathimavafiya-netizen/vyra-backend` |
| Mobile App | React Native + Expo | `d:\Desktop\vyra\mobile` |
| Deployment | Render (backend) + EAS (mobile) | `https://vyra-backend.onrender.com` |

---

## 1. Backend — Local Development

### Prerequisites
- Node.js >= 18
- npm
- (Optional) PostgreSQL — SQLite is used locally by default

### Setup

```bash
cd d:\Desktop\vyra\backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to local DB
npx prisma db push

# Create the admin user (REQUIRED after first DB setup)
npx ts-node scripts/createAdmin.ts

# Start dev server on port 5000
npm run dev
```

### Admin Credentials (Local)

```
Email:    admin@vyra.com
Password: admin123
```

> Always run `createAdmin.ts` after a fresh DB setup or DB reset.

### Environment Variables (`.env`)

```env
NODE_ENV=development
PORT=5000
DATABASE_URL="file:./dev.db"

JWT_SECRET="vyra_super_secret_access_token_key_2026"
JWT_REFRESH_SECRET="vyra_super_secret_refresh_token_key_2026"

# Email OTP (Resend)
RESEND_API_KEY="re_6uiGnUrL_..."
EMAIL_FROM="onboarding@resend.dev"

# SMS OTP — India (Fast2SMS)
FAST2SMS_API_KEY="FEc40awure..."

# SMS OTP — USA (Twilio)
TWILIO_ACCOUNT_SID="AC0d2365..."
TWILIO_AUTH_TOKEN="3ada2b0f..."
TWILIO_PHONE_NUMBER="+17622912430"

# Media storage (Cloudinary — optional, falls back to local uploads/)
CLOUDINARY_NAME="vyra_cloudinary"
CLOUDINARY_KEY="..."
CLOUDINARY_SECRET="..."

# Redis (optional — uses in-memory MockRedis if not set)
# REDIS_URL="redis://..."
```

---

## 2. Backend — Production (Render)

### Current Deployment Info

| Field | Value |
|-------|-------|
| URL | `https://vyra-backend.onrender.com` |
| GitHub Repo | `github.com/fathimavafiya-netizen/vyra-backend` |
| Database | PostgreSQL (set via Render env vars) |
| Build Command | `npm run build` (runs `npx prisma generate && tsc`) |
| Start Command | `npm start` (runs `node dist/server.js`) |
| Branch | `main` (auto-deploys on push) |

### How to Deploy

```bash
# 1. Stage all backend changes
git add .

# 2. Commit
git commit -m "feat: <description of changes>"

# 3. Push — triggers Render auto-deploy
git push origin main
```

### Render Environment Variables (set in Render dashboard)

```
NODE_ENV=production
DATABASE_URL=<postgresql connection string>
JWT_SECRET=<strong random secret>
JWT_REFRESH_SECRET=<strong random refresh secret>
RESEND_API_KEY=...
EMAIL_FROM=...
FAST2SMS_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
CLOUDINARY_NAME=...
CLOUDINARY_KEY=...
CLOUDINARY_SECRET=...
GOOGLE_CLIENT_ID=...
```

> After a new production deploy, seed the admin user via Render Shell:
> `npx ts-node scripts/createAdmin.ts`

### Pending Backend Changes (not yet committed)

| File | What Changed |
|------|-------------|
| `prisma/schema.prisma` | DB provider: sqlite to postgresql; added index on Post(type, createdAt) |
| `src/auth/facade/AuthenticationFacade.ts` | Added `isNewUser` field to login response |
| `src/services/UserService.ts` | Added Redis/in-memory cache (5 min TTL) on `getProfile()` |
| `scripts/createAdmin.ts` | New admin seeder script |
| `src/__tests__/` | New compatibility test suite |
| `ecosystem.config.js` | PM2 cluster mode config |
| `jest.config.js` | Jest test configuration |
| `package.json` / `package-lock.json` | Dependency updates |

---

## 3. Mobile App — Local Development

### Setup

```bash
cd d:\Desktop\vyra\mobile
npm install
npx expo start
```

### Switching the API URL — `src/services/api.ts`

```ts
const LOCAL_URL  = 'http://172.20.10.2:5000/api/v1';             // PC on same WiFi (current IP)
const TUNNEL_URL = 'https://<tunnel-url>/api/v1';                // Tunnel for LTE/5G
const PROD_URL   = 'https://vyra-backend.onrender.com/api/v1';  // Render production

// Change this ONE line to switch:
return LOCAL_URL;   // currently active
```

| Scenario | Use |
|----------|-----|
| Phone on same WiFi as PC | `LOCAL_URL` — update IP if changed (`ipconfig`) |
| Phone on LTE / mobile data | `TUNNEL_URL` — run `npx localtunnel --port 5000` or ngrok |
| Production / mentor demo | `PROD_URL` |

> Windows Firewall rule — must be added once (Admin PowerShell):
> netsh advfirewall firewall add rule name="Vyra Backend 5000" protocol=TCP dir=in localport=5000 action=allow

### Pending Mobile Changes (not yet committed)

| File | What Changed |
|------|-------------|
| `src/services/api.ts` | LOCAL_URL updated to 172.20.10.2; env switching comments added |
| `src/screens/Home/PostDetailScreen.tsx` | Fixed React key collision in comments list |
| `src/contexts/AuthContext.tsx` | Auth improvements |
| `src/screens/Auth/LoginScreen.tsx` | Admin tab login improvements |

---

## 4. Mobile App — Production Build (EAS)

### Build Profiles (`eas.json`)

| Profile | Distribution | Use Case |
|---------|-------------|----------|
| `development` | Internal | Dev client testing |
| `preview` | APK (internal) | QA / mentor testing |
| `production` | App Store | Public release |

### Build Commands

```bash
# Preview APK for Android — for testers/mentors
eas build --profile preview --platform android

# Production Android
eas build --profile production --platform android

# Production iOS
eas build --profile production --platform ios

# OTA JS-only update (no new native build needed)
eas update --branch production --message "Fix: description"
```

> Before any production build, switch api.ts to: return PROD_URL;

---

## 5. Admin Panel

The admin panel lives inside the mobile app and is visible only to ADMIN / MODERATOR role users.

**Access path:**
1. Login screen > ADMIN tab > enter credentials
2. OR: Settings > Administration > Admin Panel

**Credentials:**
```
Email:    admin@vyra.com
Password: admin123
```

Admin features: Dashboard metrics, user moderation (ban/unban/promote), report resolution, content moderation, story moderation.

---

## 6. Known Issues

| Issue | Status | Fix / Notes |
|-------|--------|-------------|
| Localtunnel dies frequently | Unreliable | Use WiFi or ngrok with auth token |
| Cloudflare tunnel port 7844 blocked | Blocked on this network | Use WiFi instead |
| Render free tier cold start | ~30s delay | First request after idle is slow |
| Admin user requires manual seeding | Manual | Run `npx ts-node scripts/createAdmin.ts` |
| PC IP changes between sessions | Manual | Run `ipconfig`, update LOCAL_URL in api.ts |
| prisma/schema.prisma uses postgresql | Production-ready | Local .env must keep DATABASE_URL="file:./dev.db" |
