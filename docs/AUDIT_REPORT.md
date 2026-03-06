# Security & Logic Audit Report

Audit of the Trace codebase: security (SAST) and logic/efficiency.

---

## 1. Security Vulnerabilities (SAST)

### 1.1 Open redirect (auth callback)

**Location:** [app/auth/callback/route.ts](app/auth/callback/route.ts)

**Issue:** The `next` query parameter is passed directly to `new URL(next, requestUrl.origin)`. If an attacker tricks a user into visiting e.g. `/auth/callback?code=...&next=https://evil.com`, the redirect will send the user to the attacker’s site after sign-in (open redirect).

**Risk:** Phishing and abuse of user trust; in some setups it can worsen OAuth token exposure.

**Fix:** Allow only same-origin paths: require `next` to start with `/` and not with `//`, and optionally allowlist paths.

```ts
// app/auth/callback/route.ts
const rawNext = requestUrl.searchParams.get("next") ?? "/dashboard";
const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
  ? rawNext
  : "/dashboard";
// ... then redirect to new URL(next, requestUrl.origin)
```

---

### 1.2 Path traversal in signed URL (storage path)

**Location:** [app/api/signed-url/route.ts](app/api/signed-url/route.ts)

**Issue:** The path is checked with `path.startsWith(`${userId}/`)` but not normalized. A path like `userId/../../../other-user/file` could still pass and access another user’s object if storage resolves `..`.

**Risk:** Unauthorized read access to other users’ files in storage.

**Fix:** Reject paths that contain `..` or that, after normalization, do not start with `userId/`.

```ts
const path = (await req.json()).path?.trim();
if (!path || path.includes("..") || !path.startsWith(`${userId}/`)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
const normalized = path.split("/").filter(Boolean).join("/");
if (!normalized.startsWith(userId)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// use normalized (or path) for createSignedUrl
```

---

### 1.3 Session fixation / prefer getUser in middleware

**Location:** [middleware.ts](middleware.ts)

**Issue:** The code uses `getSession()` which reads from cookies. Supabase recommends `getUser()` for server-side auth to validate the JWT and avoid relying on a possibly tampered session cookie.

**Risk:** Slightly higher risk of session fixation or cookie tampering; `getUser()` is the recommended server-side check.

**Fix:** Use `getUser()` instead of `getSession()` and check `user`:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/practice"))) {
  // redirect to login
}
if (user && (pathname === "/login" || pathname === "/signup")) {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

---

### 1.4 DELETE /api/sessions: validate and limit input

**Location:** [app/api/sessions/route.ts](app/api/sessions/route.ts)

**Issue:** The body’s `ids` array is sent directly to `.in("id", ids)`. No check that each element is a UUID or that the array size is bounded, so an attacker could send a huge or malformed list.

**Risk:** DoS (large payload, heavy DB work) or unexpected behavior; Supabase will only match valid UUIDs, but validating and capping is good practice.

**Fix:** Validate UUIDs and cap length:

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ids = (await req.json())?.ids;
if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
  return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
}
const validIds = ids.filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id));
if (validIds.length === 0) return NextResponse.json({ error: "No valid IDs" }, { status: 400 });
// use validIds in .in("id", validIds)
```

---

### 1.5 Waitlist: no auth and minimal validation

**Location:** [app/api/waitlist/route.ts](app/api/waitlist/route.ts)

**Issue:** The endpoint is unauthenticated and only checks `typeof email === "string"`. No format or length validation, and no rate limiting in code.

**Risk:** Spam, abuse, or malformed data in the waitlist table.

**Fix:** Add basic email format and length validation; consider rate limiting (e.g. Upstash or middleware) in production:

```ts
const email = (await req.json())?.email;
if (!email || typeof email !== "string") {
  return NextResponse.json({ error: "Email is required" }, { status: 400 });
}
const trimmed = email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 255) {
  return NextResponse.json({ error: "Invalid email" }, { status: 400 });
}
// use trimmed in upsert
```

---

### 1.6 Debug endpoint in production

**Location:** [app/api/debug/route.ts](app/api/debug/route.ts)

**Issue:** The file states “Remove this file before deploying to production” but is still present. It returns DB and schema details for the authenticated user.

**Risk:** Information disclosure about schema and data; useful for attackers to plan further attacks.

**Fix:** Remove [app/api/debug/route.ts](app/api/debug/route.ts) before production, or guard with an env check and disable in production:

```ts
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
```

---

### 1.7 Hardcoded secrets / env placeholders

**Location:** [lib/supabase-env.ts](lib/supabase-env.ts)

**Issue:** Fallbacks `"https://placeholder.supabase.co"` and `"placeholder-anon-key"` are used when env vars are missing. If deployed without setting `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the app could point at a placeholder or leak the placeholder value.

**Risk:** Misconfiguration in production; no real “secret” is hardcoded, but behavior is unsafe if env is unset.

