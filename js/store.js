/* QResto — store partagé entre les pages (client / caisse / admin).
   La synchro temps réel passe par BroadcastChannel, avec repli sur l'événement
   'storage' pour les navigateurs qui ne le supportent pas. */

const Store = (() => {
  const KEY = 'qresto.orders.v1';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qresto') : null;
  const listeners = [];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function write(orders) {
    localStorage.setItem(KEY, JSON.stringify(orders));
    if (channel) channel.postMessage({ type: 'sync' });
    notify();
  }

  function notify() {
    const orders = read();
    listeners.forEach(fn => fn(orders));
  }

  if (channel) channel.onmessage = notify;
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });

  // 8 min de base + 2 min par article + 3 min par commande déjà en cuisine
  function estimateEta(itemCount) {
    const inKitchen = read().filter(o => o.status === 'nouvelle' || o.status === 'cuisine').length;
    return 8 + itemCount * 2 + inKitchen * 3;
  }

  return {
    all: read,
    onChange(fn) { listeners.push(fn); fn(read()); },

    add(order) {
      const orders = read();
      const number = orders.length ? Math.max(...orders.map(o => o.number)) + 1 : 101;
      const full = {
        ...order,
        id: `${Date.now()}-${Math.floor(performance.now() * 1000) % 1000}`,
        number,
        status: 'nouvelle',
        createdAt: new Date().toISOString(),
        eta: estimateEta(order.items.reduce((n, i) => n + i.qty, 0)),
      };
      write([full, ...orders]);
      return full;
    },

    setStatus(id, status) {
      write(read().map(o => (o.id === id ? { ...o, status } : o)));
    },

    get(id) { return read().find(o => o.id === id); },

    clear() { write([]); },

    seed(orders) { write([...orders, ...read()]); },
  };
})();

const fmt = {
  price: n => `${n.toLocaleString('fr-DZ')} DA`,
  time: iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  ago(iso) {
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    return `il y a ${Math.floor(mins / 60)} h`;
  },
};
