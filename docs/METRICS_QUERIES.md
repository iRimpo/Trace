# Trace Metrics Queries

Save these in Supabase SQL Editor for weekly review. Run in Supabase Dashboard → SQL Editor.

## North Star

**Weekly Active Users (WAU)**
```sql
SELECT
  date_trunc('week', coalesce(practiced_at, created_at)) AS week,
  count(distinct user_id) AS wau
FROM public.practice_sessions
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;
```

**Median Sync Score Improvement** (users with 2+ sessions)
```sql
WITH first_last AS (
  SELECT user_id,
    (array_agg(sync_score ORDER BY coalesce(practiced_at, created_at)) FILTER (WHERE sync_score IS NOT NULL))[1] AS first_score,
    (array_agg(sync_score ORDER BY coalesce(practiced_at, created_at) DESC) FILTER (WHERE sync_score IS NOT NULL))[1] AS last_score
  FROM public.practice_sessions
  GROUP BY user_id
  HAVING count(*) FILTER (WHERE sync_score IS NOT NULL) >= 2
)
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (last_score - first_score)::numeric) AS median_improvement
FROM first_last;
```

## Acquisition

**Signups per week**
```sql
SELECT date_trunc('week', created_at) AS week, count(*) AS signups
FROM auth.users
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;
```

**Signups by activation code**
```sql
SELECT
  date_trunc('week', up.created_at) AS week,
  up.activation_code,
  count(*) AS signups
FROM public.user_profiles up
WHERE up.activation_code IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

## Activation Funnel

**Signup → Upload → Practice**
```sql
WITH signup AS (
  SELECT user_id, min(event_time) AS ts
  FROM public.product_events WHERE event_name = 'signup_completed'
  GROUP BY user_id
),
first_upload AS (
  SELECT user_id, min(event_time) AS ts
  FROM public.product_events WHERE event_name = 'video_uploaded'
  GROUP BY user_id
),
first_practice AS (
  SELECT user_id, min(event_time) AS ts
  FROM public.product_events WHERE event_name = 'practice_started'
  GROUP BY user_id
)
SELECT
  date_trunc('week', s.ts) AS signup_week,
  count(distinct s.user_id) AS signed_up,
  count(distinct u.user_id) AS uploaded,
  count(distinct p.user_id) AS practiced,
  round(100.0 * count(distinct u.user_id) / nullif(count(distinct s.user_id), 0), 1) AS pct_upload,
  round(100.0 * count(distinct p.user_id) / nullif(count(distinct u.user_id), 0), 1) AS pct_practice
FROM signup s
LEFT JOIN first_upload u ON u.user_id = s.user_id
LEFT JOIN first_practice p ON p.user_id = s.user_id
GROUP BY 1
ORDER BY 1 DESC;
```

## Engagement

**DAU (last 30 days)**
```sql
SELECT
  date_trunc('day', coalesce(practiced_at, created_at)) AS day,
  count(distinct user_id) AS dau
FROM public.practice_sessions
WHERE coalesce(practiced_at, created_at) >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

**Sessions per user per week**
```sql
SELECT
  date_trunc('week', coalesce(practiced_at, created_at)) AS week,
  user_id,
  count(*) AS sessions
FROM public.practice_sessions
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

## Retention

**D1 / D7 / D30 retention by signup week**
```sql
WITH signup AS (
  SELECT user_id, min(event_time) AS signed_up_at
  FROM public.product_events WHERE event_name = 'signup_completed'
  GROUP BY user_id
),
activity AS (
  SELECT user_id, coalesce(practiced_at, created_at) AS ts
  FROM public.practice_sessions
)
SELECT
  date_trunc('week', s.signed_up_at) AS signup_week,
  count(distinct s.user_id) AS cohort_size,
  count(distinct CASE WHEN a.ts <= s.signed_up_at + interval '1 day' THEN a.user_id END) AS retained_d1,
  count(distinct CASE WHEN a.ts <= s.signed_up_at + interval '7 days' THEN a.user_id END) AS retained_d7,
  count(distinct CASE WHEN a.ts <= s.signed_up_at + interval '30 days' THEN a.user_id END) AS retained_d30
FROM signup s
LEFT JOIN activity a ON a.user_id = s.user_id
GROUP BY 1
ORDER BY 1 DESC;
```

## Weekly PM Checklist

1. Run **WAU** and **Median Sync Improvement** (north star)
2. Run **Signups per week** and **Signups by code**
3. Run **Activation funnel** (signup → upload → practice)
4. Run **Retention** for recent cohorts
5. Note insights and next hypotheses
