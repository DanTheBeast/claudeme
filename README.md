# CallMe 📞

A social app for spontaneous phone conversations. Know when your friends and family are available, and turn wasted moments into meaningful connections.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Hosting**: Vercel (free tier)

---

## 🚀 Setup Guide (Step by Step)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Give it a name (e.g., `callme`), set a database password, choose a region close to you
4. Wait ~2 minutes for setup to complete

### Step 2: Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from this project
4. Copy the **entire contents** and paste it into the SQL editor
5. Click **"Run"** — you should see "Success" messages

This creates:
- `profiles` table (user data)
- `friendships` table (friend connections)
- `availability_windows` table (weekly schedules)
- Row-level security policies (so users can only access their own data)
- Auto-profile creation on signup

### Step 3: Enable Email Auth

1. In Supabase dashboard, go to **Authentication → Providers**
2. Make sure **Email** is enabled (it should be by default)
3. For testing: go to **Authentication → Settings** and turn OFF "Confirm email" (toggle "Enable email confirmations" off). You can re-enable this later for production.

### Step 4: Get Your API Keys

1. In Supabase, go to **Settings → API**
2. Copy these two values:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### Step 5: Set Up the Code Locally

```bash
# Clone or download this project, then:
cd callme

# Install dependencies
npm install

# Create your environment file
cp .env.local.example .env.local
```

Now open `.env.local` and paste your Supabase values:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 6: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the CallMe login page!

### Step 7: Deploy to Vercel (Make it Live!)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial CallMe app"
   ```
   Then create a repo on [github.com](https://github.com) and push to it.

2. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account

3. Click **"Add New Project"** → Import your CallMe repo

4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

5. Click **"Deploy"**

6. In ~1 minute you'll get a live URL like `callme-abc123.vercel.app`

### Step 8: Update Supabase Auth Redirect

1. Go to Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g., `https://callme-abc123.vercel.app`)
3. Add your Vercel URL to **Redirect URLs**: `https://callme-abc123.vercel.app/callback`

**That's it — your app is live!** 🎉

---

## How It Works

- **Sign up** → creates an account + auto-generates a profile
- **Set availability** → big toggle on home page broadcasts to friends in realtime
- **Add friends** → search by name/email, send requests, accept/decline
- **Schedule** → set weekly windows when you're free for calls
- **Call** → tap the phone button to initiate a real phone call (uses `tel:` links)
- **Realtime** → Supabase Realtime pushes friend availability changes instantly

## Project Structure

```
callme/
├── app/
│   ├── _components/         # Shared UI components
│   │   ├── avatar.tsx
│   │   ├── bottom-nav.tsx
│   │   └── toast.tsx
│   ├── _lib/                # Utilities
│   │   ├── supabase-browser.ts
│   │   ├── supabase-server.ts
│   │   └── types.ts
│   ├── auth/page.tsx        # Sign in / Sign up
│   ├── callback/route.ts    # Auth callback handler
│   ├── (dashboard)/         # Auth-protected pages
│   │   ├── layout.tsx       # Dashboard layout + context
│   │   ├── page.tsx         # Home page
│   │   ├── friends/page.tsx
│   │   ├── schedule/page.tsx
│   │   └── profile/page.tsx
│   ├── globals.css
│   └── layout.tsx           # Root layout
├── middleware.ts             # Auth session refresh + redirects
├── supabase-schema.sql      # Database schema (run in Supabase SQL Editor)
├── .env.local.example       # Environment variable template
└── package.json
```

## Custom Domain (Optional)

1. In Vercel, go to your project → **Settings → Domains**
2. Add your custom domain (e.g., `callme.app`)
3. Follow the DNS instructions Vercel gives you
4. Update the Site URL in Supabase Authentication settings to match

## Need Help?

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
