/* QResto — écran caisse : réception temps réel + impression du ticket cuisine */

const $ = sel => document.querySelector(sel);
const LABELS = { nouvelle: 'Nouvelle', cuisine: 'En cuisine', prete: 'Prête', payee: 'Payée' };

let soundOn = true;
let known = new Set();
let firstRender = true;

function beep() {
  if (!soundOn) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start(); osc.stop(ctx.currentTime + 0.35);
}

function orderCard(o) {
  const actions = {
    nouvelle: `<button class="btn sm blue" data-print="${o.id}">🖨️ Imprimer ticket</button>`,
    cuisine: `<button class="btn sm green" data-status="prete" data-id="${o.id}">✅ Prête</button>
              <button class="btn sm ghost" data-print="${o.id}">🖨️ Réimprimer</button>`,
    prete: `<button class="btn sm" data-status="payee" data-id="${o.id}">💵 Encaisser</button>`,
    payee: `<button class="btn sm ghost" data-print="${o.id}">🖨️ Reçu</button>`,
  }[o.status];

  return `
    <div class="card order ${o.status}">
      <div class="head">
        <div class="tbl">Table ${o.table}</div>
        <div class="num">N°${o.number} · ${fmt.time(o.createdAt)} · ${fmt.ago(o.createdAt)}</div>
        <div class="spacer" style="flex:1"></div>
        <span class="chip ${o.status}">${LABELS[o.status]}</span>
      </div>
      <ul>
        ${o.items.map(i => `<li><span>${i.emoji} ${i.qty} × ${i.name.fr}</span><span>${fmt.price(i.price * i.qty)}</span></li>`).join('')}
      </ul>
      ${o.note ? `<div class="note">📝 ${o.note}</div>` : ''}
      <div class="tot"><span>Total</span><span>${fmt.price(o.total)}</span></div>
      <div class="actions" style="margin-top:12px">${actions}</div>
    </div>`;
}

function render(orders) {
  const active = orders.filter(o => o.status !== 'payee');
  const paid = orders.filter(o => o.status === 'payee');

  $('#kNew').textContent = orders.filter(o => o.status === 'nouvelle').length;
  $('#kKitchen').textContent = orders.filter(o => o.status === 'cuisine').length;
  $('#kReady').textContent = orders.filter(o => o.status === 'prete').length;
  $('#kCash').textContent = fmt.price(active.reduce((s, o) => s + o.total, 0));

  $('#orders').innerHTML = active.length
    ? active.map(orderCard).join('')
    : `<div class="empty">Aucune commande en cours.<br><small>Ouvre <a href="client.html?table=5">la page client</a> dans un autre onglet pour tester.</small></div>`;

  $('#done').innerHTML = paid.length ? paid.map(orderCard).join('') : `<div class="empty">—</div>`;

  // Bip uniquement pour les commandes jamais vues sur cet écran (pas au 1er chargement).
  const fresh = orders.filter(o => o.status === 'nouvelle' && !known.has(o.id));
  orders.forEach(o => known.add(o.id));
  if (fresh.length && !firstRender) beep();
  firstRender = false;
}

function printTicket(id) {
  const o = Store.get(id);
  if (!o) return;
  $('#ticket').innerHTML = `
    <div class="c b big">${RESTO.name}</div>
    <div class="c">${RESTO.city}</div>
    <hr>
    <div class="c big">TABLE ${o.table}</div>
    <div class="c">Commande N°${o.number} — ${fmt.time(o.createdAt)}</div>
    <hr>
    <table>
      ${o.items.map(i => `<tr><td class="b">${i.qty} x</td><td>${i.name.fr}</td><td class="r">${i.price * i.qty}</td></tr>`).join('')}
    </table>
    <hr>
    <table><tr><td class="b">TOTAL</td><td class="r b">${o.total} DA</td></tr></table>
    ${o.note ? `<hr><div><b>NOTE:</b> ${o.note}</div>` : ''}
    <hr>
    <div class="c">*** PAIEMENT EN CAISSE ***</div>
    <div class="c">Merci et bon appetit !</div>`;

  if (o.status === 'nouvelle') Store.setStatus(o.id, 'cuisine');
  window.print();
}

document.addEventListener('click', e => {
  const p = e.target.closest('[data-print]');
  const s = e.target.closest('[data-status]');
  if (p) printTicket(p.dataset.print);
  if (s) Store.setStatus(s.dataset.id, s.dataset.status);
});

$('#soundBtn').onclick = e => {
  soundOn = !soundOn;
  e.target.textContent = soundOn ? '🔔 Son : ON' : '🔕 Son : OFF';
};

Store.onChange(render);
