# Loly Life — v3.0 La Vie Connectée

Une vie à mener — jeu de simulation de vie 3D dans le navigateur, mobile-first.

🎮 **[Jouer en ligne →](https://dryk7.github.io/loly-life/)**

## C'est quoi

Sims-like 3D entièrement procédural, sans assets externes. Tu crées ton perso, tu emménages dans un appart vide, tu achètes ton mobilier, tu vis ta vie : besoins, carrière, compétences, factures, amis, événements, et un quartier qui bouge autour de toi.

## Quoi de neuf en v3.0

🌍 **Quartier vivant** — la maison est dans un vrai quartier procédural :
- 18 bâtiments voisins, fenêtres allumées la nuit
- Rue avec 3 voitures qui circulent + 3 stationnées
- 4 passants qui marchent sur les trottoirs
- 5 lampadaires qui s'allument la nuit
- 2 cyclistes qui roulent (🆕)
- Feu tricolore animé (🆕)
- Parapluies sur les passants quand il pleut (🆕)
- Parc derrière avec fontaine, bancs, toboggan, fleurs, arbres
- Boîte aux lettres devant la porte

📱 **Téléphone in-game** — bouton dédié dans le HUD :
- 💰 Banque (compte courant + épargne 2%/jour)
- 🍕 Livraison instantanée (Burger/Pizza/Sushi)
- 💬 4 amis générés aléatoirement (chat → +Social)
- 🏆 16 trophées débloquables

🌦 **Météo dynamique** — 5 états chaque jour :
- ☀️ Ensoleillé / ⛅ Nuageux / 🌧 Pluvieux / ❄️ Neige / ⛈ Orage
- Pluie : 600 traits verticaux + parapluies
- Neige : 350 flocons qui dérivent
- Affecte fun/énergie en début de journée

📋 **Quêtes journalières** — 3 objectifs aléatoires, récompense $$ à réclamer

🎨 **Visuel GIGA MAJ** :
- Pipeline PBR complet (MeshStandardMaterial, environment map)
- Normal maps procédurales sur tous les sols
- Tone mapping ACES + color grading custom (split-tone, vignette, saturation)
- Bloom HDR sur émissifs (flammes, écrans, lampes)
- Skybox shader custom avec soleil mobile

## Création de personnage

Sims 2.0 customization : **18 paramètres** + **8 traits** de personnalité qui changent le gameplay.

Identité (genre, stature, carrure) · Visage (peau, yeux, sourcils, pilosité, lunettes) · Cheveux (couleur, coupe parmi 6, chapeau, boucles) · Tenue (haut, couleur, bas, couleur, chaussures) · Personnalité (2 traits parmi 8 : Noctambule, Gourmand, Casanier, Sportif, Sociable, Créatif, Travailleur, Minimaliste).

Bouton 🎲 Aléatoire pour randomiser tout d'un coup.

## Jouer

Tu démarres avec **$3000** dans un appart **complètement vide** (5 pièces séparées + terrasse + jardin) :

1. **Construire** : achète ton mobilier (lit, frigo, douche, WC, ordi…). Catalogue de 25+ items dont 15 essentiels et 14 décos.
2. **Vivre** : 5 besoins qui descendent (Faim, Énergie, Hygiène, Social, Fun). Tap sur un meuble → le perso y va et utilise.
3. **Travailler** : ordi → carrière en 7 niveaux (Stagiaire → CEO), salaire qui augmente.
4. **Apprendre** : 6 compétences (Cuisine, Forme, Charisme, Logique, Art, Musique) qui montent à chaque action.
5. **Décorer** : démolir et refaire la déco selon ta vibe.
6. **Sortir** : la terrasse, le jardin, et au-delà.

## Activités (15)

Sleep · Shower · Toilet · Eat (snack) · Cook · Watch TV · Relax · Work · Call · Plant · Read · Paint · Play guitar · Yoga · Workout

## Événements aléatoires (12h chaque jour)

🚪 Visite d'un ami · 💸 Billet trouvé · ☀️ Belle journée · ☕ Café offert · 📬 Factures tous les 3 jours

## Animations

Toutes les actions ont une animation propre du perso : balance des bras pour cuisiner, jumping jacks pour le sport, pose yoga, strumming guitare, tête penchée pour lire, etc.

Les actions ont aussi des particules : flamme multi-couches sur la cuisinière, jet d'eau + splash sur la douche, écran TV qui change de chaîne toutes les 4s, étincelles, fumée.

## Stack

- **HTML5 + CSS3 + JavaScript ES Modules** vanilla
- **Three.js r160** via CDN (importmap)
- **PWA** : manifest + service worker, installable, fonctionne offline
- **Web Audio API** pour les SFX synthétisés (5 sons)
- **Aucun asset externe** — tout est procédural (geometries, textures Canvas, shaders custom)

## Lancer en local

```bash
# Solution simple
python -m http.server 8000
# puis http://localhost:8000
```

## Structure

```
loly-life/
├── index.html              # HTML + importmap + UI
├── styles.css              # Glassmorphic UI
├── game.js                 # ~3500 lignes : monde 3D, gameplay, animations
├── manifest.webmanifest    # Manifest PWA
├── sw.js                   # Service worker (cache offline)
└── icon.svg                # Icône
```

## Branches

- `main` : version stable déployée sur GitHub Pages
- `3d-prototype` : working branch (synchrone avec main pour l'instant)

## Crédits

Créé par [@Dryk7](https://github.com/Dryk7) avec [Claude](https://claude.ai/).
