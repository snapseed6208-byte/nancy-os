# Nancy OS — Production Deployment Guide

## Overview
- **Frontend**: Cloudflare Pages (SPA)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **GitHub**: https://github.com/snapseed6208-byte/nancy-os

## Cloudflare Pages Setup

### 1. Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Pages** → **Create a project** → **Connect to Git**
3. Authorize GitHub and select `snapseed6208-byte/nancy-os`
4. Configure build settings:

| Setting | Value |
|---------|-------|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

### 2. Environment Variables

Add these in Cloudflare Pages → Settings → Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://raiyrrehejwxfyzsjvxj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (see .env.local) |

### 3. Deploy

Click **Save and Deploy**. Cloudflare will build and deploy the site.

The site will be available at `https://nancy-os.pages.dev` (or custom domain).

### 4. SPA Routing

The `public/_redirects` file is already included:
```
/*    /index.html   200
```
This ensures client-side routing works correctly.

---

## Supabase Production Configuration

### 1. Auth Site URL

After deployment, update the Supabase Auth Site URL:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/raiyrrehejwxfyzsjvxj)
2. Navigate to **Authentication** → **Settings** → **Site URL**
3. Set to `https://nancy-os.pages.dev` (or your custom domain)
4. Add Redirect URLs:
   - `https://nancy-os.pages.dev/*`
   - `https://nancy-os.pages.dev`

### 2. Email Auth (Development)

For testing, disable email confirmations:
- **Authentication** → **Settings** → **Email** → Disable "Confirm email"

---

## Maintenance

### Deploy Updates
```bash
git add -A
git commit -m "Update description"
git push origin master
```
Cloudflare Pages auto-deploys on push to master.

### Deploy Edge Functions
```bash
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase functions deploy <function-name>
```

### Database Migrations
```bash
SUPABASE_ACCESS_TOKEN="sbp_..." npx supabase db push
```

### Production URLs
| Service | URL |
|---------|-----|
| App | https://nancy-os.pages.dev |
| Supabase API | https://raiyrrehejwxfyzsjvxj.supabase.co |
| GitHub | https://github.com/snapseed6208-byte/nancy-os |