**Fix:** In production builds, avoid using placeholders or fail fast:

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (process.env.NODE_ENV === "production" && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
export const supabaseUrl = supabaseUrl ?? "https://placeholder.supabase.co";
export const supabaseAnonKey = supabaseAnonKey ?? "placeholder-anon-key";
```

---

### 1.8 SQL / command injection

**Assessment:** Supabase client is used with parameterized APIs (`.eq()`, `.in()`, `.insert()`, etc.). No raw SQL or shell command execution was found. **No SQL or command injection issues identified.**

---

### 1.9 XSS

**Assessment:** No `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` usage found. React’s default escaping is in place. **No XSS issues identified** in the audited code.

---

### 1.10 Dependencies

**Assessment:** [package.json](package.json) uses common libraries (Next 14, React 18, Supabase SSR, Framer Motion, etc.). `@supabase/auth-helpers-nextjs` is present; Supabase recommends `@supabase/ssr` for new apps (which you also use). Consider removing `@supabase/auth-helpers-nextjs` if unused to reduce surface and avoid deprecated usage. Run `npm audit` and fix any reported vulnerabilities.

---

## 2. Logic & Efficiency Optimization

### 2.1 O(1) lookup for deleted IDs (dashboard delete)

**Location:** [app/dashboard/page.tsx](app/dashboard/page.tsx) – `handleDelete`

**Issue:** `deletedIds.includes(a.id)` is used inside a `.filter()`, so for each attempt you do a linear scan over `deletedIds`. With many cards and many attempts this is O(attempts × deletedIds.length).

**Risk:** Minor; only matters with large lists.

**Fix:** Use a `Set` for O(1) lookup:

```ts
function handleDelete(deletedIds: string[]) {
  const idSet = new Set(deletedIds);
  setProgress(prev => {
    if (!prev) return prev;
    const newSongs = prev.songs
      .map(g => ({
        ...g,
        attempts: g.attempts.filter(a => !idSet.has(a.id)),
      }))
      // ... rest unchanged
  });
}
```

---

### 2.2 Redundant iteration in progress API (group stats)

**Location:** [app/api/progress/route.ts](app/api/progress/route.ts)

**Issue:** After building `groupMap`, the code does a second pass over `groupMap.values()` to sort attempts, compute stats, and push to `songs`. Then `allDates` is built from the original `sessions` again. The logic is clear but does two passes over groups and could be merged into one if desired.

**Risk:** Negligible; single O(n) passes. No change strictly required.

**Suggestion:** You could compute streak from the same loop where you build `songs`, or keep the current structure for readability. No refactor snippet unless you want to merge loops.

---

### 2.3 N signed-URL requests (one per card)

**Location:** [components/dashboard/SongCard.tsx](components/dashboard/SongCard.tsx) and [lib/useSignedUrl.ts](lib/useSignedUrl.ts)

**Issue:** Each `SongCard` calls `useSignedUrl(group.thumbnailUrl)`, so N cards cause N parallel POSTs to `/api/signed-url`. That can mean many requests and more load on the server.

**Risk:** Higher latency and server load with many cards; possible rate limiting or throttling.

**Fix (optional):** Add a batch signed-URL API and a hook (or provider) that requests multiple paths in one call, then caches by path. Alternatively, keep the current approach and add a small in-memory cache in the hook (e.g. by `videoUrl`) so repeated mounts for the same URL don’t refetch. Example cache in the hook:

```ts
// lib/useSignedUrl.ts – simple cache to avoid duplicate fetches for same path
const urlCache = new Map<string, string>();
export function useSignedUrl(videoUrl: string | undefined) {
  const [url, setUrl] = useState<string | null>(videoUrl ? urlCache.get(videoUrl) ?? null : null);
  const [loading, setLoading] = useState(!!videoUrl && !urlCache.has(videoUrl));
  // ... in fetchSignedUrl, on success: urlCache.set(videoUrl, data.url); setUrl(data.url);
}
```

(Ensure cache invalidation or size limits if needed.)

---

### 2.4 AnimCount interval cleanup

**Location:** [app/dashboard/page.tsx](app/dashboard/page.tsx) – `AnimCount`

**Issue:** The effect clears the interval when `cur >= n`, but if the component unmounts before the animation finishes, the interval might still be cleared in the effect return. Current code does `return () => clearInterval(id);` – that’s correct. No bug found; just confirming cleanup is correct.

**No change required.**

---

### 2.5 Worker: binary search and complexity

**Location:** [public/workers/sync-scorer.js](public/workers/sync-scorer.js)

**Assessment:** For each user frame, a binary search finds the nearest ref frame (O(log R) where R = ref frames), then scoring is O(1) per frame. Overall O(U log R) for U user frames – good. No O(n²) or worse in the worker.

---

### 2.6 Middleware: public route check

**Location:** [middleware.ts](middleware.ts)

**Issue:** `publicRoutes.includes(pathname)` is O(n) in the number of public routes (small). For a larger list, a `Set` would be O(1). Not urgent.

**Optional fix:**

```ts
const publicRouteSet = new Set(["/", "/login", "/signup", "/forgot-password", "/auth/callback"]);
if (publicRouteSet.has(pathname) || ...) return res;
```

---

### 2.7 useCallback / useMemo usage

**Assessment:** [PracticeView](components/practice/PracticeView.tsx), [TestTab](components/practice/TestTab.tsx), and [SyncTab](components/practice/SyncTab.tsx) use `useCallback` for handlers passed to children, which is appropriate. No unnecessary re-renders or missing dependencies stood out in the audited code. Heavy computation (e.g. in SyncTab or CalibrationModal) could be wrapped in `useMemo` if profiling shows need; no change recommended without metrics.

---

## Summary

| Category              | Count | Severity |
|-----------------------|-------|----------|
| Open redirect         | 1     | Medium   |
| Path traversal        | 1     | Medium   |
| Auth/session          | 1     | Low      |
| Input validation      | 2     | Low      |
| Debug endpoint        | 1     | Low      |
| Env/placeholders      | 1     | Low      |
| Efficiency (Set/cache)| 2     | Low      |

**Recommended order of work:** Fix open redirect and path traversal first, then session validation and input validation (sessions, waitlist), then remove or protect the debug route and harden env handling. Efficiency changes (Set for delete IDs, optional signed-URL batching/cache) can follow as needed.
