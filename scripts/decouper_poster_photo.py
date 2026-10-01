#!/usr/bin/env python3
"""Découpe une photo de poster QuickFit en vignettes d'exercices.

Contrairement à `decouper_poster.py`, conçu pour un scan à plat, celui-ci part
d'une photo de téléphone d'un poster plastifié : dominante chaude, éclairage
inégal, reflets et légère perspective.

    python3 scripts/decouper_poster_photo.py <photo> <disposition> \
        [--sortie public/exercices] [--prefixe db2] [--planche controle.png]

Étapes :
  1. rotation EXIF, puis correction de champ plat (division par un flou large)
     qui redresse l'éclairage, efface la dominante et rend le fond blanc ;
  2. repérage des bandeaux de section par leur couleur franche ;
  3. bords gauche/droit du poster interpolés bandeau par bandeau, ce qui
     absorbe la perspective résiduelle (~1,5 % sur ces photos) ;
  4. dans chaque section, détection des traits de grille — un trait est gris
     sur toute sa traversée, là où un dessin est noir par endroits et le fond
     blanc partout ;
  5. repli sur un découpage régulier quand le compte détecté ne correspond pas
     à la disposition annoncée ;
  6. retrait du libellé anglais sous le dessin, puis enregistrement.

Dépendances : Pillow, numpy
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter, ImageOps
except ImportError:  # pragma: no cover
    sys.exit("Dépendances requises : pip install pillow numpy")


# --------------------------------------------------------------- Dispositions

#: Pour chaque poster : les sections dans l'ordre, et la composition de chaque
#: rangée. Une rangée vaut soit un nombre de cellules — découpées par détection
#: des traits de grille, régulièrement à défaut — soit la liste des positions
#: de coupe en fraction de la largeur, quand les traits sont illisibles sur la
#: photo (reflet, bord du poster, impression pâle).
Rangee = int | list[float]
DISPOSITIONS: dict[str, list[tuple[str, list[Rangee]]]] = {
    "dumbbell-v2": [
        ("Haut du corps", [5, 5, 3]),
        ("Gainage", [5]),
        ("Dos", [5]),
        ("Bas du corps", [5, 5]),
        # Les quatre cellules sont très inégales — le burpee en occupe deux —
        # et leurs traits ne survivent pas à l'aplanissement : coupes relevées
        # à la règle sur la photo.
        ("Corps entier", [[0.405, 0.611, 0.813]]),
    ],
    "dumbbell-v1": [
        ("Haut du corps", [5, 5, 5]),
        ("Gainage", [5]),
        ("Dos", [5]),
        ("Bas du corps", [5, 5]),
        ("Corps entier", [5]),
    ],
    "yoga": [
        ("Échauffement", [5]),
        ("Étirements", [5, 4]),
        ("Équilibre", [5, 5]),
        ("Force", [5, 5]),
        ("Gainage", [5]),
        ("Extensions", [4, 4]),
        # Première rangée : un faux trait coupe « Legs Up the Wall » en deux et
        # celui entre « Easy » et « Happy Baby » ne ressort pas. Les cinq cases
        # sont régulières, on impose les coupes.
        ("Récupération", [[0.2, 0.4, 0.6, 0.8], 5]),
    ],
}

#: Identifiants dans l'ordre de lecture, alignés sur src/data/exercices.ts.
IDENTIFIANTS: dict[str, list[str]] = {
    "dumbbell-v2": [
        # Haut du corps
        "alternating-curl", "zottman-curl", "seated-incline-curl", "no-money-curl",
        "curl-to-overhead-press",
        "chest-squeeze-press", "dumbbell-push-up", "l-raise",
        "single-arm-tricep-extension", "single-arm-lateral-raise",
        "skull-crusher", "arnold-press", "shovel-curl-press",
        # Gainage
        "ab-roll-out", "hanging-leg-raise", "hollow-body-sweeper", "hollow-fly",
        "hollow-pullover",
        # Dos
        "bent-over-row", "bird-dog-row", "single-arm-upright-row", "tripod-row",
        "upright-row",
        # Bas du corps
        "bulgarian-lunge", "elevated-reverse-lunge", "curtsy-lunge", "donkey-kick",
        "cossack-squat",
        "fire-hydrant", "frog-pump", "hamstring-curl", "leg-extension",
        "single-leg-deadlift-db",
        # Corps entier
        "dumbbell-burpee", "high-pull", "side-lunge-thruster", "dumbbell-snatch",
    ],
    "dumbbell-v1": [
        "hammer-curl", "grip-curl", "concentration-curl", "tricep-kickback", "tricep-extension",
        "alternating-front-raise", "side-raise", "shoulder-press", "shoulder-shrug", "wrist-curl",
        "dumbbell-pullover", "bench-press", "incline-bench-press", "chest-fly", "reverse-fly",
        "side-bend", "bow-extension", "russian-twist", "v-up", "v-sit-cross-jab",
        "single-arm-row", "incline-row", "floor-t-raise", "renegade-row", "seesaw-row",
        "squat", "goblet-squat", "sumo-squat", "jump-squat", "romanian-deadlift",
        "glute-bridge", "reverse-lunge", "side-lunge", "step-up", "calf-raise",
        "plank-t", "swing", "farmers-walk", "thruster", "woodchop",
    ],
    "stretching": [
        # Nuque
        "etir-nuque-inclinaison", "etir-nuque-flexion", "etir-nuque-oblique",
        "etir-nuque-trapeze",
        # Épaules et bras (premier panneau)
        "etir-trapeze-assis", "etir-epaule-rotation-interne", "etir-epaules-croisees",
        "etir-epaule-posterieure",
        # Épaules et bras (second panneau)
        "etir-triceps-nuque", "etir-epaule-serviette", "etir-avant-bras-flechisseurs",
        "etir-poignets-quatre-pattes", "etir-poignet-extenseurs",
        # Poitrine
        "etir-pectoraux-mains-nuque", "etir-pectoral-montant", "etir-pectoraux-mains-dos",
        # Dos
        "etir-haut-dos-bras-devant", "etir-dos-assis-plantes-jointes",
        "etir-dos-rond-quatre-pattes", "etir-bascule-dos", "etir-rachis-debout",
        # Hanches
        "etir-fente-laterale", "etir-hanche-accroupie", "etir-ecart-coudes-genoux",
        "etir-hanche-sol-jambe-tendue", "etir-genou-en-travers", "etir-fessier-chiffre-4",
        "etir-ecart-allonge", "etir-ecart-assis-lateral",
        # Tronc (colonne de gauche)
        "etir-grandissement-bras-leves", "etir-inclinaison-tronc",
        "etir-torsion-allongee", "etir-torsion-jambe-croisee",
        # Tronc (colonne de droite)
        "etir-torsion-assise", "etir-fente-bras-leve",
        # Abdominaux
        "etir-dos-creux-quatre-pattes", "etir-abdos-debout", "etir-cobra-sol",
        # Quadriceps
        "etir-quadriceps-cote", "etir-quadriceps-debout", "etir-quadriceps-ventre",
        # Ischio-jambiers
        "etir-ischios-debout", "etir-ischios-allonge", "etir-ischios-jambes-croisees",
        "etir-ischios-assis",
        # Mollets et chevilles
        "etir-mollet-marche", "etir-mollet-mur", "etir-soleaire-genou-flechi",
        "etir-tibia-cou-de-pied",
        # Corps entier
        "etir-corps-debout", "etir-allongement-sol", "etir-suspension-barre",
    ],
    "yoga": [
        # Échauffement
        "yoga-chat", "yoga-vache", "yoga-coeur-fondant", "yoga-enfant",
        "yoga-flexion-avant-debout",
        # Étirements
        "yoga-pyramide", "yoga-chien-tete-en-bas", "yoga-guirlande", "yoga-pince-assise",
        "yoga-angle-lie",
        "yoga-tete-au-genou", "yoga-demi-seigneur-poissons", "yoga-heros",
        "yoga-grand-angle-assis",
        # Équilibre
        "yoga-arbre", "yoga-seigneur-danse", "yoga-aigle", "yoga-grand-ecart-debout",
        "yoga-demi-lune",
        "yoga-guerrier-3", "yoga-equilibre-mains", "yoga-corbeau",
        "yoga-main-gros-orteil", "yoga-shiva-dansant",
        # Force
        "yoga-guerrier-1", "yoga-guerrier-2", "yoga-deesse", "yoga-guerrier-humble",
        "yoga-baton-quatre-appuis",
        "yoga-planche-inversee", "yoga-chaise", "yoga-dauphin", "yoga-triangle",
        "yoga-fente-haute",
        # Gainage
        "yoga-planche", "yoga-planche-laterale", "yoga-bateau", "yoga-chien-une-jambe",
        "yoga-balance",
        # Extensions
        "yoga-cobra", "yoga-chien-tete-en-haut", "yoga-sauterelle", "yoga-arc",
        "yoga-chameau", "yoga-heros-couche", "yoga-pigeon-royal", "yoga-arc-ascendant",
        # Récupération
        "yoga-jambes-au-mur", "yoga-chandelle", "yoga-charrue", "yoga-aisee",
        "yoga-bebe-heureux",
        "yoga-angle-lie-couche", "yoga-main-gros-orteil-couche", "yoga-torsion-couchee",
        "yoga-demi-pigeon", "yoga-cadavre",
    ],
}

#: Certains posters ne sont pas une pile de bandeaux pleine largeur : les
#: sections y sont disposées en colonnes, côte à côte, de hauteurs inégales.
#: Impossible de les déduire d'un balayage par rangées — on décrit alors chaque
#: panneau par sa boîte, en fraction de l'image, mesurée une fois sur les
#: bandeaux de couleur détectés. Un panneau se découpe ensuite comme une
#: section ordinaire.
Panneau = tuple[str, tuple[float, float, float, float], list[Rangee]]
PANNEAUX: dict[str, list[Panneau]] = {
    "stretching": [
        ("Nuque", (0.0483, 0.4977, 0.1250, 0.2185), [4]),
        ("Épaules et bras", (0.5040, 0.9617, 0.1250, 0.2185), [4]),
        # Dernière case : les deux dessins d'avant-bras comptent pour une.
        ("Épaules et bras", (0.0493, 0.6133, 0.2418, 0.3343),
         [[0.167, 0.337, 0.570, 0.767]]),
        ("Poitrine", (0.6193, 0.9643, 0.2418, 0.3343), [3]),
        # Quatrième case : la séquence de bascule sur le dos, en trois dessins.
        ("Dos", (0.0523, 0.9640, 0.3558, 0.4490),
         [[0.152, 0.369, 0.537, 0.859]]),
        ("Hanches", (0.0543, 0.5030, 0.4690, 0.7573), [3, 3, 2]),
        # Le tronc est sur deux colonnes de deux cases plus une colonne à part,
        # dont la coupe horizontale est plus haute : deux panneaux distincts.
        ("Tronc", (0.5087, 0.8077, 0.4690, 0.6388), [2, 2]),
        ("Tronc", (0.8077, 0.9647, 0.4690, 0.6388), [1, 1]),
        ("Abdominaux", (0.5110, 0.9710, 0.6558, 0.7573), [3]),
        ("Quadriceps", (0.0530, 0.4963, 0.7748, 0.8725), [3]),
        ("Ischio-jambiers", (0.5027, 0.9793, 0.7748, 0.8725), [4]),
        ("Mollets et chevilles", (0.0557, 0.6037, 0.8910, 0.9865), [4]),
        ("Corps entier", (0.6093, 0.9797, 0.8910, 0.9865), [3]),
    ],
}

#: Posters dont les cases ne portent aucun libellé imprimé : rien à retirer
#: sous le dessin.
SANS_LIBELLE = {"stretching"}

#: Posters sans trait de grille imprimé : les cases ne sont séparées que par du
#: blanc. On y repère les gouttières — les colonnes sans une goutte d'encre —
#: plutôt que des traits gris qui n'existent pas.
SANS_GRILLE = {"stretching"}

#: Largeur des vignettes produites. Les 40 premières font 199 px ; on monte à
#: 320 px, ce que la photo permet sans interpoler.
LARGEUR_VIGNETTE = 320


# ------------------------------------------------------------- Prétraitement

def aplanir(img: Image.Image, rayon: int = 120) -> Image.Image:
    """Corrige l'illumination en divisant par une version très floue. Supprime
    le dégradé de lumière, la dominante chaude du plastifié et la vignette de
    l'objectif ; le fond blanc cassé redevient blanc franc."""
    a = np.asarray(img, dtype=np.float32)
    fond = np.asarray(img.filter(ImageFilter.GaussianBlur(rayon)), dtype=np.float32)
    plat = np.clip(a / np.maximum(fond, 1.0) * 235.0, 0, 255)
    return Image.fromarray(plat.astype(np.uint8))


