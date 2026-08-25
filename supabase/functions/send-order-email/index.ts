import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const TO_EMAIL = 'amenmedhat2007@gmail.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('ELVIRA_FROM_EMAIL') || 'Elvira Orders <onboarding@resend.dev>';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
    const body = await req.json();
    const subject = `New Elvira order ${body.order_number || ''}`;
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#32143f"><h2>New Elvira order</h2><p><strong>Order:</strong> ${esc(body.order_number)}</p><h3>Customer</h3><p>${esc(body.customer_name)}<br>WhatsApp: ${esc(body.whatsapp)}<br>Phone: ${esc(body.phone)}<br>City: ${esc(body.city)}<br>Address: ${esc(body.address)}</p><h3>Purchase</h3><p>${esc(body.product_name)} × ${esc(body.quantity)}</p><p>Subtotal: EGP ${esc(body.subtotal)}<br>Discount: EGP ${esc(body.discount)}<br>Shipping: EGP ${esc(body.shipping_fee)}<br><strong>Total: EGP ${esc(body.total)}</strong></p></body></html>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${RESEND_API_KEY}`},
      body: JSON.stringify({from:FROM_EMAIL,to:[TO_EMAIL],subject,html})
    });
    if (!r.ok) throw new Error(`Resend returned ${r.status}: ${await r.text()}`);
    return Response.json({ok:true});
  } catch (err) {
    return Response.json({ok:false,error:String(err)}, {status:500});
  }
});
