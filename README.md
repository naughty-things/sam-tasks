# Sam Tasks - Team Task Management

A simple, free, self-hosted task management app for small teams (1-5 users).

## Features

- ✅ User authentication (each team member has their own account)
- ✅ Personal task lists (users only see their own tasks)
- ✅ Custom + preset statuses (Done, In Progress, Waiting, Not Started, or type your own)
- ✅ Projects with color coding
- ✅ Priority levels (High, Medium, Low)
- ✅ Due dates with overdue highlighting
- ✅ Filter by project, status, priority
- ✅ Access from anywhere (web-based)
- ✅ Free to host

## Tech Stack

- **Frontend**: Pure HTML/CSS/JS (no build required)
- **Backend**: Supabase (Authentication + PostgreSQL Database)
- **Hosting**: Railway (free tier)

## Deployment Guide

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in details:
   - Name: `sam-tasks` (or your choice)
   - Database Password: (generate a strong one, save it!)
   - Region: Choose closest to you
4. Click "Create new project"
5. Wait for setup to complete (2-3 minutes)

### Step 2: Get Supabase Credentials

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key (under "Project API keys")

### Step 3: Setup Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run**
5. You should see "Success" for each statement

### Step 4: Update Frontend Config

1. Open `frontend/js/supabase.js`
2. Replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### Step 5: Deploy to Railway

#### Option A: Deploy Frontend (Recommended - Static Hosting)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and sign up/login with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repo
5. Railway will auto-detect it's a static site
6. **Important**: Set the root directory to `frontend`
   - Click on the deployment → Settings → Root Directory: `frontend`
7. Add custom domain (optional):
   - Go to Settings → Domains
   - Add your domain (e.g., tasks.yourcompany.com)
8. Your app is now live! 🎉

#### Option B: Alternative Static Hosting

If Railway's static hosting doesn't work, you can use:
- **Netlify**: netlify.com (drag & drop the `frontend` folder)
- **Vercel**: vercel.com (import from GitHub)
- **GitHub Pages**: free, but requires adding a `CNAME` file

### Step 6: Test Your Deployment

1. Open your deployed URL
2. You should see the login page
3. Click "Register" to create your first account
4. Login and start adding tasks!

## Project Structure

```
sam-tasks/
├── frontend/
│   ├── index.html          # Main dashboard
│   ├── login.html           # Login page
│   ├── register.html        # Registration page
│   ├── css/
│   │   └── style.css        # Styles
│   └── js/
│       ├── supabase.js      # Supabase config (EDIT THIS!)
│       ├── auth.js          # Authentication logic
│       ├── tasks.js         # Task CRUD operations
│       └── app.js           # Main app logic
├── supabase/
│   └── schema.sql           # Database schema
└── README.md                # This file
```

## Customization

### Change App Name

Edit these files:
- `frontend/index.html` (change "Sam Tasks" in navbar)
- `frontend/login.html` (change title and h1)
- `frontend/register.html` (change title and h1)

### Modify Task Fields

Edit `supabase/schema.sql` to add/remove columns, then update the frontend forms accordingly.

### Add More Users

1. Each user registers their own account at `/register.html`
2. They see only their own tasks
3. No admin panel needed (simple!)

## Troubleshooting

### "Invalid API key" error
- Check your Supabase URL and anon key are correct in `supabase.js`
- Make sure you copied the "anon public" key, not the "service_role" key

### Database tables not found
- Run the `schema.sql` in Supabase SQL Editor again
- Make sure all statements completed without errors

### CORS errors
- In Supabase: Settings → API → CORS
- Add your Railway/Netlify URL (e.g., `https://sam-tasks.up.railway.app`)

### Users can't register
- In Supabase: Authentication → Settings → Email auth
- Check "Enable email signup" is turned on

## Cost

- **Supabase**: Free tier (500MB database, 50K monthly users)
- **Railway**: Free tier (500 hours/month, enough for 1-5 users)
- **Total**: $0/month

## Security Notes

- Each user can ONLY see their own tasks (enforced by Supabase Row Level Security)
- Passwords are hashed by Supabase Auth
- All data is encrypted in transit (HTTPS)
- For sensitive data, enable 2FA in Supabase Auth settings

## Support

If you need help deploying or modifying this app, ask Naughty!
