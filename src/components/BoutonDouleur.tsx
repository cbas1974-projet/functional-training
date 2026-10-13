// « J'ai mal à cet exercice » : un interrupteur, sur l'accueil (la fiche de
// l'exercice) comme dans la séance (sous les consignes). Allumé, il rappelle
// ce qu'il fait : charges à 70 %, pas de montée. Sur un seul téléphone, à
// deux, un petit interrupteur par personne (`BoutonDouleurCompact`) : la
// douleur de l'un ne touche pas l'autre. Habillage : les jetons de couleur de
// `index.css`.

interface BoutonDouleurProps {
  actif: boolean;
  /** L'exercice se fait avec une charge ; sans (au poids du corps), la
   *  douleur n'est qu'un repère. */
  avecCharge?: boolean;
  onBasculer: () => void;
  /** Uniquement de la mise en page. */
  className?: string;
}

export default function BoutonDouleur({ actif, avecCharge = true, onBasculer, className = '' }: BoutonDouleurProps) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onBasculer}
      className={`flex w-full touch-manipulation items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${className}`}
      style={{
        minHeight: 44,
        background: actif ? 'var(--alerte)' : 'transparent',
        color: actif ? 'var(--fond)' : 'var(--texte-discret)',
        border: `1px solid ${actif ? 'var(--alerte)' : 'var(--bordure)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold"
        style={{ border: `2px solid ${actif ? 'var(--fond)' : 'var(--texte-discret)'}` }}
      >
        {actif ? '✓' : ''}
      </span>
      <span>
        J’ai mal à cet exercice
        {actif && (
          <span className="block text-xs font-normal">
            {avecCharge ? 'Charges à 70 %, pas de montée.' : 'Noté : on y va doucement.'} Toucher pour enlever.
          </span>
        )}
      </span>
    </button>
  );
}

/** Le petit repère d'un exercice où l'on a mal ; à deux, avec le nom de
 *  celui qui a mal. */
export function ReperDouleur({
  avecCharge = true,
  nom,
  className = '',
}: {
  avecCharge?: boolean;
  nom?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 text-[11px] font-bold ${className}`}
      style={{ background: 'var(--alerte)', color: 'var(--fond)' }}
    >
      {nom ? `${nom} · ` : ''}
      {avecCharge ? 'Douleur · 70 %' : 'Douleur'}
    </span>
  );
}

interface BoutonDouleurCompactProps {
  actif: boolean;
  /** Sans charge (au poids du corps), la douleur n'est qu'un repère. */
  avecCharge?: boolean;
  /** Celui qui a mal : pour le lecteur d'écran, et à l'écran si `montrerNom`. */
  nom: string;
  /** Sur l'accueil, le nom s'écrit ; dans une colonne de la séance, l'en-tête
   *  le dit déjà. */
  montrerNom?: boolean;
  onBasculer: () => void;
}

/** « J'ai mal », en petit, pour une personne : un par colonne sur la liste de
 *  la séance, un par personne sur l'accueil. Allumé : « Douleur · 70 % »
 *  (charges à 70 %, pas de montée), jusqu'à ce qu'on l'éteigne — aux séances
 *  suivantes aussi, pour cette personne et cet exercice seulement. */
export function BoutonDouleurCompact({ actif, avecCharge = true, nom, montrerNom = false, onBasculer }: BoutonDouleurCompactProps) {
  const etat = actif ? (avecCharge ? 'Douleur · 70 %' : 'Douleur') : 'J’ai mal';
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={`${nom} : j’ai mal à cet exercice`}
      onClick={onBasculer}
      className="flex w-full min-w-0 touch-manipulation items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold"
      style={{
        minHeight: 36,
        background: actif ? 'var(--alerte)' : 'transparent',
        color: actif ? 'var(--fond)' : 'var(--texte-discret)',
        border: `1px solid ${actif ? 'var(--alerte)' : 'var(--bordure)'}`,
      }}
    >
      <span aria-hidden="true">{actif ? '✓' : '+'}</span>
      <span className="truncate">{montrerNom ? `${nom} · ${etat.charAt(0).toLowerCase()}${etat.slice(1)}` : etat}</span>
    </button>
  );
}
