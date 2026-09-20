#!/usr/bin/env python3
"""Découpe le poster « Dumbbell Workouts » en 40 vignettes d'exercices.

Usage :
    python3 scripts/decouper_poster.py <image_du_poster> [--sortie public/exercices]
                                       [--planche planche.png] [--debug]

L'image peut être une photo, un scan ou une capture d'écran contenant le poster
en entier. Le script :
  1. repère les bandes bleues (titre, 5 en-têtes de section, pied de page) ;
  2. en déduit la largeur utile du poster et la grille de 5 colonnes ;
  3. découpe chaque case, retire le libellé anglais imprimé sous le dessin ;
  4. enregistre une vignette PNG par exercice dans le dossier de sortie, nommée
     d'après l'identifiant utilisé par l'application (src/data/exercices.ts) ;
  5. enregistre aussi le poster complet recadré (_poster.jpg).

Pour obtenir des vignettes plus nettes, relancez simplement le script avec une
image de meilleure résolution : les fichiers sont remplacés, l'application les
prend en compte au prochain lancement.

Dépendance : Pillow  (pip install pillow)
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:  # pragma: no cover - message d'aide
    sys.exit("Pillow est requis : pip install pillow")

# Identifiants des exercices, dans l'ordre de lecture du poster
# (de gauche à droite, de haut en bas). Doit rester aligné avec
# src/data/exercices.ts.
SECTIONS: list[tuple[str, list[list[str]]]] = [
    (
        "Haut du corps",
        [
            ["hammer-curl", "grip-curl", "concentration-curl", "tricep-kickback", "tricep-extension"],
            ["alternating-front-raise", "side-raise", "shoulder-press", "shoulder-shrug", "wrist-curl"],
            ["dumbbell-pullover", "bench-press", "incline-bench-press", "chest-fly", "reverse-fly"],
        ],
    ),
    ("Gainage", [["side-bend", "bow-extension", "russian-twist", "v-up", "v-sit-cross-jab"]]),
    ("Dos", [["single-arm-row", "incline-row", "floor-t-raise", "renegade-row", "seesaw-row"]]),
    (
        "Bas du corps",
        [
            ["squat", "goblet-squat", "sumo-squat", "jump-squat", "romanian-deadlift"],
            ["glute-bridge", "reverse-lunge", "side-lunge", "step-up", "calf-raise"],
        ],
    ),
    ("Corps entier", [["plank-t", "swing", "farmers-walk", "thruster", "woodchop"]]),
]

NB_COLONNES = 5


@dataclass
class Bande:
    haut: int
    bas: int  # inclus

    @property
    def hauteur(self) -> int:
        return self.bas - self.haut + 1


def masque_bleu(img: Image.Image) -> Image.Image:
    """Masque binaire (255) des pixels du bleu foncé des en-têtes."""
    r, g, b = img.split()
    rouge_faible = r.point(lambda v: 255 if v < 110 else 0)
    vert_faible = g.point(lambda v: 255 if v < 140 else 0)
    bleu_fort = b.point(lambda v: 255 if v > 100 else 0)
    # b - r nettement positif (évite les gris foncés)
    ecart = ImageChops.subtract(b, r).point(lambda v: 255 if v > 45 else 0)
    m = ImageChops.multiply(rouge_faible, vert_faible)
    m = ImageChops.multiply(m, bleu_fort)
    m = ImageChops.multiply(m, ecart)
    return m


def fractions_par_ligne(masque: Image.Image) -> list[float]:
    largeur, hauteur = masque.size
    colonne = masque.resize((1, hauteur), Image.BOX)
    return [colonne.getpixel((0, y)) / 255.0 for y in range(hauteur)]


def fractions_par_colonne(masque: Image.Image) -> list[float]:
    largeur, hauteur = masque.size
    ligne = masque.resize((largeur, 1), Image.BOX)
    return [ligne.getpixel((x, 0)) / 255.0 for x in range(largeur)]


def grouper(indices: list[int], tolerance: int = 2) -> list[Bande]:
    bandes: list[Bande] = []
    for i in indices:
        if bandes and i - bandes[-1].bas <= tolerance:
            bandes[-1].bas = i
        else:
            bandes.append(Bande(i, i))
    return bandes


def fusionner(bandes: list[Bande], frac: list[float], seuil: float = 0.08) -> list[Bande]:
    """Fusionne deux bandes voisines si les lignes qui les séparent restent
    majoritairement bleues (texte blanc imprimé sur le fond bleu du titre ou du
    pied de page)."""
    resultat: list[Bande] = []
    for b in bandes:
        if resultat:
            entre = frac[resultat[-1].bas + 1 : b.haut]
            if entre and min(entre) > seuil:
                resultat[-1].bas = b.bas
                continue
        resultat.append(b)
    return resultat


def detecter_bandes(img: Image.Image, debug: bool) -> tuple[list[Bande], int, int]:
    masque = masque_bleu(img)
    largeur, hauteur = img.size

    # 1er passage : lignes majoritairement bleues sur toute la largeur de l'image
    frac_lignes = fractions_par_ligne(masque)
    lignes_bleues = [y for y, f in enumerate(frac_lignes) if f > 0.35]
    bandes = fusionner([b for b in grouper(lignes_bleues) if b.hauteur >= 8], frac_lignes)
    if len(bandes) < 3:
        sys.exit("Impossible de repérer les bandes bleues du poster (image trop sombre ou recadrée ?)")

    # Largeur utile : colonnes bleues sur les lignes des barres de section
    # (les barres fines ; le titre et le pied de page, plus hauts, débordent
    # sur la marge du poster et fausseraient la grille).
    plus_haute = max(b.hauteur for b in bandes)
    barres = [b for b in bandes if b.hauteur < 0.6 * plus_haute] or bandes
    compte = [0.0] * largeur
    total = 0
    for b in barres:
        sous = masque.crop((0, b.haut, largeur, b.bas + 1))
        fr = fractions_par_colonne(sous)
        for x in range(largeur):
            compte[x] += fr[x] * b.hauteur
        total += b.hauteur
    frac_colonnes = [c / total for c in compte]
    colonnes_bleues = [x for x, f in enumerate(frac_colonnes) if f > 0.5]
    if not colonnes_bleues:
        sys.exit("Impossible de déterminer la largeur du poster")
    x0, x1 = colonnes_bleues[0], colonnes_bleues[-1]

    # 2e passage : lignes bleues mesurées uniquement sur la largeur du poster
    masque_poster = masque.crop((x0, 0, x1 + 1, hauteur))
    frac_lignes = fractions_par_ligne(masque_poster)
    lignes_bleues = [y for y, f in enumerate(frac_lignes) if f > 0.55]
    bandes = fusionner([b for b in grouper(lignes_bleues) if b.hauteur >= 8], frac_lignes)

    if debug:
        print(f"Largeur utile du poster : x={x0}..{x1}")
        for b in bandes:
            print(f"  bande bleue y={b.haut}..{b.bas} (h={b.hauteur})")

    attendu = 2 + len(SECTIONS)  # titre + sections + pied de page
    if len(bandes) != attendu:
        sys.exit(
            f"{len(bandes)} bandes bleues trouvées, {attendu} attendues "
            "(titre, 5 en-têtes, pied de page). Relancez avec --debug."
        )
    return bandes, x0, x1


def bornes_interieures(img: Image.Image, boite: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Réduit la boîte pour écarter les traits de grille gris qui la bordent."""
    g = img.crop(boite).convert("L")
    largeur, hauteur = g.size
    lignes = g.resize((1, hauteur), Image.BOX)
    colonnes = g.resize((largeur, 1), Image.BOX)

    def est_trait(v: float) -> bool:
        return v < 236

    haut = 0
    while haut < hauteur // 4 and est_trait(lignes.getpixel((0, haut))):
        haut += 1
    bas = hauteur - 1
    while bas > 3 * hauteur // 4 and est_trait(lignes.getpixel((0, bas))):
        bas -= 1
    gauche = 0
    while gauche < largeur // 4 and est_trait(colonnes.getpixel((gauche, 0))):
        gauche += 1
    droite = largeur - 1
    while droite > 3 * largeur // 4 and est_trait(colonnes.getpixel((droite, 0))):
        droite -= 1
    x, y = boite[0], boite[1]
    return (x + gauche + 1, y + haut + 1, x + droite, y + bas)


