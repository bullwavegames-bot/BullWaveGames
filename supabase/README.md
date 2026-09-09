# Supabase Auth (frontend)

Passwords live in **Supabase Auth** (`auth.users`), not in the browser and not in `public.profiles`.

## Project dashboard (required before signup emails work)

1. Create a project at supabase.com.
2. **Authentication → Providers → Email** — enable Email. Keep **Confirm email** on for production.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173` (later `https://bullwavegames.com`)
   - Redirect URLs:  
     `http://localhost:5173/verify-email`  
     `http://localhost:5173/reset-password`  
     and the same paths on the live domain
4. **SQL Editor** — run `supabase/profiles.sql` once.
5. Copy **Project URL** and **anon public** key into the repo root `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never put the **service_role** key in the Vite app.

## How an account is made

1. The site calls `signUp({ email, password })`.
2. Supabase hashes the password and inserts `auth.users`.
3. A database trigger inserts `public.profiles` (name, avatar, `role = player`).
4. Supabase emails a confirm link. Until that link is opened, `email_confirmed_at` is null and `/welcome` is blocked.
5. After confirm, the user lands on `/verify-email`, then `/welcome` (name/avatar), then `/play`.

Promote an admin only in SQL:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
```

Do **not** create `operations@bullwavegames.com` in production. That login was prototype-only (`studio-ops-prototype`) and is no longer seeded.
