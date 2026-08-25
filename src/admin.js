import { supabase } from './supabase.js';
import './style.css';
import { DEFAULT_CONTENT } from './site-content.js';
import * as XLSX from 'xlsx';
const root=document.querySelector('#admin');
let products=[],categories=[],settings={},newsletter=[],offers=[],orders=[],shippingZones=[],shippingCities=[];
let orderRange='all', orderSort='newest', orderSearch='';
let activeTab='dashboard';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl=u=>{try{const x=new URL(u||'',location.origin);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}};
const slugify=s=>String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||crypto.randomUUID().slice(0,8);
const imageOf=p=>p.image_url||p.product_images?.slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0]?.url||'elvira-logo-black.png';
const money=n=>Number(n||0).toLocaleString('en-US');
const offerPrice=(p,o)=>o?(o.discount_type==='percent'?Math.max(0,p.price*(1-o.discount_value/100)):Math.max(0,p.price-o.discount_value)):p.price;
const dt=v=>v?new Date(v).toISOString().slice(0,16):'';
const contentGroups={
 'Announcement & navigation':['announcement_text','nav_home','nav_collection','nav_categories','nav_policy','nav_search','nav_cart'],
 'Hero':['hero_eyebrow','hero_title','hero_description','hero_primary_button','hero_secondary_button','hero_image_alt'],
 'Quick look':['quick_label','quick_title','quick_text','quick_view_all'],
 'Categories':['categories_label','categories_title','categories_text','categories_empty','male_category_title','female_category_title'],
 'Offers':['offers_label','offers_title','offers_button'],
 'Collection & sorting':['collection_eyebrow','collection_title','collection_description','collection_all','collection_male','collection_female','sort_label','sort_featured','sort_low','sort_high','sort_name'],
 'Checkout & cart':['cart_title','cart_empty','cart_total','checkout_popup_title','checkout_add_to_cart','checkout_buy_now','checkout_close','checkout_title','checkout_name','checkout_whatsapp','checkout_phone','checkout_address','checkout_city','checkout_region','checkout_quantity','checkout_subtotal','checkout_offer','checkout_shipping','checkout_total','checkout_place_order','checkout_order_success','checkout_order_number','checkout_whatsapp_action','checkout_call_action','checkout_before_price','checkout_after_price'],
 'Shipping labels':['shipping_greater_cairo','shipping_nile_delta','shipping_upper_egypt','shipping_remote'],
 'Product messages':['product_card_fallback','products_empty','product_available_suffix','product_sold_out','search_title','search_placeholder','search_close_hint','product_not_found','product_back'],
 'Policy':['policy_eyebrow','policy_title','policy_intro','policy_delivery_title','policy_delivery_text','policy_returns_title','policy_returns_text','policy_care_title','policy_care_text','policy_privacy_title','policy_privacy_text'],
 'Footer':['footer_instagram','footer_facebook','footer_tiktok','footer_copyright','support_whatsapp','support_phone']
};
function contentField(key){const label=key.replaceAll('_',' ');const value=((settings.content)||{})[key]??DEFAULT_CONTENT[key]??'';const ta=['hero_description','quick_text','categories_text','policy_intro','policy_delivery_text','policy_returns_text','policy_care_text','policy_privacy_text'].includes(key);return `<label>${esc(label)}${ta?`<textarea name="content.${esc(key)}">${esc(value)}</textarea>`:`<input name="content.${esc(key)}" value="${esc(value)}">`}</label>`}
async function init(){
 if(!supabase)return loginError('Supabase is not configured. Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.');
 const {data:{session}}=await supabase.auth.getSession();if(!session)return login();
 const {data:profile,error}=await supabase.from('profiles').select('role').eq('id',session.user.id).maybeSingle();if(error)return loginError(error.message);if(profile?.role!=='admin')return denied(session.user.id);
 await load();render();
}
function login(){root.innerHTML=`<main class="login"><div class="login-card"><a class="admin-logo-link" href="./"><img src="elvira-logo-black.png" alt="Elvira"></a><p>PRIVATE ADMIN STUDIO</p><h1>Welcome back.</h1><form id="login"><input name="email" type="email" required placeholder="Email"><input name="password" type="password" required placeholder="Password"><button>Sign in</button></form><a href="./">← Back to store</a></div></main>`;document.querySelector('#login').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)alert(error.message);else init()}}
function denied(userId){root.innerHTML=`<main class="login"><div class="login-card"><a class="admin-logo-link" href="./"><img src="elvira-logo-black.png" alt="Elvira"></a><p class="admin-error">This account is signed in, but it is not an admin yet.</p><p>In Supabase SQL Editor, run:</p><pre style="white-space:pre-wrap;text-align:left;background:#faf7fd;padding:12px;border:1px solid #ded2e5">update public.profiles set role='admin' where id='${esc(userId)}';</pre><button id="logout">Sign out</button><a href="./">← Back to store</a></div></main>`;document.querySelector('#logout').onclick=()=>supabase.auth.signOut()}
function loginError(msg){root.innerHTML=`<main class="login"><div class="login-card"><a class="admin-logo-link" href="./"><img src="elvira-logo-black.png" alt="Elvira"></a><h1>Setup needed.</h1><p>${esc(msg)}</p><a href="./">← Back to store</a></div></main>`}
async function fetchAllOrders(){
 const all=[];
 let from=0;
 const pageSize=1000;
 while(true){
  const {data,error}=await supabase.from('orders').select('*,shipping_zones(name,fee),order_items(*)').order('created_at',{ascending:false}).range(from,from+pageSize-1);
  if(error) throw error;
  all.push(...(data||[]));
  if((data||[]).length<pageSize) break;
  from+=pageSize;
 }
 return all;
}
function orderDate(o){return o?.created_at?new Date(o.created_at):null}
function orderMatchesRange(o){
 const d=orderDate(o); if(!d||Number.isNaN(d.getTime())) return false;
 const now=new Date();
 if(orderRange==='all') return true;
 if(orderRange==='last7'){const start=new Date(now);start.setDate(now.getDate()-7);return d>=start;}
 if(orderRange==='week'){const start=new Date(now);const day=start.getDay();const diff=day===0?-6:1-day;start.setDate(start.getDate()+diff);start.setHours(0,0,0,0);return d>=start;}
 if(orderRange==='month'){const start=new Date(now.getFullYear(),now.getMonth(),1);return d>=start;}
 if(orderRange==='year'){const start=new Date(now.getFullYear(),0,1);return d>=start;}
 return true;
}
function getFilteredOrders(){
 const q=orderSearch.trim().toLowerCase();
 const filtered=orders.filter(o=>{
  if(!orderMatchesRange(o)) return false;
  if(!q) return true;
  const itemText=(o.order_items||[]).map(i=>[i.product_name,i.sku,i.offer_title].filter(Boolean).join(' ')).join(' ');
  const text=[o.order_number,o.customer_name,o.whatsapp,o.phone,o.address,o.city,o.shipping_zones?.name,o.status,itemText].join(' ').toLowerCase();
  return text.includes(q);
 });
 return filtered.sort((a,b)=>{
  if(orderSort==='oldest') return new Date(a.created_at)-new Date(b.created_at);
  if(orderSort==='total-high') return Number(b.total||0)-Number(a.total||0);
  if(orderSort==='total-low') return Number(a.total||0)-Number(b.total||0);
  return new Date(b.created_at)-new Date(a.created_at);
 });
}
function orderItemsSummary(o){return (o.order_items||[]).map(i=>`${i.product_name} × ${i.quantity}`).join(' | ')}
function filteredOrdersForExport(){return getFilteredOrders()}
function formatDateTime(v){return v?new Date(v).toLocaleString('en-US'):''}
function periodLabel(){return ({all:'All time',last7:'Last 7 days',week:'This week',month:'This month',year:'This year'})[orderRange]||'All time'}
function exportOrdersExcel(){
 const rows=filteredOrdersForExport();
 if(!rows.length){alert('No orders match the selected filters.');return;}
 const wb=XLSX.utils.book_new();
 const orderRows=rows.map(o=>({
  Order_Number:o.order_number,Date:formatDateTime(o.created_at),Customer:o.customer_name,WhatsApp:o.whatsapp,Phone:o.phone,City:o.city,City_Name:o.city,Address:o.address,
  Shipping_City:o.city||'',Shipping_Region:o.shipping_zones?.name||'',Shipping_Fee_EGP:Number(o.shipping_fee||0),Subtotal_EGP:Number(o.subtotal||0),Discount_EGP:Number(o.discount||0),Total_EGP:Number(o.total||0),Status:o.status,
  Items:orderItemsSummary(o),Item_Count:(o.order_items||[]).reduce((n,i)=>n+Number(i.quantity||0),0),Notes:o.notes||''
 }));
 const itemRows=[];
 rows.forEach(o=>(o.order_items||[]).forEach(i=>itemRows.push({
  Order_Number:o.order_number,Order_Date:formatDateTime(o.created_at),Customer:o.customer_name,WhatsApp:o.whatsapp,Phone:o.phone,City:o.city,Shipping_City:o.city,Address:o.address,Shipping_Region:o.shipping_zones?.name||'',
  Product_ID:i.product_id||'',Product_Name:i.product_name,Quantity:Number(i.quantity||0),Original_Unit_Price_EGP:Number(i.original_unit_price||0),Unit_Price_EGP:Number(i.unit_price||0),Discount_EGP:Number(i.discount_amount||0),Offer:i.offer_title||'',Line_Total_EGP:Number(i.line_total||0),Order_Status:o.status
 })));
 const summary=[
  {Metric:'Export period',Value:periodLabel()},
  {Metric:'Orders exported',Value:rows.length},
  {Metric:'Units sold',Value:orderRows.reduce((a,r)=>a+Number(r.Item_Count||0),0)},
  {Metric:'Subtotal EGP',Value:orderRows.reduce((a,r)=>a+Number(r.Subtotal_EGP||0),0)},
  {Metric:'Discounts EGP',Value:orderRows.reduce((a,r)=>a+Number(r.Discount_EGP||0),0)},
  {Metric:'Shipping EGP',Value:orderRows.reduce((a,r)=>a+Number(r.Shipping_Fee_EGP||0),0)},
  {Metric:'Total EGP',Value:orderRows.reduce((a,r)=>a+Number(r.Total_EGP||0),0)},
 ];
 const ws1=XLSX.utils.json_to_sheet(orderRows);
 const ws2=XLSX.utils.json_to_sheet(itemRows);
 const ws3=XLSX.utils.json_to_sheet(summary);
 const styleSheet=(ws, widths)=>{ws['!cols']=widths.map(w=>({wch:w}));const ref=ws['!ref'];if(ref)ws['!autofilter']={ref};};
 styleSheet(ws1,[18,20,22,18,18,18,36,20,16,16,16,16,14,50,12,30]);
 styleSheet(ws2,[18,20,22,18,18,18,36,20,38,26,10,20,18,16,28,18,14]);
 styleSheet(ws3,[24,28]);
 ['C','D','E','F','G','H','O'].forEach(col=>{});
 XLSX.utils.book_append_sheet(wb,ws1,'Orders');
 XLSX.utils.book_append_sheet(wb,ws2,'Order Items');
 XLSX.utils.book_append_sheet(wb,ws3,'Summary');
 const stamp=new Date().toISOString().slice(0,10);
 XLSX.writeFile(wb,`elvira-orders-${orderRange}-${stamp}.xlsx`);
}
async function load(){
 const [p,c,s,n,o,ord,z,sc]=await Promise.all([
  supabase.from('products').select('*,categories(name,slug,gender),product_images(*)').order('created_at',{ascending:false}),
  supabase.from('categories').select('*').order('gender').order('name'),
  supabase.from('site_settings').select('*').eq('id',1).single(),
  supabase.from('newsletter_subscribers').select('*').order('created_at',{ascending:false}).limit(200),
  supabase.from('offers').select('*,products(name,price,image_url)').order('created_at',{ascending:false}),
  fetchAllOrders(),
  supabase.from('shipping_zones').select('*').order('fee'),
  supabase.from('shipping_cities').select('*').eq('active',true).order('city_name')
 ]);
 products=p.data||[];categories=c.data||[];settings=s.data||{};newsletter=n.data||[];offers=o.data||[];orders=ord||[];shippingZones=z.data||[];shippingCities=sc?.data||[];
}
function render(){
 const active=offers.filter(o=>o.active).length,inventory=products.reduce((a,p)=>a+Number(p.stock||0),0),low=products.filter(p=>Number(p.stock)<5).length;
 root.innerHTML=`<div class="admin-shell"><aside class="sidebar"><a class="admin-logo-link" href="./"><img src="elvira-logo-black.png" alt="Elvira"></a><span>ADMIN STUDIO</span><button class="admin-tab-link" data-tab="dashboard">Dashboard</button><button class="admin-tab-link" data-tab="products">Products</button><button class="admin-tab-link" data-tab="categories">Categories</button><button class="admin-tab-link" data-tab="offers">Offers</button><button class="admin-tab-link" data-tab="orders">Orders</button><button class="admin-tab-link" data-tab="shipping">Shipping</button><button class="admin-tab-link" data-tab="insights">Insights</button><button class="admin-tab-link" data-tab="site">Site editor</button><button class="admin-tab-link" data-tab="newsletter">Newsletter</button><a href="./">View store</a><button id="logout">Logout</button></aside><main class="admin-main">
 <div id="dashboard" class="admin-top admin-view"><div><small>ELVIRA / ADMIN</small><h1>Control everything.</h1></div><button class="primary" id="newProduct">+ New product</button></div>
 <section class="stats"><div><span>Products</span><strong>${products.length}</strong></div><div><span>Categories</span><strong>${categories.length}</strong></div><div><span>Inventory units</span><strong>${inventory}</strong></div><div><span>Active offers</span><strong>${active}</strong></div></section>
 <section id="products" class="panel admin-view"><div class="panel-head"><div><small>CATALOG</small><h2>Products</h2></div><input id="productSearch" placeholder="Search name, SKU, category, gender..."></div><div class="table"><div class="tr product-head"><strong>Product</strong><strong>Gender / Category</strong><strong>Price</strong><strong>Stock</strong><strong>Actions</strong></div>${products.map(p=>{const o=offers.find(x=>x.product_id===p.id&&x.active),g=p.gender==='male'?'Male':'Female';return `<div class="tr product-row"><div class="prod-cell"><img src="${esc(safeUrl(imageOf(p)))}"><div><strong>${esc(p.name)}</strong><span>${esc(p.sku||'No SKU')}</span></div></div><span>${g} · ${esc(p.categories?.name||'Uncategorized')}</span><div>${o?`<del>EGP ${money(p.price)}</del><strong class="offer-price">EGP ${money(offerPrice(p,o))}</strong>`:`<strong>EGP ${money(p.price)}</strong>`}</div><span class="${Number(p.stock)<5?'low':''}">${p.stock}</span><div><button data-edit="${p.id}">Edit</button><button class="danger" data-delete="${p.id}">Delete</button></div></div>`}).join('')||'<p class="empty">No products yet.</p>'}</div></section>
 <section id="categories" class="panel admin-view"><small>ORGANIZE</small><h2>Categories</h2><p class="muted">Every category is either Male or Female and appears on the storefront automatically.</p><form id="catForm" class="inline-form"><input name="name" required placeholder="Category name"><select name="gender"><option value="female">Female</option><option value="male">Male</option></select><button>Add category</button></form><div class="chips">${categories.map(c=>`<span>${esc(c.name)} · ${c.gender==='male'?'Male':'Female'} <button data-catedit="${c.id}">✎</button><button data-catdel="${c.id}">×</button></span>`).join('')}</div></section>
 <section id="offers" class="panel admin-view"><div class="panel-head"><div><small>SALES</small><h2>Offers</h2></div><button class="primary" id="newOffer">+ New offer</button></div><p class="muted">Create an offer here and it appears automatically on the product with the original price and the discounted price.</p><div class="offer-admin-list">${offers.map(o=>`<div class="offer-admin-row"><div><strong>${esc(o.title)}</strong><span>${esc(o.products?.name||'Deleted product')}</span></div><div><strong>${o.discount_type==='percent'?`-${o.discount_value}%`:`-EGP ${money(o.discount_value)}`}</strong><span>${o.active?'Active':'Inactive'}</span></div><div><button data-offer-edit="${o.id}">Edit</button><button class="danger" data-offer-delete="${o.id}">Delete</button></div></div>`).join('')||'<p class="empty">No offers yet.</p>'}</div></section>
 <section id="orders" class="panel admin-view"><div class="panel-head"><div><small>SALES</small><h2>Orders</h2></div><div class="orders-toolbar"><input id="orderSearch" placeholder="Search order, customer, phone, WhatsApp, perfume..."><select id="orderRange"><option value="all">All time</option><option value="last7">Last 7 days</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option></select><select id="orderSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="total-high">Total: high to low</option><option value="total-low">Total: low to high</option></select><button class="primary" id="exportOrders">↓ Excel</button></div></div><p class="muted">${getFilteredOrders().length} matching orders · Export includes customer details, every item purchased, offers, shipping, totals and status.</p>${getFilteredOrders().map(o=>`<div class="order-admin-row"><div><strong>${esc(o.order_number)}</strong><span>${esc(o.customer_name)} · ${esc(o.phone)} · WhatsApp ${esc(o.whatsapp)}</span><span>${esc(o.city)} · ${esc(o.address)}</span><span>${formatDateTime(o.created_at)} · ${esc(orderItemsSummary(o))}</span></div><div><strong>EGP ${money(o.total)}</strong><span>Subtotal EGP ${money(o.subtotal)} · Discount EGP ${money(o.discount)}</span><span>Shipping EGP ${money(o.shipping_fee)} · ${esc(o.shipping_zones?.name||'')}</span></div><div><select data-order-status="${o.id}">${['pending','confirmed','shipped','delivered','cancelled'].map(st=>`<option value="${st}" ${o.status===st?'selected':''}>${st}</option>`).join('')}</select></div></div>`).join('')||'<p class="empty">No orders match the selected filters.</p>'}</section> <section id="shipping" class="panel admin-view"><div class="panel-head"><div><small>DELIVERY</small><h2>Shipping fees</h2></div><span>Edit the fee for every city independently.</span></div><div class="shipping-admin">${shippingCities.map(c=>`<div><strong>${esc(c.city_name)}</strong><label>EGP <input type="number" min="0" step="1" data-city-fee="${c.id}" value="${esc(c.fee)}"></label><button data-city-save="${c.id}">Save</button></div>`).join('')||'<p class="empty">No cities configured yet.</p>'}</div></section>
 <section id="insights" class="panel admin-view"><small>INSIGHTS</small><h2>Store insights</h2><div class="insight-grid"><div><span>Catalog value</span><strong>EGP ${money(products.reduce((a,p)=>a+Number(p.price||0)*Number(p.stock||0),0))}</strong><small>Current price × stock</small></div><div><span>Low-stock products</span><strong>${low}</strong><small>Below 5 units</small></div><div><span>Out of stock</span><strong>${products.filter(p=>Number(p.stock)===0).length}</strong><small>Needs restock</small></div><div><span>Newsletter</span><strong>${newsletter.length}</strong><small>Subscribers</small></div><div><span>Orders</span><strong>${orders.length}</strong><small>Stored in Supabase</small></div></div><h3>Low stock watch</h3><div class="insight-list">${products.filter(p=>Number(p.stock)<5).map(p=>`<div><span>${esc(p.name)} · ${p.gender==='male'?'Male':'Female'}</span><strong>${p.stock} units</strong></div>`).join('')||'<p class="empty">Everything has healthy stock.</p>'}</div></section>
 <section id="site" class="panel admin-view"><small>BRAND & COPY</small><h2>Site editor</h2><p class="muted">Every customer-facing label and message used by the current storefront is editable here. The Journal has been removed.</p><form id="siteForm" class="site-grid"><div class="full"><label>Logo image URL<input name="logo_url" value="${esc(settings.logo_url||'elvira-logo-black.png')}"></label><label>Upload logo<input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp"></label></div>${Object.entries(contentGroups).map(([group,keys])=>`<div class="content-editor full"><h3>${esc(group)}</h3>${keys.map(contentField).join('')}</div>`).join('')}<div class="full"><div class="row"><label>Instagram URL<input name="instagram_url" value="${esc(settings.instagram_url||'')}"></label><label>Facebook URL<input name="facebook_url" value="${esc(settings.facebook_url||'')}"></label></div><label>TikTok URL<input name="tiktok_url" value="${esc(settings.tiktok_url||'')}"></label></div><div class="full"><button>Save all site text</button></div></form></section>
 <section id="newsletter" class="panel admin-view"><div class="panel-head"><div><small>COMMUNITY</small><h2>Newsletter subscribers</h2></div><span>${newsletter.length} subscribers</span></div>${newsletter.map(n=>`<div class="newsletter-item"><span>${esc(n.email)}</span><span>${new Date(n.created_at).toLocaleDateString()}</span></div>`).join('')||'<p class="empty">No subscribers yet.</p>'}</section>
 </main></div><div id="modal"></div>`;bindAdmin();
}
function bindAdmin(){
 const setTab=(tab)=>{activeTab=tab;document.querySelectorAll('.admin-view').forEach(el=>el.classList.toggle('is-active',el.id===tab));document.querySelectorAll('.admin-tab-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));history.replaceState(null,'',`#${tab}`)};
 const requested=(location.hash||'#dashboard').slice(1);setTab(['dashboard','products','categories','offers','orders','shipping','insights','site','newsletter'].includes(requested)?requested:'dashboard');
 document.querySelectorAll('.admin-tab-link').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
 document.querySelector('#logout').onclick=()=>supabase.auth.signOut();document.querySelector('#newProduct').onclick=()=>openProduct();document.querySelector('#newOffer').onclick=()=>openOffer();
 const orderSearchEl=document.querySelector('#orderSearch'); if(orderSearchEl){orderSearchEl.value=orderSearch;orderSearchEl.oninput=e=>{orderSearch=e.target.value;render()};}
 const orderRangeEl=document.querySelector('#orderRange'); if(orderRangeEl){orderRangeEl.value=orderRange;orderRangeEl.onchange=e=>{orderRange=e.target.value;render()};}
 const orderSortEl=document.querySelector('#orderSort'); if(orderSortEl){orderSortEl.value=orderSort;orderSortEl.onchange=e=>{orderSort=e.target.value;render()};}
 const exportBtn=document.querySelector('#exportOrders'); if(exportBtn)exportBtn.onclick=exportOrdersExcel;
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openProduct(products.find(p=>p.id===b.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete));document.querySelectorAll('[data-catdel]').forEach(b=>b.onclick=()=>deleteCategory(b.dataset.catdel));document.querySelectorAll('[data-catedit]').forEach(b=>b.onclick=()=>editCategory(b.dataset.catedit));document.querySelectorAll('[data-offer-edit]').forEach(b=>b.onclick=()=>openOffer(offers.find(o=>o.id===b.dataset.offerEdit)));document.querySelectorAll('[data-offer-delete]').forEach(b=>b.onclick=()=>deleteOffer(b.dataset.offerDelete));
 document.querySelector('#catForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')).trim(),gender=f.get('gender');const {error}=await supabase.from('categories').insert({name,slug:slugify(name),gender});if(error)alert(error.message);else{toastDone();await load();render()}};
 document.querySelector('#siteForm').onsubmit=saveSite;
 document.querySelector('#productSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.product-row').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'grid':'none')};
 document.querySelectorAll('[data-order-status]').forEach(sel=>sel.onchange=async()=>{const {error}=await supabase.from('orders').update({status:sel.value}).eq('id',sel.dataset.orderStatus);if(error)alert(error.message)});
 document.querySelectorAll('[data-city-save]').forEach(b=>b.onclick=async()=>{const input=document.querySelector(`[data-city-fee="${b.dataset.citySave}"]`),fee=Number(input.value);const {error}=await supabase.from('shipping_cities').update({fee}).eq('id',b.dataset.citySave);if(error)alert(error.message);else{toastDone();await load();render()}})
}
async function normalizeImage(file){if(!file)return null;if(file.size>8*1024*1024)throw new Error('Image must be under 8 MB');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Only PNG, JPG and WebP images are allowed');const blobUrl=URL.createObjectURL(file);try{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=blobUrl});const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1080,1080);const scale=Math.min(1080/img.naturalWidth,1080/img.naturalHeight);const w=Math.round(img.naturalWidth*scale),h=Math.round(img.naturalHeight*scale);ctx.drawImage(img,(1080-w)/2,(1080-h)/2,w,h);return await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9))}finally{URL.revokeObjectURL(blobUrl)}}
async function uploadFile(file,folder){if(!file)return null;const normalized=await normalizeImage(file);const path=`${folder}/${crypto.randomUUID()}.webp`;const up=await supabase.storage.from('elvira-media').upload(path,normalized,{upsert:false,contentType:'image/webp'});if(up.error)throw up.error;return supabase.storage.from('elvira-media').getPublicUrl(path).data.publicUrl}
async function saveSite(e){e.preventDefault();try{const form=e.target,fd=new FormData(form),data={},content={...DEFAULT_CONTENT,...(settings.content||{})};for(const [key,value] of fd.entries()){if(key.startsWith('content.'))content[key.slice(8)]=String(value);else if(key!=='logoFile')data[key]=value}const logo=await uploadFile(document.querySelector('#logoFile').files[0],'site');if(logo)data.logo_url=logo;data.id=1;data.content=content;const {error}=await supabase.from('site_settings').upsert(data);if(error)throw error;alert('Site text and settings saved.');await load();render()}catch(err){alert(err.message)}}
function openProduct(p={}){const m=document.querySelector('#modal'),imgs=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));m.innerHTML=`<div class="modal-bg"><form class="modal" id="productForm"><div class="modal-head"><div><small>CATALOG</small><h2>${p.id?'Edit product':'New product'}</h2></div><button type="button" id="close">×</button></div><label>Product name<input name="name" required value="${esc(p.name)}"></label><div class="row"><label>SKU<input name="sku" value="${esc(p.sku)}"></label><label>Badge<input name="badge" value="${esc(p.badge)}"></label></div><div class="row"><label>Gender<select name="gender"><option value="female" ${p.gender!=='male'?'selected':''}>Female fragrance</option><option value="male" ${p.gender==='male'?'selected':''}>Male fragrance</option></select></label><label>Category<select name="category_id"><option value="">No category</option>${categories.map(c=>`<option value="${c.id}" ${p.category_id===c.id?'selected':''}>${esc(c.name)} · ${c.gender==='male'?'Male':'Female'}</option>`).join('')}</select></label></div><label>Description<textarea name="description">${esc(p.description)}</textarea></label><div class="row"><label>Collection<input name="collection" value="${esc(p.collection)}"></label><label>Fragrance notes<input name="notes" value="${esc(p.notes)}"></label></div><div class="row"><label>Price (EGP)<input name="price" type="number" min="0" step="0.01" required value="${esc(p.price??0)}"></label><label>Stock<input name="stock" type="number" min="0" required value="${esc(p.stock??0)}"></label></div><label>Main image URL<input name="image_url" value="${esc(p.image_url)}"></label><label>Upload main photo<input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Upload additional photos<input id="galleryFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><p class="muted">Uploaded product images are normalized to 1080 × 1080.</p><div class="preview">${imgs.map(i=>`<div class="gallery-thumb"><img src="${esc(safeUrl(i.url))}"><button type="button" data-img-delete="${i.id}">×</button></div>`).join('')||'<span>No gallery photos yet.</span>'}</div><button type="submit">Save product</button></form></div>`;document.querySelector('#close').onclick=()=>m.innerHTML='';document.querySelector('#productForm').onsubmit=e=>saveProduct(e,p);document.querySelectorAll('[data-img-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this photo?'))return;const {error}=await supabase.from('product_images').delete().eq('id',b.dataset.imgDelete);if(error)alert(error.message);else openProduct((await supabase.from('products').select('*,categories(name,slug,gender),product_images(*)').eq('id',p.id).single()).data)})}
async function getUniqueProductSlug(base,excludeId=''){let candidate=slugify(base);const {data:matches,error}=await supabase.from('products').select('id,slug').ilike('slug',candidate);if(error)throw error;if(matches?.some(x=>x.id!==excludeId&&x.slug===candidate)){candidate=`${candidate}-${crypto.randomUUID().slice(0,8)}`;let i=1;while(true){const {data:again,error:againError}=await supabase.from('products').select('id').eq('slug',candidate).maybeSingle();if(againError)throw againError;if(!again)break;candidate=`${slugify(base)}-${crypto.randomUUID().slice(0,8)}-${i++}`}}return candidate}

