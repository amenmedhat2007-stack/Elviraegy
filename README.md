# Elvira Fragrance — secure production build

HTML + CSS + JavaScript + Vite + Supabase.

## Local

```cmd
npm install
npm run dev
```

## Build

```cmd
npm run build
```

## Supabase hardening

Run the existing migrations first, then run:

```text
supabase/upgrade-security.sql
```

Deploy the Edge Function:

```cmd
supabase functions deploy create-order
```

Set production secrets in Supabase Edge Functions:

```text
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_SALT=<long-random-secret>
ORDER_RATE_LIMIT=10
ORDER_RATE_WINDOW_SECONDS=600
ORDER_NOTIFY_EMAIL=amenmedhat2007@gmail.com
RESEND_API_KEY=<secret>
ELVIRA_FROM_EMAIL=Elvira Orders <orders@your-verified-domain.com>
REQUIRE_TURNSTILE=true
TURNSTILE_SECRET_KEY=<secret>
```

For the frontend, only use the Supabase Project URL and publishable key in `.env.local`. Never put a secret/service-role key into Vite env vars.

## High traffic

For a large public launch, deploy the Vite `dist` output behind a global CDN/WAF (Cloudflare Pages is the recommended documented path in `cloudflare/README.md`). Keep dynamic order creation on the Supabase Edge Function. 50,000 requests/second is a capacity target that requires a production-plan load test; it is not a property that can be guaranteed by code alone.

## Shipping cities update

Run `supabase/upgrade-shipping-cities.sql` once in the existing Supabase project. This creates individual editable cities and prices. Admin > Shipping lets you edit each city fee independently, and checkout reads the city-specific fee.

Order Excel exports include the customer's selected city in `City` and `City_Name` columns.
