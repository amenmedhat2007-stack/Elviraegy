# Elvira high-traffic deployment

Recommended production shape:

- Frontend: Cloudflare Pages (global CDN)
- Database/auth/storage: Supabase
- Orders/email: Supabase Edge Function `create-order`
- DDoS/WAF/bot protection: Cloudflare

Cloudflare Pages accepts Vite projects with `npm run build` and `dist` output.

For production, set these Supabase Edge Function secrets:

- `ALLOWED_ORIGINS=https://your-domain.com`
- `RATE_LIMIT_SALT=<long-random-secret>`
- `ORDER_RATE_LIMIT=10`
- `ORDER_RATE_WINDOW_SECONDS=600`
- `ORDER_NOTIFY_EMAIL=amenmedhat2007@gmail.com`
- `RESEND_API_KEY=<resend-secret>`
- `ELVIRA_FROM_EMAIL=Elvira Orders <orders@your-verified-domain.com>`
- `REQUIRE_TURNSTILE=true`
- `TURNSTILE_SECRET_KEY=<cloudflare-turnstile-secret>`

Keep Supabase secret keys only inside Edge Function secrets. Never put them in Vite environment variables or browser code.
