// Un graphique en courbes, dessiné à la main en SVG : une ligne avec des points
// pour chaque série, de 3 à 5 lignes de repère aux valeurs rondes — avec leur
// unité —, des dates lisibles sous la courbe. Le dessin prend la largeur de sa
// boîte, au pixel près : les textes gardent leur taille sur tous les écrans, et
// rien ne défile de côté. Toucher un point (ou le survoler) en donne la valeur ;
// avec deux séries, la légende et les valeurs se lisent dans les mêmes lignes.
import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { PointCourbe } from '../utils/progression';
import {
  LARGEUR_CARACTERE_PX,
  echelleVerticale,
  formaterNombre,
  libelleJour,
  reperesDeDates,
} from '../utils/progression';

export interface SerieGraphique {
  /** Le nom dans la légende : celui de la personne. */
  nom: string;
  /** Le jeton de couleur de la ligne et des points : « var(--accent) ». */
  couleur: string;
  /** Du plus ancien au plus récent. */
  points: PointCourbe[];
}

interface GraphiqueProps {
  /** Ce que montre la courbe, pour qui ne la voit pas. */
  titre: string;
  series: SerieGraphique[];
  /** « lb » ou « kg » : écrit après chaque valeur. */
  unite: string;
  /** Au plus ce nombre de chiffres après la virgule dans les valeurs lues :
   *  une charge peut être de 17,5 lb, un poids de corps de 82,4 kg. */
  decimales?: number;
  /** Le fond de la boîte où le graphique est posé : c'est la couleur de
   *  l'anneau qui détache chaque point de la ligne. */
  fond?: string;
  /** Ce qu'on lit quand il n'y a rien à tracer. */
  vide: string;
}

const HAUTEUR = 220;
/** De quoi laisser un point tout en haut sans le couper. */
const MARGE_HAUT = 8;
/** La place des dates, sous la courbe. */
const MARGE_BAS = 34;
const MARGE_DROITE = 12;
/** Le vide entre les lignes de repère et les points des bords : un point au
 *  bord ne se coupe pas. */
const MARGE_INTERNE = 12;
/** Un point fait 8 px de large, détaché de la ligne par un anneau de 2 px ; celui
 *  qu'on a choisi, 12. Quand les points se serrent, ils rétrécissent et
 *  perdent l'anneau ; quand ils se touchent presque, la ligne les remplace :
 *  elle reste une ligne, pas une bande de perles. Le tout se juge à l'écart
 *  habituel entre deux points qui se suivent. */
const RAYON_CHOISI = 6;
const ECART_AERE_PX = 28;
const ECART_SERRE_PX = 14;
const ECART_TOUCHANT_PX = 6;
const TAILLE_TEXTE = 13;
const LARGEUR_PAR_DEFAUT = 300;

/** L'année ne s'écrit que si ce n'est pas celle d'aujourd'hui : « 30 sept. », mais « 30 sept. 2025 ». */
const anneeDifferente = (instant: number) => new Date(instant).getFullYear() !== new Date().getFullYear();

const FILET = { stroke: 'var(--texte-discret)', strokeOpacity: 0.3 } as const;
const TEXTE_DISCRET = { fill: 'var(--texte-discret)', fontSize: TAILLE_TEXTE } as const;