# ------------------------------------------------------------- Bandeaux

def bandeaux(img: Image.Image) -> list[tuple[int, int, int, int]]:
    """Bandeaux de section (y0, y1, x0, x1), du haut vers le bas. Un bandeau est
    sombre et franchement coloré — bleu ou vert selon la série de posters."""
    a = np.asarray(img, dtype=np.int16)
    hauteur, largeur, _ = a.shape
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    colore = ((b - r) > 30) | (((g - r) > 20) & ((g - b) > 12))
    masque = colore & (r < 150)

    trouves: list[tuple[int, int, int, int]] = []
    frac = masque.mean(axis=1)
    debut = None
    for y in range(hauteur):
        dedans = frac[y] > 0.30
        if dedans and debut is None:
            debut = y
        elif not dedans and debut is not None:
            if y - debut >= 25:
                trouves.append((debut, y - 1))
            debut = None
    if debut is not None and hauteur - debut >= 25:
        trouves.append((debut, hauteur - 1))

    avec_bornes = []
    for y0, y1 in trouves:
        colonnes = np.where(masque[y0 : y1 + 1].mean(axis=0) > 0.5)[0]
        if len(colonnes) < largeur * 0.5:
            continue
        avec_bornes.append((y0, y1, int(colonnes[0]), int(colonnes[-1])))
    return avec_bornes


