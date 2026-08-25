# Elvira production security model

## What is protected
- Browser never receives a Supabase secret/service key.
- Public order creation no longer calls a privileged database RPC directly; the browser calls the `create-order` Edge Function.
- The Edge Function validates origin, publishable API key, request size, quantity, customer fields, idempotency key, and per-IP rate limit.
- Order pricing, offers, stock checks, shipping fee, and stock deduction are calculated transactionally in PostgreSQL.
- Duplicate order retries are made idempotent with `client_request_id`.
- Orders and order items remain admin-only under RLS.
- Security headers/CSP are included for Cloudflare Pages and Vercel.
- Admin/data writes continue to require Supabase Auth + RLS.

## Recommended Supabase controls
1. Require MFA for the admin account and organization/team account.
2. Keep publishable keys only in the frontend.
3. Keep secret/service keys only in Edge Function secrets.
4. Enable database backups/PITR on the production plan.
5. Set WAF/rate-limit rules at the CDN edge.
6. Load-test the real production plan before any 50k/sec launch.

## About 50,000 requests/second
No honest application can promise “non-hackable” or 50,000 dynamic database operations per second solely through code. The design here separates static traffic from sensitive operations: the HTML/CSS/JS/images should be served by a global CDN, while the database is protected behind RLS and a rate-limited Edge Function.

Static page traffic can scale far beyond database traffic when served from a CDN. Database writes (orders) are intentionally rate-limited and serialized around stock updates so correctness wins over raw request volume.