export default function Graphique({
  titre,
  series,
  unite,
  decimales = 1,
  fond = 'var(--surface-haute)',
  vide,
}: GraphiqueProps) {
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  /** Le point choisi de chaque série (par son rang) ; absent, c'est le dernier. */
  const [choisis, setChoisis] = useState<Record<number, number>>({});
  /** La série qu'on a touchée en dernier : celle que les flèches du clavier parcourent. */
  const [touchee, setTouchee] = useState(0);

  // La largeur de la boîte, mesurée avant l'affichage puis à chaque changement
  // (rotation du téléphone, fenêtre redimensionnée).
  useLayoutEffect(() => {
    const element = boite.current;
    if (!element) return;
    const mesurer = () => setLargeur(Math.floor(element.clientWidth));
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  /** La boîte est toujours là, même sans rien à tracer : c'est elle qu'on mesure. */
  const enveloppe = (contenu: ReactNode) => (
    <div ref={boite} className="w-full min-w-0">
      {contenu}
    </div>
  );

  const tous = series.flatMap((serie) => serie.points);
  if (tous.length === 0) {
    return enveloppe(
      <p className="py-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
        {vide}
      </p>,
    );
  }

  // ---------------------------------------------------------- La mise en page
  const t0 = Math.min(...tous.map((p) => p.t));
  const t1 = Math.max(...tous.map((p) => p.t));
  const echelle = echelleVerticale(tous.map((p) => p.valeur));
  const etiquettes = echelle.reperes.map((valeur) => `${formaterNombre(valeur, echelle.decimales)} ${unite}`);
  const margeGauche = Math.ceil(Math.max(...etiquettes.map((e) => e.length)) * LARGEUR_CARACTERE_PX) + 14;
  const largeurSvg = largeur > 0 ? largeur : LARGEUR_PAR_DEFAUT;
  const largeurCadre = Math.max(80, largeurSvg - margeGauche - MARGE_DROITE);
  const largeurUtile = largeurCadre - 2 * MARGE_INTERNE;
  const bas = HAUTEUR - MARGE_BAS;
  const x = (t: number) =>
    margeGauche + MARGE_INTERNE + (t1 > t0 ? ((t - t0) / (t1 - t0)) * largeurUtile : largeurUtile / 2);
  const y = (valeur: number) => MARGE_HAUT + (1 - (valeur - echelle.min) / (echelle.max - echelle.min)) * (bas - MARGE_HAUT);
  const dates = reperesDeDates(t0, t1, largeurUtile);
  // L'écart habituel — la médiane — entre deux points qui se suivent, dans une même
  // série : deux séances le même jour ne suffisent pas à tout serrer.
  const ecarts = series
    .flatMap((serie) => serie.points.slice(1).map((point, i) => x(point.t) - x(serie.points[i].t)))
    .sort((a, b) => a - b);
  const ecartHabituel = ecarts.length > 0 ? ecarts[Math.floor(ecarts.length / 2)] : Infinity;
  const aere = ecartHabituel >= ECART_AERE_PX;
  const rayon = aere ? 4 : ecartHabituel >= ECART_SERRE_PX ? 3.5 : 2.5;
  const anneau = aere ? 4 : 0;
  const avecPoints = ecartHabituel >= ECART_TOUCHANT_PX;

  // ---------------------------------------------------------- Le point choisi
  const rangChoisi = (i: number) => Math.min(choisis[i] ?? series[i].points.length - 1, series[i].points.length - 1);
  const pointChoisi = (i: number): PointCourbe | undefined => series[i].points[rangChoisi(i)];
  const choisir = (serie: number, rang: number) => {
    setChoisis((avant) => ({ ...avant, [serie]: rang }));
    setTouchee(serie);
  };
  const ecrire = (valeur: number) => `${formaterNombre(valeur, decimales)} ${unite}`;
  /** Une série retirée (la courbe de l'autre décochée) ne laisse pas un rang dans le vide. */
  const serieTouchee = Math.min(touchee, series.length - 1);

  /** Le point le plus proche du doigt ou de la souris, toutes séries confondues. */
  const choisirPres = (evenement: PointerEvent<SVGRectElement>) => {
    const svg = evenement.currentTarget.ownerSVGElement;
    if (!svg) return;
    const cadre = svg.getBoundingClientRect();
    const px = evenement.clientX - cadre.left;
    const py = evenement.clientY - cadre.top;
    let meilleur: { serie: number; rang: number } | null = null;
    let distance = Infinity;
    for (let i = 0; i < series.length; i += 1) {
      for (let rang = 0; rang < series[i].points.length; rang += 1) {
        const point = series[i].points[rang];
        const ecart = (x(point.t) - px) ** 2 + (y(point.valeur) - py) ** 2;
        if (ecart < distance) {
          distance = ecart;
          meilleur = { serie: i, rang };
        }
      }
    }
    if (meilleur) choisir(meilleur.serie, meilleur.rang);
  };

  /** Les flèches du clavier : gauche et droite parcourent la série, haut et bas changent de série. */
  const surTouche = (evenement: KeyboardEvent<HTMLDivElement>) => {
    const { key } = evenement;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      evenement.preventDefault();
      setTouchee((serieTouchee + (key === 'ArrowDown' ? 1 : series.length - 1)) % series.length);
      return;
    }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    evenement.preventDefault();
    const nombre = series[serieTouchee].points.length;
    if (nombre === 0) return;
    choisir(serieTouchee, Math.max(0, Math.min(nombre - 1, rangChoisi(serieTouchee) + (key === 'ArrowRight' ? 1 : -1))));
  };

  const description = `${titre}. ${series
    .filter((serie) => serie.points.length > 0)
    .map((serie) => {
      const premier = serie.points[0];
      const dernier = serie.points[serie.points.length - 1];
      const pluriel = serie.points.length > 1 ? 's' : '';
      return `${serie.nom} : ${serie.points.length} point${pluriel}, de ${ecrire(premier.valeur)} le ${libelleJour(premier.t)} à ${ecrire(dernier.valeur)} le ${libelleJour(dernier.t)}.`;
    })
    .join(' ')}`;

  const pointTouche = pointChoisi(serieTouchee);

  return enveloppe(
    <>
      {/* La légende et les valeurs : une ligne par série. Seule, une série
          n'a pas besoin de légende — le titre dit ce qu'elle montre. */}
      <ul className="mb-2 space-y-1" aria-live="polite">
        {series.map((serie, i) => {
          const point = pointChoisi(i);
          return (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              {series.length > 1 && (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 self-center rounded-full"
                    style={{ background: serie.couleur }}
                  />
                  <span className="font-semibold" style={{ color: 'var(--texte)' }}>
                    {serie.nom}
                  </span>
                </>
              )}
              {point ? (
                <>
                  <span className="chiffres font-bold" style={{ color: 'var(--texte)' }}>
                    {ecrire(point.valeur)}
                  </span>
                  {/* Avec deux séries, la date passe sous le nom : les deux lignes se ressemblent. */}
                  <span className={series.length > 1 ? 'basis-full pl-5' : ''} style={{ color: 'var(--texte-discret)' }}>
                    {libelleJour(point.t, anneeDifferente(point.t))}
                    {point.note ? ` · ${point.note}` : ''}
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--texte-discret)' }}>rien à montrer pour l’instant</span>
              )}
            </li>
          );
        })}
      </ul>

      <div
        tabIndex={0}
        role="group"
        aria-label={`${titre} : les flèches du clavier parcourent les points`}
        onKeyDown={surTouche}
        className="rounded-lg"
        // Le doigt qui glisse de côté lit les points ; vers le haut ou le bas, il fait défiler la page.
        style={{ touchAction: 'pan-y' }}
      >
        <svg role="img" aria-label={description} width={largeurSvg} height={HAUTEUR} style={{ display: 'block', maxWidth: '100%' }}>
          {/* Les lignes de repère, avec leur valeur et leur unité ; la plus basse fait l'axe. */}
          {echelle.reperes.map((valeur, i) => (
            <g key={valeur}>
              <line
                x1={margeGauche}
                x2={margeGauche + largeurCadre}
                y1={y(valeur)}
                y2={y(valeur)}
                strokeWidth={1}
                shapeRendering="crispEdges"
                style={i === 0 ? { ...FILET, strokeOpacity: 0.6 } : FILET}
              />
              <text
                x={margeGauche - 8}
                y={y(valeur) + TAILLE_TEXTE * 0.35}
                textAnchor="end"
                className="chiffres"
                style={TEXTE_DISCRET}
              >
                {etiquettes[i]}
              </text>
            </g>
          ))}

          {/* Les dates, sous la courbe : centrées sous leur jour, sans sortir du dessin. */}
          {dates.map((repere) => {
            const demi = (repere.libelle.length * LARGEUR_CARACTERE_PX) / 2;
            const centre = Math.min(Math.max(x(repere.t), demi), largeurSvg - demi);
            return (
              <g key={repere.t}>
                <line
                  x1={x(repere.t)}
                  x2={x(repere.t)}
                  y1={bas}
                  y2={bas + 5}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                  style={{ ...FILET, strokeOpacity: 0.6 }}
                />
                <text x={centre} y={bas + 5 + TAILLE_TEXTE + 3} textAnchor="middle" className="chiffres" style={TEXTE_DISCRET}>
                  {repere.libelle}
                </text>
              </g>
            );
          })}

          {/* Le trait qui suit le point choisi. */}
          {pointTouche && (
            <line
              x1={x(pointTouche.t)}
              x2={x(pointTouche.t)}
              y1={MARGE_HAUT}
              y2={bas}
              strokeWidth={1}
              shapeRendering="crispEdges"
              style={{ ...FILET, strokeOpacity: 0.6 }}
            />
          )}

          {/* Une ligne de 2 px, ronde, avec ses points : un anneau de la couleur
              du fond (2 px) détache chaque point de la ligne qui le traverse. */}
          {series.map((serie, i) => (
            <g key={i}>
              {serie.points.length > 1 && (
                <polyline
                  points={serie.points.map((p) => `${x(p.t)},${y(p.valeur)}`).join(' ')}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ stroke: serie.couleur }}
                />
              )}
              {serie.points.map((p, rang) =>
                avecPoints || rang === rangChoisi(i) ? (
                  <circle
                    key={rang}
                    cx={x(p.t)}
                    cy={y(p.valeur)}
                    r={rang === rangChoisi(i) ? RAYON_CHOISI : rayon}
                    strokeWidth={rang === rangChoisi(i) ? 4 : anneau}
                    style={{ fill: serie.couleur, stroke: fond, paintOrder: 'stroke' }}
                  />
                ) : null,
              )}
            </g>
          ))}

          {/* Toute la surface répond au doigt ou à la souris. */}
          <rect
            x={margeGauche}
            y={0}
            width={largeurCadre}
            height={bas + 1}
            fill="transparent"
            onPointerDown={choisirPres}
            onPointerMove={choisirPres}
          />
        </svg>
      </div>
    </>,
  );
}
