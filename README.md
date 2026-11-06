# Moteur V4 de MotoGP — figure animée

Un V4 à 90° de MotoGP en écorché, posé sur un banc d'essai, qui tourne en continu. On voit le vilebrequin, les bielles, les pistons, les soupapes et les cames bouger, et chaque cylindre s'éclaire au moment de son explosion (ordre 2, 1, 4, 3).

**Ouvrir la figure :** `docs/index.html` (thème clair) ou `docs/v4-motogp.html` (thème sombre), dans n'importe quel navigateur.

- Survoler la figure de gauche à droite règle le régime (8 000 à 18 500 tr/min) ; les flèches du clavier aussi.
- Le mouvement est montré 400 fois plus lentement que la réalité.

## Les chiffres

| | |
|---|---|
| Architecture | V4 à 90°, 4 soupapes par cylindre, 2 arbres à cames par culasse |
| Alésage × course | 81 × 48,5 mm (81 mm = maximum autorisé en MotoGP) |
| Cylindrée | 1 000 cm³ |
| Vilebrequin | 2 manetons décalés de 70° |
| Ordre d'allumage | 0°, 90°, 290°, 380° sur deux tours (« twin pulse » / big bang) |
| À 18 500 tr/min | 154 explosions par seconde et par cylindre, piston à 29,9 m/s en moyenne |

## Fichiers

- `parts.mjs` — le modèle du moteur (cinématique bielle-manivelle, levée des soupapes, explosion) et les pièces redessinées à chaque image.
- `build.mjs` — construit la figure et écrit les pages dans `docs/`.
- `live.js` — l'animation et l'interaction dans la page.
- `vendor/anatomy/` — le kit de dessin du skill [Anatomy](https://github.com/wheresryan22/anatomy) (licence MIT, voir `vendor/anatomy/LICENSE`).

## Reconstruire

Avec Node.js 20 ou plus récent :

```sh
node build.mjs          # thème sombre  → docs/v4-motogp.html
node build.mjs --light  # thème clair   → docs/v4-motogp-light.html
```