def bandeaux_de_section(
    tous: list[tuple[int, int, int, int]], attendus: int, largeur: int
):
    """Garde les barres de section. Le titre et le pied de page touchent les
    bords du cadre ; les barres de section, elles, restent en retrait dans la
    marge grise du poster. C'est ce retrait qui les distingue — leur hauteur,
    non : le titre d'un poster peut être aussi fin qu'une barre."""
    marge = max(4, largeur // 300)
    barres = [b for b in tous if b[2] > marge and b[3] < largeur - 1 - marge]
    if len(barres) != attendus:
        details = " ; ".join(f"y={y0}..{y1} x={x0}..{x1}" for y0, y1, x0, x1 in tous)
        sys.exit(
            f"{len(barres)} bandeaux de section repérés, {attendus} attendus.\n"
            f"Bandeaux vus : {details}"
        )
    return barres


# ------------------------------------------------------------- Traits de grille

def traits(bloc: np.ndarray, axe: int, part: float = 0.60, epaisseur: int = 6) -> list[int]:
    """Positions des traits de grille dans un bloc en niveaux de gris.

    axe 0 : cherche des traits verticaux (colonnes) ; axe 1 : horizontaux.
    Un trait est gris sur la plus grande partie de sa traversée. Un dessin
    comporte du noir, le fond est blanc partout : ni l'un ni l'autre ne passe.
    On ne monte pas le seuil plus haut : sur une photo, le trait s'interrompt
    là où un dessin déborde ou là où la plastification renvoie la lumière.

    Les positions collées aux bords sont écartées : ce sont les traits de
    contour du bloc lui-même, pas des séparateurs internes."""
    v = bloc if axe == 0 else bloc.T
    if v.size == 0:
        return []
    gris = (v > 120) & (v < 246)
    est = gris.mean(axis=0) >= part
    longueur = len(est)
    marge = max(8, int(longueur * 0.04))
    out: list[int] = []
    debut = None
    for i, ok in enumerate(est):
        if ok and debut is None:
            debut = i
        elif not ok and debut is not None:
            if i - debut >= epaisseur:
                out.append((debut + i - 1) // 2)
            debut = None
    if debut is not None and longueur - debut >= epaisseur:
        out.append((debut + longueur - 1) // 2)
    return [x for x in out if marge <= x <= longueur - 1 - marge]


def gouttieres(bloc: np.ndarray, nombre: int, marge: float = 0.05) -> list[int]:
    """Les `nombre - 1` gouttières les plus larges d'un bloc : les colonnes où
    ne passe aucun trait d'encre. C'est ce qui sépare les cases d'un poster qui
    n'imprime pas de grille ; les dessins n'y étant pas régulièrement espacés,
    un découpage en parts égales tomberait au milieu des silhouettes."""
    if nombre < 2:
        return []
    vides = (bloc < 200).sum(0) <= max(1, bloc.shape[0] // 60)
    plages, debut = [], None
    for x, vide in enumerate(vides):
        if vide and debut is None:
            debut = x
        elif not vide and debut is not None:
            plages.append((debut, x - 1))
            debut = None
    if debut is not None:
        plages.append((debut, len(vides) - 1))
    # Une gouttière collée au bord est la marge du panneau, pas une séparation.
    bord = marge * bloc.shape[1]
    plages = [p for p in plages if p[0] > bord and p[1] < bloc.shape[1] - 1 - bord]
    plages.sort(key=lambda p: p[1] - p[0], reverse=True)
    return sorted((p[0] + p[1]) // 2 for p in plages[: nombre - 1])


def resserrer(
    gris: np.ndarray, x0: int, x1: int, y0: int, y1: int, part: float = 0.90
) -> tuple[int, int, int, int]:
    """Rétrécit une boîte de panneau tant qu'un de ses bords n'est pas
    majoritairement blanc. Retire le bandeau de couleur qui déborde, le liseré
    du poster et la table sur laquelle la photo a été prise — sans quoi il ne
    reste plus une seule colonne sans encre où couper."""
    blanc = gris > 205
    while y1 - y0 > 40 and blanc[y0, x0:x1].mean() < part:
        y0 += 1
    while y1 - y0 > 40 and blanc[y1 - 1, x0:x1].mean() < part:
        y1 -= 1
    while x1 - x0 > 40 and blanc[y0:y1, x0].mean() < part:
        x0 += 1
    while x1 - x0 > 40 and blanc[y0:y1, x1 - 1].mean() < part:
        x1 -= 1
    return x0, x1, y0, y1


def decouper(debut: int, fin: int, rangee: Rangee, detectes: list[int]) -> list[tuple[int, int]]:
    """Bornes des cellules entre `debut` et `fin`.

    Des coupes déclarées en fractions font foi. Sinon on utilise les traits
    détectés quand leur compte tombe juste, et un découpage régulier à défaut."""
    if isinstance(rangee, list):
        bornes = [debut] + [int(round(debut + f * (fin - debut))) for f in rangee] + [fin]
    elif len(detectes) == rangee - 1:
        bornes = [debut] + sorted(detectes) + [fin]
    else:
        pas = (fin - debut) / rangee
        bornes = [int(round(debut + i * pas)) for i in range(rangee + 1)]
    return [(bornes[i], bornes[i + 1]) for i in range(len(bornes) - 1)]


def nb_cellules(rangee: Rangee) -> int:
    return len(rangee) + 1 if isinstance(rangee, list) else rangee


# ------------------------------------------------------------- Nettoyage

def retirer_libelle(cellule: Image.Image) -> Image.Image:
    """Coupe le libellé imprimé sous le dessin.

    Le libellé tient sur une ligne (« Hammer Curl ») ou sur deux, le nom
    anglais puis le nom sanskrit sur le poster de yoga — et un seuil fixe de
    blanc ne sait pas distinguer l'interligne de la séparation. On cherche
    donc, dans le bas de la case, la plus large bande blanche qui ne touche
    pas le bord : c'est la respiration entre le dessin et son libellé, plus
    large que n'importe quel interligne. On coupe en son milieu."""
    g = np.asarray(cellule.convert("L"), dtype=float)
    hauteur, largeur = g.shape
    encre = (g < 110).mean(axis=1)
    depart = int(0.40 * hauteur)

    plages, debut = [], None
    for y in range(depart, hauteur):
        if encre[y] < 0.004:
            if debut is None:
                debut = y
        elif debut is not None:
            plages.append((debut, y - 1))
            debut = None
    # Une bande blanche qui touche le bas est la marge de la case, pas une
    # séparation : il n'y a rien à couper en dessous.
    plages = [p for p in plages if p[1] < hauteur - 1]
    if not plages:
        return cellule

    a, b = max(plages, key=lambda p: p[1] - p[0])
    coupe = (a + b) // 2
    if not (0.45 * hauteur <= coupe <= 0.97 * hauteur):
        return cellule
    return cellule.crop((0, 0, largeur, coupe))


def rogner_blanc(cellule: Image.Image, marge: int = 6) -> Image.Image:
    """Resserre sur le dessin en retirant le blanc autour."""
    g = np.asarray(cellule.convert("L"), dtype=float)
    encre = g < 200
    lignes = np.where(encre.any(axis=1))[0]
    colonnes = np.where(encre.any(axis=0))[0]
    if len(lignes) == 0 or len(colonnes) == 0:
        return cellule
    h, w = g.shape
    return cellule.crop((
        max(0, int(colonnes[0]) - marge), max(0, int(lignes[0]) - marge),
        min(w, int(colonnes[-1]) + marge + 1), min(h, int(lignes[-1]) + marge + 1),
    ))


# ------------------------------------------------------------- Programme

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("photo", type=Path)
    p.add_argument("disposition", choices=sorted(set(DISPOSITIONS) | set(PANNEAUX)))
    p.add_argument("--sortie", type=Path, default=Path("public/exercices"))
    p.add_argument("--planche", type=Path, help="planche de contrôle")
    p.add_argument("--garder-libelle", action="store_true",
                   help="conserve le libellé imprimé : sert à vérifier les identifiants")
    p.add_argument("--debug", action="store_true")
    args = p.parse_args()

    brute = ImageOps.exif_transpose(Image.open(args.photo)).convert("RGB")
    img = aplanir(brute)
    gris = np.asarray(img.convert("L"), dtype=float)

    identifiants = IDENTIFIANTS[args.disposition]
    en_panneaux = args.disposition in PANNEAUX
    sections: list[tuple[str, list[Rangee]]] = (
        [(nom, rangees) for nom, _, rangees in PANNEAUX[args.disposition]]
        if en_panneaux
        else DISPOSITIONS[args.disposition]
    )
    attendu = sum(nb_cellules(r) for _, rangees in sections for r in rangees)
    if len(identifiants) != attendu:
        sys.exit(f"{len(identifiants)} identifiants pour {attendu} cellules annoncées.")

    # Boîte de chaque section : (nom, rangées, x_gauche, x_droite, haut, bas).
    boites: list[tuple[str, list[Rangee], int, int, int, int]] = []
    if en_panneaux:
        largeur, hauteur = img.size
        for nom, (fx0, fx1, fy0, fy1), rangees in PANNEAUX[args.disposition]:
            x0, x1, y0, y1 = resserrer(
                gris,
                round(fx0 * largeur) + 8, round(fx1 * largeur) - 8,
                round(fy0 * hauteur), round(fy1 * hauteur),
            )
            boites.append((nom, rangees, x0, x1, y0, y1))
    else:
        tous = bandeaux(img)
        barres = bandeaux_de_section(tous, len(sections), img.size[0])
        # Bas de la dernière section : le pied de page, s'il a été repéré. Sans
        # cette borne, la dernière rangée mord sur le bandeau du bas et les
        # traits de grille deviennent indétectables.
        apres_derniere = [b for b in tous if b[0] > barres[-1][1] + 20]
        bas_dernier = apres_derniere[0][0] - 10 if apres_derniere else img.size[1]
        if args.debug:
            for y0, y1, x0, x1 in tous:
                print(f"  bandeau y={y0}..{y1} (h={y1-y0+1}) x={x0}..{x1}")
        for i, (nom, rangees) in enumerate(sections):
            y0, y1, gx0, gx1 = barres[i]
            bas = (barres[i + 1][0] - 10) if i + 1 < len(barres) else bas_dernier
            # Bord du poster interpolé : le bandeau de la section, et le suivant.
            sx0, sx1 = (barres[i + 1][2], barres[i + 1][3]) if i + 1 < len(barres) else (gx0, gx1)
            boites.append((nom, rangees, max(gx0, sx0) + 8, min(gx1, sx1) - 8, y1 + 10, bas))

    args.sortie.mkdir(parents=True, exist_ok=True)
    vignettes: list[tuple[str, Image.Image]] = []
    index = 0

    for nom_section, rangees, x_gauche, x_droite, haut, bas in boites:
        lignes = [haut + t for t in traits(gris[haut:bas, x_gauche:x_droite], 1)]
        bornes_y = decouper(haut, bas, len(rangees), lignes)

        for (ra, rb), rangee in zip(bornes_y, rangees):
            ra, rb = ra + 6, rb - 6
            bloc = gris[ra:rb, x_gauche:x_droite]
            cols = [
                x_gauche + t
                for t in (
                    gouttieres(bloc, nb_cellules(rangee))
                    if args.disposition in SANS_GRILLE
                    else traits(bloc, 0)
                )
            ]
            for (ca, cb) in decouper(x_gauche, x_droite, rangee, cols):
                if cb - ca < 40 or rb - ra < 40:
                    sys.exit(f"Cellule dégénérée en {nom_section} : x={ca}..{cb}, y={ra}..{rb}")
                cellule = img.crop((ca + 6, ra + 4, cb - 6, rb - 2))
                if not args.garder_libelle and args.disposition not in SANS_LIBELLE:
                    cellule = retirer_libelle(cellule)
                cellule = rogner_blanc(cellule)
                echelle = LARGEUR_VIGNETTE / cellule.width
                cellule = cellule.resize(
                    (LARGEUR_VIGNETTE, max(1, int(round(cellule.height * echelle)))), Image.LANCZOS
                )
                cellule = cellule.filter(ImageFilter.UnsharpMask(radius=1.6, percent=90, threshold=3))
                nom = identifiants[index]
                cellule.save(args.sortie / f"{nom}.png")
                vignettes.append((nom, cellule))
                index += 1
            if args.debug:
                print(f"  {nom_section}: rangée y={ra}..{rb} -> {nb_cellules(rangee)} cellules, {len(cols)} traits détectés")

    print(f"{index} vignettes écrites dans {args.sortie}")

    if args.planche:
        colonnes = 5
        larg = LARGEUR_VIGNETTE + 10
        haut_case = max(v.height for _, v in vignettes) + 34
        rangs = (len(vignettes) + colonnes - 1) // colonnes
        planche = Image.new("RGB", (colonnes * larg, rangs * haut_case), "white")
        d = ImageDraw.Draw(planche)
        for k, (nom, v) in enumerate(vignettes):
            cx, cy = (k % colonnes) * larg, (k // colonnes) * haut_case
            planche.paste(v, (cx + 5, cy + 5))
            d.text((cx + 5, cy + haut_case - 24), nom[:38], fill="black")
        planche.save(args.planche)
        print(f"planche de contrôle : {args.planche}")


if __name__ == "__main__":
    main()
