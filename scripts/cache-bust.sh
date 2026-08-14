#!/usr/bin/env bash
# Script de build Netlify : remplace toutes les occurrences de ?v=NN dans
# les fichiers HTML par ?v=<sha-court-du-commit>. Résultat : après chaque
# push, les navigateurs des clients re-téléchargent automatiquement les
# JS et CSS mis à jour, sans que je doive bumper les versions à la main.
#
# Variables Netlify disponibles :
#   COMMIT_REF : SHA complet du commit qui déclenche le build
#   BUILD_ID   : identifiant unique de ce build (fallback si pas de commit)
set -euo pipefail

# Hash court (8 caractères) : compromis entre lisibilité et unicité.
VERSION="${COMMIT_REF:-${BUILD_ID:-manual}}"
VERSION="${VERSION:0:8}"

echo "→ Cache-bust : ?v=$VERSION appliqué aux HTML"

# -i.bak pour compatibilité BSD sed (Netlify tourne sur Linux/GNU sed,
# mais la syntaxe -i '' de BSD casse le portage local). On nettoie après.
for f in *.html; do
  [ -f "$f" ] || continue
  sed -i.bak -E "s/\?v=[A-Za-z0-9]+/?v=$VERSION/g" "$f"
  rm -f "$f.bak"
  echo "  $f"
done

echo "→ Build statique terminé"
