import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200, extra: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

const corsHeaders = (origin: string, allowed: string[]) => {
  const ok = allowed.includes(origin);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Vary': 'Origin',
  } : {};
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const cors = corsHeaders(origin, allowed);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, cors);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const apiKey = req.headers.get('apikey') ?? '';
  const publishable = (() => {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
      return String(keys.default ?? '');
    } catch { return ''; }
  })();
  if (!publishable || apiKey !== publishable) return json({ error: 'Unauthorized' }, 401, cors);

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 20000) return json({ error: 'Request too large' }, 413, cors);

  const forwarded = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ip = forwarded.split(',')[0].trim();
  const salt = Deno.env.get('RATE_LIMIT_SALT') ?? '';
  const rateKey = await sha256(`${salt}:${ip}`);

  const secretKeys = (() => {
    try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); } catch { return {}; }
  })();
  const secret = String(secretKeys.default ?? '');
  if (!secret) return json({ error: 'Server is not configured' }, 500, cors);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'elvira-order-edge' } },
  });

  const limit = Number(Deno.env.get('ORDER_RATE_LIMIT') ?? '10');
  const windowSeconds = Number(Deno.env.get('ORDER_RATE_WINDOW_SECONDS') ?? '600');
  const { data: allowedRate, error: rateError } = await admin.rpc('consume_order_rate_limit', {
    p_key: rateKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (rateError || allowedRate === false) return json({ error: 'Too many order attempts. Please try again later.' }, 429, { ...cors, 'Retry-After': String(windowSeconds) });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, cors); }

  const productId = clean(body.product_id, 64);
  const quantity = Number(body.quantity);
  const name = clean(body.customer_name, 160);
  const whatsapp = clean(body.whatsapp, 30);
  const phone = clean(body.phone, 30);
  const address = clean(body.address, 500);
  const city = clean(body.city, 120);
  const clientRequestId = clean(body.client_request_id, 80);

  if (!/^[0-9a-f-]{36}$/i.test(productId)) return json({ error: 'Invalid product' }, 400, cors);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json({ error: 'Quantity must be between 1 and 10.' }, 400, cors);
  if (!name || name.length < 2 || !/[A-Za-z\u0600-\u06FF]/.test(name)) return json({ error: 'Please enter your full name.' }, 400, cors);
  if (!/^[0-9+()\-\s]{6,30}$/.test(whatsapp) || !/^[0-9+()\-\s]{6,30}$/.test(phone)) return json({ error: 'Please enter valid phone numbers.' }, 400, cors);
  if (address.length < 5) return json({ error: 'Please enter your delivery address.' }, 400, cors);
  if (city.length < 2) return json({ error: 'Please choose your city.' }, 400, cors);
  if (!/^[A-Za-z0-9-]{8,80}$/.test(clientRequestId)) return json({ error: 'Invalid request id.' }, 400, cors);

  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') ?? '';
  const requireTurnstile = (Deno.env.get('REQUIRE_TURNSTILE') ?? 'false').toLowerCase() === 'true';
  if (requireTurnstile) {
    const token = clean(body.turnstile_token, 4096);
    if (!token) return json({ error: 'Security verification required.' }, 403, cors);
    if (!turnstileSecret) return json({ error: 'Security verification is not configured.' }, 500, cors);
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip }),
    });
    const result = await verify.json();
    if (!result.success) return json({ error: 'Security verification failed.' }, 403, cors);
  }

  const { data, error } = await admin.rpc('place_order_by_city_secure', {
    p_product_id: productId,
    p_quantity: quantity,
    p_customer_name: name,
    p_whatsapp: whatsapp,
    p_phone: phone,
    p_address: address,
    p_city: city,
    p_client_request_id: clientRequestId,
  });
  if (error) return json({ error: error.message }, 400, cors);

  const order = Array.isArray(data) ? data[0] : data;
  const notifyTo = Deno.env.get('ORDER_NOTIFY_EMAIL') ?? 'amenmedhat2007@gmail.com';
  const resend = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('ELVIRA_FROM_EMAIL') ?? '';

  if (resend && from && order?.order_number) {
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif"><h2>New Elvira order ${order.order_number}</h2><p><b>Customer:</b> ${name}</p><p><b>WhatsApp:</b> ${whatsapp}</p><p><b>Phone:</b> ${phone}</p><p><b>City:</b> ${city}</p><p><b>Address:</b> ${address}</p><hr><p><b>Order total:</b> EGP ${Number(order.total ?? 0).toFixed(2)}</p><p><b>Shipping:</b> EGP ${Number(order.shipping_fee ?? 0).toFixed(2)}</p><p><b>Discount:</b> EGP ${Number(order.discount ?? 0).toFixed(2)}</p></body></html>`;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${resend}` },
        body: JSON.stringify({ from, to: [notifyTo], subject: `New Elvira order ${order.order_number}`, html }),
      });
    } catch { /* order remains successful even if email provider is temporarily unavailable */ }
  }

  return json(order, 200, { ...cors, 'Cache-Control': 'no-store' });
});
