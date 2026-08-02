/* QResto — page client (scan du QR de la table) */

const params = new URLSearchParams(location.search);
const TABLE = parseInt(params.get('table'), 10) || 1;

let lang = localStorage.getItem('qresto.lang') || 'fr';
let cat = 'all';
let cart = {};
let myOrderId = null;

const $ = sel => document.querySelector(sel);
const t = k => I18N[lang][k];
const price = n => `${n.toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ')} ${t('da')}`;

function setLang(next) {
  lang = next;
  localStorage.setItem('qresto.lang', next);
  document.documentElement.lang = next;
  document.documentElement.dir = I18N[next].dir;
  document.querySelectorAll('.langs button').forEach(b => b.classList.toggle('on', b.dataset.lang === next));
  render();
}

function cartItems() {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const dish = MENU.find(d => d.id === id);
      return { id, qty, price: dish.price, emoji: dish.emoji, name: dish.name };
    });
}

const cartTotal = () => cartItems().reduce((s, i) => s + i.price * i.qty, 0);
const cartCount = () => cartItems().reduce((s, i) => s + i.qty, 0);

function renderCats() {
  $('#cats').innerHTML = CATEGORIES.map(c =>
    `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${c.emoji} ${c.label[lang]}</button>`
  ).join('');
}

function renderDishes() {
  const list = cat === 'all' ? MENU : MENU.filter(d => d.cat === cat);
  $('#dishes').innerHTML = list.map(d => {
    const qty = cart[d.id] || 0;
    return `
      <div class="card dish">
        <div class="pic">${d.emoji}</div>
        <div class="info">
          <div class="name">${d.name[lang]}</div>
          <div class="desc">${d.desc[lang]}</div>
          <div class="price">${price(d.price)}</div>
        </div>
        <div class="qty">
          ${qty > 0 ? `<button data-minus="${d.id}">−</button><span class="n">${qty}</span>` : ''}
          <button class="plus" data-plus="${d.id}">+</button>
        </div>
      </div>`;
  }).join('');
}

function renderCartbar() {
  const n = cartCount();
  $('#cartbar').style.display = n ? 'block' : 'none';
  $('#noteBox').style.display = n ? 'block' : 'none';
  $('#note').placeholder = t('note');
  $('#cartCount').textContent = `${n} ${t('items')}`;
  $('#cartTotal').textContent = price(cartTotal());
  $('#sendBtn').textContent = t('send');
}

function render() {
  $('#tableBadge').textContent = `${t('table')} ${TABLE}`;
  if (myOrderId) { renderConfirm(); return; }
  $('#menuView').style.display = '';
  $('#confirmView').style.display = 'none';
  renderCats();
  renderDishes();
  renderCartbar();
}

function renderConfirm() {
  const order = Store.get(myOrderId);
  if (!order) { myOrderId = null; render(); return; }

  $('#menuView').style.display = 'none';
  $('#cartbar').style.display = 'none';
  const view = $('#confirmView');
  view.style.display = '';
  view.innerHTML = `
    <div class="card" style="text-align:center;margin-top:24px">
      <div style="font-size:52px">✅</div>
      <h1 style="margin-top:8px">${t('sent')}</h1>
      <p class="sub">${t('orderNo')} ${order.number} — ${t('table')} ${order.table}</p>
      <div class="badge" style="font-size:15px;padding:10px 16px">
        ⏱️ ${t('eta')} ${order.eta} ${t('min')}
      </div>
      <div style="margin:18px 0">
        <div class="k" style="color:var(--muted);font-size:13px">${t('status')}</div>
        <span class="chip ${order.status}">${t('st_' + order.status)}</span>
      </div>
      <ul style="list-style:none;padding:0;text-align:start">
        ${order.items.map(i => `<li style="display:flex;justify-content:space-between;padding:4px 0">
          <span>${i.emoji} ${i.qty} × ${i.name[lang]}</span><span>${price(i.price * i.qty)}</span></li>`).join('')}
      </ul>
      <div style="border-top:1px dashed var(--border);padding-top:10px;display:flex;justify-content:space-between;font-weight:800">
        <span>${t('total')}</span><span>${price(order.total)}</span>
      </div>
      <p class="sub" style="margin-top:18px">💵 ${t('payInfo')}</p>
      <button class="btn ghost wide" id="againBtn">${t('newOrder')}</button>
    </div>`;

  $('#againBtn').onclick = () => { myOrderId = null; cart = {}; render(); };
}

document.addEventListener('click', e => {
  const plus = e.target.closest('[data-plus]');
  const minus = e.target.closest('[data-minus]');
  const catBtn = e.target.closest('[data-cat]');
  const langBtn = e.target.closest('[data-lang]');

  if (plus) { cart[plus.dataset.plus] = (cart[plus.dataset.plus] || 0) + 1; renderDishes(); renderCartbar(); }
  if (minus) { cart[minus.dataset.minus] -= 1; renderDishes(); renderCartbar(); }
  if (catBtn) { cat = catBtn.dataset.cat; renderCats(); renderDishes(); }
  if (langBtn) setLang(langBtn.dataset.lang);
});

$('#sendBtn').onclick = () => {
  const order = Store.add({
    table: TABLE, items: cartItems(), total: cartTotal(), lang,
    note: $('#note').value.trim(),
  });
  $('#note').value = '';
  myOrderId = order.id;
  render();
};

// La caisse met le statut à jour → l'écran du client suit en direct.
Store.onChange(() => { if (myOrderId) renderConfirm(); });

setLang(lang);
