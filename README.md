# Loly Life

Une petite vie à mener — jeu de simulation de vie mobile, jouable dans le navigateur.

🎮 **[Jouer en ligne →](https://dryk7.github.io/loly-life/)**

## C'est quoi

Un mini-Sims top-down portrait, optimisé mobile, sans dépendances ni build step. PWA installable. Tu crées ton perso, tu vis ta vie dans un appart 4 pièces : tu manges, tu dors, tu travailles, tu te détends. Tes besoins descendent, à toi de gérer.

## Fonctionnalités

- **Création de perso** complète : genre, peau (6 tons), cheveux (7 couleurs × 4 coupes), vêtement haut (T-shirt, Pull, Débardeur, Robe), bas (Pantalon, Short, Jupe), couleurs séparées haut/bas
- **Appartement 4 zones** : chambre, salle de bain, bureau, cuisine, salon
- **11 meubles interactifs** : lit, douche, WC, ordi, frigo, cuisinière, télé, canapé, plante, etc.
- **5 besoins** qui décroissent en temps réel : Faim, Énergie, Hygiène, Social, Fun
- **Économie** : travailler à l'ordi → argent → cuisiner / consommables
- **Cycle jour/nuit** avec teinte du sol et couleur du ciel aux fenêtres
- **Pathfinding** tap-to-walk, animation directionnelle du perso
- **Sauvegarde auto** dans localStorage
- **PWA installable** depuis le navigateur

## Contrôles

- **Tap sur un meuble** : le perso s'y rend et lance l'action
- **Tap sur le sol** : le perso marche jusqu'à la case
- **Bouton 📞** : appeler un ami (besoin Social)
- **Bouton 😴** : dormir (avance le temps)
- **Bouton ⚙** : voir le statut détaillé

## Stack

Pure vanilla — HTML5, CSS3, JavaScript (Canvas 2D). Aucun build, aucune dépendance, aucun framework. Service worker pour le mode offline.

## Lancer en local

```bash
# Solution 1 : ouvrir directement
open index.html
# (le service worker ne s'enregistre pas en file:// mais le jeu marche)

# Solution 2 : serveur local pour le PWA
python -m http.server 8000
# puis http://localhost:8000
```

## Structure

```
loly-life/
├── index.html              # Point d'entrée + écran de création
├── styles.css              # Styles UI (HUD, modales, swatches)
├── game.js                 # Logique du jeu, rendu canvas, état
├── manifest.webmanifest    # Manifest PWA
├── sw.js                   # Service worker (cache offline)
└── icon.svg                # Icône (maison)
```
