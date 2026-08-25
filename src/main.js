import { supabase } from './supabase.js';
import './style.css';
import {cachedRead} from './public-cache.js';
import { contentFrom } from './site-content.js';

const app=document.querySelector('#app');
const fallback={logo_url:'elvira-logo-black.png',instagram_url:'#',facebook_url:'#',tiktok_url:'#'};
const state={products:[],categories:[],offers:[],settings:{},cart:JSON.parse(localStorage.getItem('elvira-cart')||'[]'),favorites:JSON.parse(localStorage.getItem('elvira-favorites')||'[]')};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'EGP',maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl=url=>{try{const u=new URL(url||'',location.origin);return ['http:','https:','blob:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const activeOffers=()=>state.offers.filter(o=>o.active&&(!o.starts_at||new Date(o.starts_at)<=new Date())&&(!o.ends_at||new Date(o.ends_at)>=new Date()));
const productImage=p=>p.image_url||p.product_images?.slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0]?.url||fallback.logo_url;
const offerFor=p=>activeOffers().find(o=>o.product_id===p.id);
const finalPrice=p=>{const o=offerFor(p);if(!o)return Number(p.price);return o.discount_type==='percent'?Math.max(0,Number(p.price)*(1-Number(o.discount_value)/100)):Math.max(0,Number(p.price)-Number(o.discount_value));};

async function load(){
 if(!supabase){state.settings=fallback;render();return;}
 const [p,c,s,o]=await Promise.all([
  supabase.from('products').select('*,categories(name,slug,gender),product_images(*)').order('created_at',{ascending:false}),
  supabase.from('categories').select('*').order('gender').order('name'),
  supabase.from('site_settings').select('*').eq('id',1).single(),
  supabase.from('offers').select('*').eq('active',true).order('created_at',{ascending:false})
 ]);
 state.products=p.data||[];state.categories=c.data||[];state.settings=s.data||fallback;state.offers=o.data||[];render();
}
function nav(){const c=contentFrom(state.settings);return `<div class="announcement-bar">${esc(c.announcement_text)}</div><header class="nav"><a class="brand" href="./" aria-label="Elvira home"><img src="elvira-logo-black.png" alt="Elvira"></a><nav><a href="./">${esc(c.nav_home)}</a><a id="collectionTrigger" href="collection.html" target="_blank" rel="noopener">${esc(c.nav_collection)}</a><a href="#categories">${esc(c.nav_categories)}</a><a href="policy.html" target="_blank" rel="noopener">${esc(c.nav_policy)}</a></nav><div class="nav-actions"><button class="ghost-btn icon-btn" id="searchBtn" aria-label="${esc(c.nav_search)}" title="${esc(c.nav_search)}">⌕</button><button class="ghost-btn" id="cartBtn">${esc(c.nav_cart)} <span>(${state.cart.length})</span></button></div></header>`}
function card(p){const c=contentFrom(state.settings),liked=state.favorites.includes(p.id),o=offerFor(p),price=finalPrice(p);return `<article class="product"><a class="product-img square-product" href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener"><img src="${esc(safeUrl(productImage(p)))}" alt="${esc(p.name)}" loading="lazy">${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}${o?`<span class="offer-badge">${o.discount_type==='percent'?`-${Number(o.discount_value)}% OFF`:'SPECIAL OFFER'}</span>`:''}</a><div class="product-meta"><span class="eyebrow">${esc(p.gender==='male'?'MALE FRAGRANCE':'FEMALE FRAGRANCE')}</span><h3>${esc(p.name)}</h3><p>${esc(p.notes||p.description)}</p><div class="price-row"><strong>${money(price)}</strong>${o?`<del>${money(p.price)}</del>`:''}<span>${p.stock>0?`${p.stock} ${esc(c.product_available_suffix)}`:esc(c.product_sold_out)}</span></div><div class="product-actions"><button class="heart ${liked?'liked':''}" data-heart="${p.id}">${liked?'♥':'♡'}</button><button class="add" data-add="${p.id}" ${p.stock<=0?'disabled':''}>${p.stock>0?'ADD TO CART':'SOLD OUT'}</button></div></div></article>`}
function genderCategories(gender){return state.categories.filter(c=>c.gender===gender);}
function genderSection(gender,title){const c=contentFrom(state.settings),url=`/collection.html?gender=${gender}`;return `<section class="gender-section reveal"><div class="section-head compact-head"><div><small>${gender==='male'?esc(c.collection_male):esc(c.collection_female)}</small><h2>${esc(title)}</h2></div><a class="text-link" href="${url}" target="_blank" rel="noopener">${esc(c.category_view_all)}</a></div><div class="gender-card-row"><a class="gender-card-link" href="${url}" target="_blank" rel="noopener">${gender==='male'?'MALE FRAGRANCE':'FEMALE FRAGRANCE'} <span>↗</span></a></div></section>`}
function render(){
 const s={...fallback,...(state.settings||{})},c=contentFrom(s),offers=activeOffers(),quick=state.products.slice(0,4);
 app.innerHTML=`<div id="top">${nav()}<main>
 <section class="hero hero-quick"><div class="hero-grid"></div><div class="hero-perfume-wrap"><img class="hero-perfume" src="hawas-ice.png" alt="${esc(c.hero_image_alt)}"></div><div class="hero-copy reveal"><small>${esc(c.hero_eyebrow)}</small><h1>${esc(c.hero_title)}</h1><p>${esc(c.hero_description)}</p><div class="hero-actions"><a class="primary" href="collection.html" target="_blank" rel="noopener">${esc(c.hero_primary_button)}</a><a class="secondary" href="collection.html" target="_blank" rel="noopener">${esc(c.hero_secondary_button)}</a></div></div></section>
 <section class="quick-perfumes reveal"><div class="section-head compact-head"><div><small>${esc(c.quick_label)}</small><h2>${esc(c.quick_title)}</h2><p class="section-note">${esc(c.quick_text)}</p></div><a class="text-link" href="collection.html" target="_blank" rel="noopener">${esc(c.quick_view_all)}</a></div><div class="grid quick-grid">${quick.map(card).join('')||`<div class="empty">${esc(c.product_card_fallback)}</div>`}</div></section>
 <section class="quick-categories reveal" id="categories"><div class="section-head compact-head"><div><small>${esc(c.categories_label)}</small><h2>${esc(c.categories_title)}</h2><p class="section-note">${esc(c.categories_text)}</p></div><a class="text-link" href="collection.html" target="_blank" rel="noopener">${esc(c.quick_view_all)}</a></div>${genderSection('female',c.female_category_title)}${genderSection('male',c.male_category_title)}</section>
 ${offers.length?`<section class="quick-offer reveal"><small>${esc(c.offers_label)}</small><h2>${esc(c.offers_title)}</h2><a class="text-link" href="collection.html?offers=1" target="_blank" rel="noopener">${esc(c.offers_button)}</a></section>`:''}
 </main><footer class="minimal-footer"><img src="elvira-logo-black.png" alt="Elvira"><div><a href="${esc(safeUrl(s.instagram_url))}" target="_blank" rel="noreferrer noopener">${esc(c.footer_instagram)}</a><a href="${esc(safeUrl(s.facebook_url))}" target="_blank" rel="noreferrer noopener">${esc(c.footer_facebook)}</a><a href="${esc(safeUrl(s.tiktok_url))}" target="_blank" rel="noreferrer noopener">${esc(c.footer_tiktok)}</a></div><span>© ${new Date().getFullYear()} ${esc(c.footer_copyright)}</span></footer></div>
 <aside id="drawer" class="drawer"><div class="drawer-head"><h2>${esc(c.cart_title)}</h2><button id="closeDrawer">×</button></div><div id="cartItems"></div></aside>
 <div id="search" class="search-overlay"><button id="closeSearch">×</button><div class="search-box"><small>${esc(c.search_title)}</small><input id="searchInput" autocomplete="off" placeholder="${esc(c.search_placeholder)}"><div id="searchResults" class="search-results"></div><p>${esc(c.search_close_hint)}</p></div></div>`;
 bind();cartRender();animate();
}
function searchProducts(query){
 const q=String(query||'').trim().toLowerCase();
 if(!q) return [];
 return state.products.filter(p=>[p.name,p.collection,p.notes,p.description,p.sku,p.gender,p.categories?.name].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0,8);
}
function renderSearchResults(query){
 const box=document.querySelector('#searchResults'); if(!box) return;
 const results=searchProducts(query);
 if(!String(query||'').trim()){box.innerHTML='';return;}
 box.innerHTML=results.map(p=>`<a class="search-result" href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener"><img src="${esc(safeUrl(productImage(p)))}" alt="${esc(p.name)}"><span><strong>${esc(p.name)}</strong><small>${esc(p.collection||p.categories?.name||'')}</small></span><b>${money(finalPrice(p))}</b></a>`).join('') || `<div class="search-empty">${esc(contentFrom(state.settings).products_empty)}</div>`;
}
function openSearch(){document.querySelector('#search')?.classList.add('open');document.querySelector('#searchInput')?.focus()}
function animate(){document.querySelectorAll('.reveal').forEach((el,i)=>el.style.setProperty('--delay',`${Math.min(i*70,420)}ms`));const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));document.querySelectorAll('.product-img').forEach(el=>{el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.setProperty('--mx',`${x*10}px`);el.style.setProperty('--my',`${y*10}px`)});el.addEventListener('pointerleave',()=>{el.style.setProperty('--mx','0px');el.style.setProperty('--my','0px')})})}
function bind(){
 document.querySelector('#cartBtn')?.addEventListener('click',()=>document.querySelector('#drawer').classList.add('open'));document.querySelector('#closeDrawer')?.addEventListener('click',()=>document.querySelector('#drawer').classList.remove('open'));document.querySelector('#searchBtn')?.addEventListener('click',openSearch);document.querySelector('#closeSearch')?.addEventListener('click',()=>document.querySelector('#search').classList.remove('open'));
 const searchInput=document.querySelector('#searchInput');
 searchInput?.addEventListener('input',e=>renderSearchResults(e.target.value));
 searchInput?.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('#search').classList.remove('open');return;}if(e.key==='Enter' && e.target.value.trim()){window.open(`/collection.html?q=${encodeURIComponent(e.target.value.trim())}`,'_blank','noopener');}});
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const p=state.products.find(x=>x.id===b.dataset.add);if(!p)return;const exists=state.cart.some(x=>x.id===p.id);if(!exists)state.cart.push(p);localStorage.setItem('elvira-cart',JSON.stringify(state.cart));updateCartBadge();cartRender();document.querySelector('#drawer')?.classList.add('open')});
 document.querySelectorAll('[data-heart]').forEach(b=>b.onclick=()=>{const id=b.dataset.heart;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];localStorage.setItem('elvira-favorites',JSON.stringify(state.favorites));render()});
 document.querySelector('#collectionTrigger')?.addEventListener('click',e=>{e.preventDefault();window.__elviraClicks=(window.__elviraClicks||0)+1;clearTimeout(window.__elviraTimer);clearTimeout(window.__elviraNavTimer);if(window.__elviraClicks>=7){window.__elviraClicks=0;location.href='admin.html';return;}window.__elviraNavTimer=setTimeout(()=>{window.__elviraClicks=0;window.open('collection.html','_blank','noopener')},650);window.__elviraTimer=setTimeout(()=>{window.__elviraClicks=0},2400)});
}
function updateCartBadge(){const badge=document.querySelector('#cartBtn span');if(badge)badge.textContent=`(${state.cart.length})`}
function cartRender(){const box=document.querySelector('#cartItems');if(!box)return;const c=contentFrom(state.settings);updateCartBadge();if(!state.cart.length){box.innerHTML=`<p class="empty">${esc(c.cart_empty)}</p>`;return}box.innerHTML=state.cart.map((p,i)=>`<div class="cart-row"><img src="${esc(safeUrl(productImage(p)))}" alt=""><div><strong>${esc(p.name)}</strong><span>${money(finalPrice(p))}</span></div><button data-remove="${i}">×</button></div>`).join('')+`<div class="cart-total"><span>${esc(c.cart_total)}</span><strong>${money(state.cart.reduce((a,p)=>a+finalPrice(p),0))}</strong></div><div class="cart-checkout-actions"><a class="primary full" href="product.html?id=${encodeURIComponent(state.cart[0].id)}&checkout=1">BUY NOW</a><a class="secondary full" href="collection.html" target="_blank">CONTINUE SHOPPING</a></div>`;box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.cart.splice(Number(b.dataset.remove),1);localStorage.setItem('elvira-cart',JSON.stringify(state.cart));cartRender()})}
load();
