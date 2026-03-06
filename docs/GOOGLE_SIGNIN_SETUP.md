# Google sign-in setup (manual steps)

The app already has "Continue with Google" on the login and signup pages. To make it work, complete these steps once.

---

## Step 1: Get your Supabase callback URL

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Authentication** → **Providers** → **Google**.
3. Copy the **Callback URL** shown there. It looks like:
   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Keep this for Step 3.

---

## Step 2: Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one).
3. Open **APIs & Services** → **Credentials**.
4. Click **Create Credentials** → **OAuth client ID**.
5. If asked, set the **OAuth consent screen**:
   - User type: **External** (or Internal for workspace-only).
   - App name: e.g. **Trace**.
   - Support email: your email.
   - Save.
6. Back in **Create OAuth client ID**:
   - Application type: **Web application**.
   - Name: e.g. **Trace web**.
   - Under **Authorized redirect URIs**, click **Add URI** and paste the **Supabase callback URL** from Step 1:
     ```text
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```
   - Create.
7. Copy the **Client ID** and **Client secret**. You’ll need them in Step 3.

---

## Step 3: Enable Google in Supabase

1. In Supabase: **Authentication** → **Providers** → **Google**.
2. Turn **Enable Google** on.
3. Paste the **Client ID** and **Client secret** from Step 2.
4. Click **Save**.

---

## Step 4: Add your app URLs in Supabase

1. In Supabase go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to your app’s base URL:
   - Local: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. Under **Redirect URLs**, add the URLs Supabase may redirect to after sign-in (one per line). For example:
   - Local:
     ```text
     http://localhost:3000/auth/callback
     ```
   - Production:
     ```text
     https://yourdomain.com/auth/callback
     ```
4. Save.

---

## Step 5: Test

1. Run your app (`npm run dev`).
2. Open `/login` or `/signup`.
3. Click **Continue with Google** and complete the Google sign-in.
4. You should be redirected back to the app and logged in (e.g. on `/dashboard`).

If you see "redirect_uri_mismatch", double-check that the **Authorized redirect URI** in Google Cloud (Step 2) exactly matches the Supabase callback URL from Step 1.