def retirer_libelle(cellule: Image.Image) -> Image.Image:
    """Coupe le libellé imprimé en bas de la case (texte sombre centré)."""
    g = cellule.convert("L")
    largeur, hauteur = g.size
    sombre = g.point(lambda v: 255 if v < 120 else 0)
    frac = fractions_par_ligne(sombre)

    y = hauteur - 1
    # marge blanche sous le texte
    while y > 0 and frac[y] < 0.004:
        y -= 1
    # lignes du texte
    while y > 0 and frac[y] >= 0.004:
        y -= 1
    # espace blanc entre le dessin et le texte : on exige au moins 3 lignes vides
    blancs = 0
    coupe = y
    while y > 0 and blancs < 3:
        if frac[y] < 0.004:
            blancs += 1
        else:
            blancs = 0
            coupe = y
        y -= 1
    coupe = coupe if blancs >= 3 else y
    # garde-fou : la coupe doit rester dans le dernier tiers de la case
    if not (0.6 * hauteur <= coupe <= 0.95 * hauteur):
        coupe = int(0.84 * hauteur)
    return cellule.crop((0, 0, largeur, coupe))


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument("image", type=Path, help="photo, scan ou capture du poster complet")
    parseur.add_argument("--sortie", type=Path, default=Path("public/exercices"), help="dossier des vignettes")
    parseur.add_argument("--planche", type=Path, help="enregistre une planche de contrôle PNG")
    parseur.add_argument("--debug", action="store_true", help="affiche les zones détectées")
    args = parseur.parse_args()

    img = Image.open(args.image).convert("RGB")
    bandes, x0, x1 = detecter_bandes(img, args.debug)
    titre, en_tetes, pied = bandes[0], bandes[1:-1], bandes[-1]

    args.sortie.mkdir(parents=True, exist_ok=True)

    # Poster complet recadré (petite marge autour des bandes)
    marge = max(4, (x1 - x0) // 150)
    poster = img.crop((max(0, x0 - marge), max(0, titre.haut - marge), min(img.width, x1 + 1 + marge), min(img.height, pied.bas + 1 + marge)))
    poster.save(args.sortie / "_poster.jpg", quality=88, optimize=True)

    vignettes: list[tuple[str, Image.Image]] = []
    largeur_col = (x1 + 1 - x0) / NB_COLONNES

    for indice, (nom_section, lignes_ids) in enumerate(SECTIONS):
        haut = en_tetes[indice].bas + 1
        bas = (en_tetes[indice + 1].haut if indice + 1 < len(en_tetes) else pied.haut) - 1
        hauteur_ligne = (bas + 1 - haut) / len(lignes_ids)
        if args.debug:
            print(f"Section {nom_section}: y={haut}..{bas}, {len(lignes_ids)} ligne(s) de {hauteur_ligne:.1f}px")
        for l, ids in enumerate(lignes_ids):
            for c, identifiant in enumerate(ids):
                boite = (
                    round(x0 + c * largeur_col),
                    round(haut + l * hauteur_ligne),
                    round(x0 + (c + 1) * largeur_col),
                    round(haut + (l + 1) * hauteur_ligne),
                )
                boite = bornes_interieures(img, boite)
                cellule = img.crop(boite)
                vignette = retirer_libelle(cellule)
                vignette.save(args.sortie / f"{identifiant}.png", optimize=True)
                vignettes.append((identifiant, vignette))
                if args.debug:
                    print(f"  {identifiant}: case {boite} -> {vignette.size[0]}x{vignette.size[1]}")

    print(f"{len(vignettes)} vignettes enregistrées dans {args.sortie}/ (+ _poster.jpg)")

    if args.planche:
        l_max = max(v.size[0] for _, v in vignettes)
        h_max = max(v.size[1] for _, v in vignettes) + 18
        planche = Image.new("RGB", (NB_COLONNES * (l_max + 6), 8 * (h_max + 6)), "white")
        dessin = ImageDraw.Draw(planche)
        for n, (identifiant, v) in enumerate(vignettes):
            x = (n % NB_COLONNES) * (l_max + 6)
            y = (n // NB_COLONNES) * (h_max + 6)
            planche.paste(v, (x, y))
            dessin.rectangle((x, y, x + v.size[0], y + v.size[1]), outline="red")
            dessin.text((x + 2, y + v.size[1] + 2), identifiant, fill="black")
        planche.save(args.planche)
        print(f"Planche de contrôle : {args.planche}")


if __name__ == "__main__":
    main()
