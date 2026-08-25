import { supabase } from './supabase.js';
import './style.css';
import { contentFrom } from './site-content.js';

const app = document.querySelector('#app');
const id = new URLSearchParams(location.search).get('id');
const esc = s => String(s ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const safe = u => { try { return new URL(u || '', location.origin).href; } catch { return '#'; } };
const money = n => new Intl.NumberFormat('en-US', { style:'currency', currency:'EGP', maximumFractionDigits:0 }).format(Number(n) || 0);
const activeOffer = o => o && o.active && (!o.starts_at || new Date(o.starts_at) <= new Date()) && (!o.ends_at || new Date(o.ends_at) >= new Date());
const finalPrice = (p, o) => {
  if (!o) return Number(p.price) || 0;
  return o.discount_type === 'percent'
    ? Math.max(0, Number(p.price) * (1 - Number(o.discount_value) / 100))
    : Math.max(0, Number(p.price) - Number(o.discount_value));
};
const fallbackCities = [
  ['Cairo',80],['Giza',80],['Qalyubia',80],['Alexandria',100],['Mansoura',100],['Tanta',100],['Zagazig',100],['Kafr El Sheikh',100],['Damanhur',100],['Banha',100],['Damietta',100],['Port Said',100],['Ismailia',100],['Suez',100],['Fayoum',120],['Beni Suef',120],['Minya',120],['Asyut',120],['Sohag',120],['Qena',120],['Luxor',120],['Aswan',120],['Hurghada',150],['Marsa Alam',150],['Sharm El Sheikh',150],['El Tor',150],['Matrouh',150],['New Valley',150],['Other',150]
];

function getCart(){ try { return JSON.parse(localStorage.getItem('elvira-cart') || '[]'); } catch { return []; } }
function setCart(items){ localStorage.setItem('elvira-cart', JSON.stringify(items)); }

async function load(){
  let p = null, s = { logo_url:'elvira-logo-black.png' }, offers = [], zones = [], cities = [];
  if(supabase){
    const [r, st, o, z, ci] = await Promise.all([
      supabase.from('products').select('*,categories(name,slug,gender),product_images(*)').eq('id', id).single(),
      supabase.from('site_settings').select('*').eq('id',1).single(),
      supabase.from('offers').select('*').eq('product_id', id).eq('active',true).order('created_at',{ascending:false}),
      supabase.from('shipping_zones').select('*').eq('active',true).order('fee'),
      supabase.from('shipping_cities').select('*').eq('active',true).order('city_name')
    ]);
    p = r.data; s = st.data || s; offers = o.data || []; zones = z.data || []; cities = ci?.data || [];
  }
  const c = contentFrom(s);
  if(!p){
    app.innerHTML = `<main class="page-hero"><h1>${esc(c.product_not_found)}</h1><a class="text-link" href="collection.html">${esc(c.product_back)}</a></main>`;
    return;
  }
  const o = offers.find(activeOffer);
  const before = Number(p.price) || 0;
  const after = finalPrice(p,o);
  render(p,s,c,o,before,after,zones,cities);
}

function render(p,s,c,o,before,after,zones,cities){
  const imgs = [p.image_url, ...(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>x.url)].filter(Boolean);
  const primary = imgs[0] || 'elvira-logo-black.png';
  app.innerHTML = `
    <header class="nav">
      <a class="brand" href="./" aria-label="Elvira home"><img src="elvira-logo-black.png" alt="Elvira"></a>
      <nav><a href="./">${esc(c.nav_home)}</a><a href="collection.html" target="_blank" rel="noopener">${esc(c.nav_collection)}</a><a href="policy.html" target="_blank" rel="noopener">${esc(c.nav_policy)}</a></nav>
      <div class="nav-actions"><a class="ghost-btn" href="collection.html">${esc(c.product_back)}</a></div>
    </header>
    <main>
      <section class="product-page">
        <div class="product-gallery" data-gallery>
          <div class="gallery-stage">
            <button type="button" class="gallery-arrow gallery-prev" aria-label="Previous image">‹</button>
            <img id="galleryMain" src="${esc(safe(primary))}" alt="${esc(p.name)}">
            <button type="button" class="gallery-arrow gallery-next" aria-label="Next image">›</button>
          </div>
          ${imgs.length>1 ? `<div class="gallery-thumbs">${imgs.map((x,i)=>`<button type="button" class="gallery-thumb ${i===0?'active':''}" data-gallery-index="${i}"><img src="${esc(safe(x))}" alt="${esc(p.name)} ${i+1}"></button>`).join('')}</div>` : ''}
        </div>
        <div class="product-detail">
          <small>${esc(p.gender==='male'?'MALE FRAGRANCE':'FEMALE FRAGRANCE')}</small>
          <h1>${esc(p.name)}</h1>
          <div class="product-pricing">
            ${o ? `<div><span>${esc(c.checkout_before_price)}</span><del>${money(before)}</del></div><div><span>${esc(c.checkout_after_price)}</span><strong>${money(after)}</strong></div><em>${o.discount_type==='percent'?`-${Number(o.discount_value)}%`:`-${money(o.discount_value)}`}</em>` : `<strong>${money(before)}</strong>`}
          </div>
          <p>${esc(p.description||p.notes||'')}</p>
          <p class="notes">${esc(p.notes||'')}</p>
          <div class="product-page-stock">${p.stock>0?`${p.stock} ${esc(c.product_available_suffix)}`:esc(c.product_sold_out)}</div>
          ${p.stock>0 ? `<div class="product-purchase-actions"><button class="secondary" id="addToCartBtn">${esc(c.checkout_add_to_cart)}</button><button class="primary" id="buyNowBtn">${esc(c.checkout_buy_now)}</button></div>` : ''}
        </div>
      </section>
    </main>
    <footer><img src="elvira-logo-black.png" alt="Elvira"><span>© ${new Date().getFullYear()} ${esc(c.footer_copyright)}</span></footer>
    <div id="checkoutModal" class="checkout-modal" aria-hidden="true"></div>`;

  document.querySelector('#addToCartBtn')?.addEventListener('click', () => {
    const cart = getCart();
    if (!cart.some(item => item.id === p.id)) cart.push(p);
    setCart(cart);
    const btn = document.querySelector('#addToCartBtn');
    if(btn){ const old=btn.textContent; btn.textContent = 'Added'; setTimeout(()=>btn.textContent=old,1200); }
  });
  document.querySelector('#buyNowBtn')?.addEventListener('click', () => openCheckoutModal(p,s,c,o,before,after,zones,cities));

  // Product gallery: show one image at a time with arrows/thumbnails.
  if (imgs.length > 1) {
    let galleryIndex = 0;
    const mainImg = document.querySelector('#galleryMain');
    const thumbs = [...document.querySelectorAll('[data-gallery-index]')];
    const showGallery = (index) => {
      galleryIndex = (index + imgs.length) % imgs.length;
      if (mainImg) mainImg.src = safe(imgs[galleryIndex]);
      thumbs.forEach((t,i)=>t.classList.toggle('active', i===galleryIndex));
    };
    document.querySelector('.gallery-prev')?.addEventListener('click',()=>showGallery(galleryIndex-1));
    document.querySelector('.gallery-next')?.addEventListener('click',()=>showGallery(galleryIndex+1));
    thumbs.forEach(t=>t.addEventListener('click',()=>showGallery(Number(t.dataset.galleryIndex))));
  }

  if (new URLSearchParams(location.search).get('checkout') === '1') {
    setTimeout(() => openCheckoutModal(p,s,c,o,before,after,zones,cities), 120);
  }
}

function openCheckoutModal(p,s,c,o,before,after,zones,cities){
  const modal = document.querySelector('#checkoutModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  modal.innerHTML = `<div class="checkout-backdrop" data-close></div><div class="checkout-dialog" role="dialog" aria-modal="true" aria-label="${esc(c.checkout_popup_title)}">
    <div class="checkout-dialog-head"><div><small>${esc(c.checkout_popup_title)}</small><h2>${esc(p.name)}</h2></div><button type="button" class="checkout-close" data-close aria-label="${esc(c.checkout_close)}">×</button></div>
    <form id="orderForm" class="order-form">
      <div class="row"><label>${esc(c.checkout_name)}<input name="customer_name" required maxlength="160" autocomplete="name"></label><label>${esc(c.checkout_whatsapp)}<input name="whatsapp" required inputmode="tel" maxlength="30" autocomplete="tel"></label></div>
      <div class="row"><label>${esc(c.checkout_phone)}<input name="phone" required inputmode="tel" maxlength="30" autocomplete="tel"></label><label>${esc(c.checkout_city)}<select id="city" name="city" required><option value="" disabled selected>Choose your city</option>${cityGroups.map(g=>`<optgroup label="${esc(g.label)}">${g.cities.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</optgroup>`).join('')}</select><small id="shippingHint" class="shipping-hint"></small></label></div>
      <label>${esc(c.checkout_address)}<textarea name="address" required maxlength="500" autocomplete="street-address"></textarea></label>
      <div class="row"><label>${esc(c.checkout_quantity)}<input id="qty" name="quantity" type="number" min="1" max="${p.stock}" value="1" required></label><div class="checkout-city-summary"><span>Delivery fee</span><strong id="shippingPreview">Choose a city</strong></div></div>
      <div class="order-summary"><div><span>${esc(c.checkout_before_price)}</span><strong id="beforeTotal">${money(before)}</strong></div><div><span>${esc(c.checkout_after_price)}</span><strong id="subtotal">${money(after)}</strong></div><div><span>${esc(c.checkout_offer)}</span><strong id="discount">${o?`−${money(before-after)}`:money(0)}</strong></div><div><span>${esc(c.checkout_shipping)}</span><strong id="shipping">—</strong></div><div class="total"><span>${esc(c.checkout_total)}</span><strong id="total">—</strong></div></div>
      <button class="primary full" type="submit">${esc(c.checkout_place_order)}</button><p id="orderMessage" class="order-message"></p>
    </form>
  </div>`;

  modal.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click', closeCheckout));
  const form = modal.querySelector('#orderForm');
  const qty = modal.querySelector('#qty');
  const city = modal.querySelector('#city');
  const shippingHint = modal.querySelector('#shippingHint');
  const subtotal = modal.querySelector('#subtotal');
  const shipping = modal.querySelector('#shipping');
  const total = modal.querySelector('#total');
  const feeForCity = value => { const found=cities.find(x=>String(x.city_name).toLowerCase()===String(value).toLowerCase()); if(found) return Number(found.fee)||0; const fallback=fallbackCities.find(x=>x[0].toLowerCase()===String(value).toLowerCase()); return fallback?fallback[1]:0; };
  const shippingPreview = modal.querySelector('#shippingPreview');
  const sync = () => {
    const q = Math.max(1, Math.min(Number(qty.value)||1, p.stock)); qty.value = q;
    const hasCity = Boolean(city.value);
    const sh = hasCity ? feeForCity(city.value) : 0;
    shippingHint.textContent = hasCity ? `${city.value}: EGP ${sh} delivery` : 'Choose your city to calculate delivery';
    shippingPreview.textContent = hasCity ? money(sh) : 'Choose a city';
    subtotal.textContent = money(after*q); shipping.textContent = hasCity ? money(sh) : '—'; total.textContent = hasCity ? money(after*q+sh) : '—';
  };
  qty.addEventListener('input',sync); city.addEventListener('change',sync); sync();
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd = new FormData(form), q = Math.max(1, Math.min(Number(fd.get('quantity'))||1, p.stock)), msg=modal.querySelector('#orderMessage');
    msg.textContent='';
    if(!supabase){msg.textContent='Supabase is not connected.';return;}
    const clientRequestId = crypto.randomUUID();
    const {data,error} = await supabase.functions.invoke('create-order',{body:{product_id:p.id,quantity:q,customer_name:String(fd.get('customer_name')).trim(),whatsapp:String(fd.get('whatsapp')).trim(),phone:String(fd.get('phone')).trim(),address:String(fd.get('address')).trim(),city:String(fd.get('city')).trim(),client_request_id:clientRequestId}});
    if(error){msg.textContent=error.message;return;}
    const order=data?.[0]||data; const wa=String(s.support_whatsapp||'').replace(/\D/g,''); const ph=String(s.support_phone||'').replace(/[^+\d]/g,'');
    msg.innerHTML=`<strong>${esc(c.checkout_order_success)}</strong> ${esc(c.checkout_order_number)}: ${esc(order.order_number||'')}<div class="order-actions">${wa?`<a class="secondary" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent('Hello Elvira, my order is '+(order.order_number||''))}">${esc(c.checkout_whatsapp_action)}</a>`:''}${ph?`<a class="secondary" href="tel:${esc(ph)}">${esc(c.checkout_call_action)}</a>`:''}</div>`;
  });
}
function closeCheckout(){const modal=document.querySelector('#checkoutModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');modal.innerHTML='';}

load();
