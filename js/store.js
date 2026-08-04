/* QResto — couche d'accès aux données (Supabase).

   Ce fichier est le SEUL à connaître l'origine des données. Les vues
   (client.js, caisse.js, admin.js) passent exclusivement par lui.

   Deux mécanismes de fraîcheur, volontairement différents (D22) :
   - la caisse s'ABONNE (notification poussée, moins de 3 s — BNF1)
   - le client INTERROGE toutes les 10 s (aucune exigence de latence)

   Aucune écriture directe en base : tout passe par des procédures stockées,
   parce que le navigateur du client n'est jamais une source de confiance. */

const Store = (() => {
  let sb = null;                    // client Supabase, chargé à la demande
  let pret = null;                  // promesse d'initialisation

  async function init() {
    if (pret) return pret;
    pret = (async () => {
      const { createClient } = await import(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
      );
      sb = createClient(CONFIG.url, CONFIG.cle, {
        auth: { persistSession: true, storageKey: 'qresto.auth' },
      });
      return sb;
    })();
    return pret;
  }

  // Traduit les codes d'erreur PostgreSQL en messages affichables
  // (contrat défini dans docs/03-conception.md §3.5).
  function messageErreur(e) {
    const brut = e?.message || String(e);
    if (/Quantité invalide/i.test(brut))        return 'Quantité invalide.';
    if (/plus disponible/i.test(brut))          return "Un plat de votre panier n'est plus disponible. Rafraîchissez le menu.";
    if (/Table inconnue/i.test(brut))           return 'QR code invalide. Demandez au personnel.';
    if (/Commande vide/i.test(brut))            return 'Votre panier est vide.';
    if (/Motif obligatoire/i.test(brut))        return "Indiquez un motif : la commande est déjà lancée en cuisine.";
    if (/Interdit/i.test(brut))                 return 'Action non autorisée.';
    if (/Invalid login/i.test(brut))            return 'Identifiants incorrects.';
    return brut;
  }

  return {
    messageErreur,

    // ---------------------------------------------------------------- menu
    async menu(restaurantId) {
      await init();
      const [cats, plats, portees] = await Promise.all([
        sb.from('categories').select('*').eq('restaurant_id', restaurantId).order('ordre'),
        sb.from('plats')
          .select('*, variantes_plat(*)')
          .eq('restaurant_id', restaurantId).eq('archive', false).order('ordre'),
        sb.from('supplements_categories').select('*'),
      ]);
      if (cats.error) throw cats.error;
      if (plats.error) throw plats.error;

      plats.data.forEach(p => p.variantes_plat.sort((a, b) => a.ordre - b.ordre));

      // `ordre` est relatif à la catégorie : trier les plats dessus seul
      // mélangerait les catégories dans la vue « Tout ».
      const rang = new Map(cats.data.map((c, i) => [c.id, i]));
      plats.data.sort((a, b) =>
        (rang.get(a.categorie_id) ?? 99) - (rang.get(b.categorie_id) ?? 99) || a.ordre - b.ordre);

      // D5-bis : un supplément est un plat marqué comme tel. Il ne s'affiche
      // pas dans le menu — il s'ajoute sur une ligne du panier.
      const supplements = plats.data.filter(p => p.est_supplement);

      // Portée d'un supplément : les catégories auxquelles il s'applique.
      // Aucune ligne = applicable partout, pour ne pas imposer ce paramétrage
      // aux petits restaurants.
      supplements.forEach(s => {
        s.portee = (portees.data || [])
          .filter(x => x.supplement_id === s.id)
          .map(x => x.categorie_id);
      });
      const cartes = plats.data.filter(p => !p.est_supplement);
      const catsUtiles = cats.data.filter(c => cartes.some(p => p.categorie_id === c.id));

      return { categories: catsUtiles, plats: cartes, supplements };
    },

    // Le QR ne contient qu'un jeton : il faut retrouver le restaurant.
    // Passe par les plats, seule table lisible sans authentification qui
    // porte le restaurant_id — le jeton lui-même n'est pas exposé (D3a).
    async contexteTable(qrToken) {
      await init();
      const { data, error } = await sb.rpc('contexte_table', { p_qr_token: qrToken });
      if (error) throw error;
      return data;
    },

    // ------------------------------------------------------------- client
    async creerCommande({ qrToken, lignes, nom, note }) {
      await init();
      const { data, error } = await sb.rpc('creer_commande', {
        p_qr_token: qrToken, p_lignes: lignes, p_nom: nom || null, p_note: note || null,
      });
      if (error) throw error;
      return data;
    },

    // D22 : interrogation, pas abonnement. S'arrête sur un état terminal.
    suivreCommande(secret, callback) {
      let actif = true;
      (async () => {
        await init();
        while (actif) {
          const { data, error } = await sb.rpc('suivre_commande', { p_secret: secret });
          if (!actif) return;
          if (!error && data && data[0]) {
            callback(data[0]);
            if (['servie', 'annulee'].includes(data[0].statut)) return;
          }
          await new Promise(r => setTimeout(r, CONFIG.intervalleSuivi));
        }
      })();
      return () => { actif = false; };
    },

    // ------------------------------------------------------- authentification
    async connexion(email, motDePasse) {
      await init();
      const { data, error } = await sb.auth.signInWithPassword({ email, password: motDePasse });
      if (error) throw error;
      return data.user;
    },

    async deconnexion() { await init(); await sb.auth.signOut(); },

    async utilisateur() {
      await init();
      const { data } = await sb.auth.getSession();
      return data.session?.user || null;
    },

    // Le restaurant vient du jeton, jamais d'un paramètre : c'est ce qui rend
    // le cloisonnement infalsifiable (D4).
    async monRestaurant() {
      const u = await this.utilisateur();
      return u?.app_metadata?.restaurant_id || null;
    },

    // -------------------------------------------------------------- caisse
    // Une session avec ses commandes et leurs lignes : c'est la vue groupée
    // par table, qui est aussi le dispositif de détection des commandes
    // frauduleuses (D3a).
    async sessionsOuvertes() {
      await init();
      const { data, error } = await sb
        .from('sessions')
        .select('*, tables_resto(numero), commandes(*, lignes_commande(*))')
        .in('statut', ['ouverte', 'a_payer'])
        .order('ouverte_le', { ascending: false });
      if (error) throw error;
      return data;
    },

    async sessionsDuJour() {
      await init();
      const { data, error } = await sb
        .from('sessions')
        .select('*, tables_resto(numero), commandes(*, lignes_commande(*))')
        .order('ouverte_le', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },

    // BNF1 : notification poussée, moins de 3 s.
    async abonnerCommandes(callback) {
      await init();
      const canal = sb.channel('qresto-caisse')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, callback)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, callback)
        .subscribe();
      return () => sb.removeChannel(canal);
    },

    async imprimer(commandeId) {
      await init();
      const { error } = await sb.rpc('marquer_imprimee', { p_commande_id: commandeId });
      if (error) throw error;
    },

    async changerStatut(commandeId, statut) {
      await init();
      const { error } = await sb.rpc('changer_statut', {
        p_commande_id: commandeId, p_statut: statut });
      if (error) throw error;
    },

    async annuler(commandeId, motif) {
      await init();
      const { error } = await sb.rpc('annuler_commande', {
        p_commande_id: commandeId, p_motif: motif || null });
      if (error) throw error;
    },

    async encaisser(sessionId) {
      await init();
      const { data, error } = await sb.rpc('encaisser_session', { p_session_id: sessionId });
      if (error) throw error;
      return data;
    },

    async basculerDisponibilite(platId, disponible) {
      await init();
      const { error } = await sb.from('plats').update({ disponible }).eq('id', platId);
      if (error) throw error;
    },

    async cloturerJournee(restaurantId) {
      await init();
      const { data, error } = await sb.rpc('cloturer_journee', { p_restaurant_id: restaurantId });
      if (error) throw error;
      return data;
    },

    async restaurant(restaurantId) {
      await init();
      const { data, error } = await sb
        .from('restaurants').select('*').eq('id', restaurantId).single();
      if (error) throw error;
      return data;
    },

    // --------------------------------------------------------------- tables
    async tables(restaurantId) {
      await init();
      const { data, error } = await sb
        .from('tables_resto').select('*').eq('restaurant_id', restaurantId).order('numero');
      if (error) throw error;
      return data;
    },
  };
})();

const fmt = {
  prix: (n, lang = 'fr') =>
    `${Number(n).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ')} ${lang === 'ar' ? 'دج' : 'DA'}`,
  heure: iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  depuis(iso) {
    const min = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    return `il y a ${Math.floor(min / 60)} h`;
  },
};
