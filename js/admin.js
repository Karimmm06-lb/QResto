/* QResto — tableau de bord du patron */

const $ = sel => document.querySelector(sel);

function bars(rows) {
  if (!rows.length) return '<div class="empty">Pas encore de données.</div>';
  const max = Math.max(...rows.map(r => r.value));
  return rows.map(r => `
    <div class="bar">
      <span class="lbl">${r.label}</span>
      <span class="track"><span class="fill" style="width:${Math.round((r.value / max) * 100)}%"></span></span>
      <span class="n">${r.suffix ? r.value.toLocaleString('fr-DZ') + r.suffix : r.value}</span>
    </div>`).join('');
}

function render(orders) {
  const ca = orders.reduce((s, o) => s + o.total, 0);
  $('#ca').textContent = fmt.price(ca);
  $('#nb').textContent = orders.length;
  $('#moy').textContent = fmt.price(orders.length ? Math.round(ca / orders.length) : 0);
  $('#attente').textContent = orders.length
    ? `${Math.round(orders.reduce((s, o) => s + o.eta, 0) / orders.length)} min` : '0 min';

  const perDish = {};
  orders.forEach(o => o.items.forEach(i => { perDish[i.id] = (perDish[i.id] || 0) + i.qty; }));
  $('#top').innerHTML = bars(
    Object.entries(perDish)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([id, qty]) => {
        const d = MENU.find(m => m.id === id);
        return { label: `${d.emoji} ${d.name.fr}`, value: qty };
      })
  );

  const perHour = {};
  orders.forEach(o => {
    const h = new Date(o.createdAt).getHours();
    perHour[h] = (perHour[h] || 0) + 1;
  });
  $('#hours').innerHTML = bars(
    Object.entries(perHour).sort((a, b) => a[0] - b[0])
      .map(([h, n]) => ({ label: `${String(h).padStart(2, '0')}h`, value: n }))
  );

  const perTable = {};
  orders.forEach(o => { perTable[o.table] = (perTable[o.table] || 0) + o.total; });
  $('#tables').innerHTML = bars(
    Object.entries(perTable).sort((a, b) => b[1] - a[1])
      .map(([tbl, sum]) => ({ label: `Table ${tbl}`, value: sum, suffix: ' DA' }))
  );
}

$('#clearBtn').onclick = () => { if (confirm('Effacer toutes les commandes ?')) Store.clear(); };

$('#seedBtn').onclick = () => {
  const now = Date.now();
  const demo = Array.from({ length: 18 }, (_, k) => {
    const items = Array.from({ length: 1 + (k % 3) }, (_, j) => {
      const d = MENU[(k * 5 + j * 3) % MENU.length];
      return { id: d.id, qty: 1 + ((k + j) % 2), price: d.price, emoji: d.emoji, name: d.name };
    });
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    return {
      id: `demo-${k}`,
      number: 1 + k,
      table: 1 + (k % RESTO.tables),
      items, total, note: '',
      status: 'payee',
      createdAt: new Date(now - (18 - k) * 22 * 60000).toISOString(),
      eta: 8 + items.length * 2,
    };
  });
  Store.seed(demo);
};

Store.onChange(render);
