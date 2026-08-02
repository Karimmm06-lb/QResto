/* QResto — paramètres de connexion.

   Ces deux valeurs sont PUBLIQUES par conception : elles identifient le projet
   et le rôle anonyme, rien de plus. Toute la sécurité repose sur les politiques
   RLS et sur le fait qu'aucune écriture directe n'est autorisée (voir
   docs/03-conception.md §3.4). Il n'y a donc aucun secret dans ce fichier.

   La clé de service, elle, ne doit JAMAIS apparaître dans du code client. */

const CONFIG = {
  url: 'https://wrfckmajjzqeaejirisf.supabase.co',
  cle: 'sb_publishable_iU2BNhoN4tBG_GEGMnLRtw_5kxoPfNV',
  // D22 : le client anonyme interroge, il ne peut pas s'abonner.
  intervalleSuivi: 10000,
};