async function saveProduct(e,p){e.preventDefault();const form=e.target;const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;try{const data=Object.fromEntries(new FormData(form));const payload={name:String(data.name).trim(),description:data.description||'',collection:data.collection||'',notes:data.notes||'',sku:data.sku||null,price:Number(data.price),stock:Number(data.stock),badge:data.badge||null,image_url:data.image_url||null,category_id:data.category_id||null,gender:data.gender||'female'};payload.slug=await getUniqueProductSlug(data.name+'-'+(data.sku||'product'),p.id||'');const mainFile=document.querySelector('#imageFile')?.files?.[0];if(mainFile)payload.image_url=await uploadFile(mainFile,'products');let result=p.id?await supabase.from('products').update(payload).eq('id',p.id).select().single():await supabase.from('products').insert(payload).select().single();if(result.error)throw result.error;const productId=result.data.id;const galleryInput=document.querySelector('#galleryFiles');const galleryFiles=galleryInput?[...galleryInput.files]:[];const existingCount=(p.product_images||[]).length;for(let i=0;i<galleryFiles.length;i++){const file=galleryFiles[i];const url=await uploadFile(file,'products');const {error}=await supabase.from('product_images').insert({product_id:productId,url,sort_order:existingCount+i});if(error)throw error}mClose();await load();render()}catch(err){alert(err.message)}finally{if(submit)submit.disabled=false}}
function openOffer(o={}){const m=document.querySelector('#modal');m.innerHTML=`<div class="modal-bg"><form class="modal" id="offerForm"><div class="modal-head"><div><small>SALES</small><h2>${o.id?'Edit offer':'New offer'}</h2></div><button type="button" id="close">×</button></div><label>Offer title<input name="title" required value="${esc(o.title||'Special offer')}"></label><label>Product<select name="product_id" required><option value="">Choose product</option>${products.map(p=>`<option value="${p.id}" ${o.product_id===p.id?'selected':''}>${esc(p.name)} — EGP ${money(p.price)}</option>`).join('')}</select></label><div class="row"><label>Discount type<select name="discount_type"><option value="percent" ${o.discount_type==='percent'?'selected':''}>Percentage %</option><option value="fixed" ${o.discount_type==='fixed'?'selected':''}>Fixed EGP</option></select></label><label>Discount value<input name="discount_value" type="number" min="0" step="0.01" required value="${esc(o.discount_value??10)}"></label></div><div class="row"><label>Starts<input name="starts_at" type="datetime-local" value="${dt(o.starts_at)}"></label><label>Ends<input name="ends_at" type="datetime-local" value="${dt(o.ends_at)}"></label></div><label class="check"><input name="active" type="checkbox" ${o.active!==false?'checked':''}> Active offer</label><button type="submit">Save offer</button></form></div>`;document.querySelector('#close').onclick=()=>m.innerHTML='';document.querySelector('#offerForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),payload={title:d.title.trim(),product_id:d.product_id,discount_type:d.discount_type,discount_value:Number(d.discount_value),starts_at:d.starts_at?new Date(d.starts_at).toISOString():null,ends_at:d.ends_at?new Date(d.ends_at).toISOString():null,active:e.target.active.checked};const r=o.id?await supabase.from('offers').update(payload).eq('id',o.id):await supabase.from('offers').insert(payload);if(r.error)alert(r.error.message);else{toastDone();mClose();await load();render()}}}
function toastDone(){let el=document.querySelector('#doneToast');if(!el){el=document.createElement('div');el.id='doneToast';el.className='done-toast';document.body.appendChild(el)}el.textContent='✓ Done';el.classList.add('show');clearTimeout(window.__doneT);window.__doneT=setTimeout(()=>el.classList.remove('show'),1600)}
function mClose(){document.querySelector('#modal').innerHTML=''}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;const {error}=await supabase.from('products').delete().eq('id',id);if(error)alert(error.message);else{toastDone();await load();render()}}
async function editCategory(id){const c=categories.find(x=>x.id===id);if(!c)return;const name=prompt('Category name',c.name||'');if(!name||name.trim()===c.name)return;const {error}=await supabase.from('categories').update({name:name.trim(),slug:slugify(name)}).eq('id',id);if(error)alert(error.message);else{toastDone();await load();render()}}
async function deleteCategory(id){if(!confirm('Delete this category? Products become uncategorized.'))return;const {error}=await supabase.from('categories').delete().eq('id',id);if(error)alert(error.message);else{toastDone();await load();render()}}
async function deleteOffer(id){if(!confirm('Delete this offer?'))return;const {error}=await supabase.from('offers').delete().eq('id',id);if(error)alert(error.message);else{toastDone();await load();render()}}
init();
