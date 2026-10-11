// « J'ai mal à cet exercice » : un interrupteur, sur l'accueil (la fiche de
// l'exercice) comme dans la séance (sous les consignes). Allumé, il rappelle
// ce qu'il fait : charges à 70 %, pas de montée. Habillage : les jetons de
// couleur de `index.css`.

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

/** Le petit repère d'un exercice où l'on a mal. */
export function ReperDouleur({ avecCharge = true, className = '' }: { avecCharge?: boolean; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 text-[11px] font-bold ${className}`}
      style={{ background: 'var(--alerte)', color: 'var(--fond)' }}
    >
      {avecCharge ? 'Douleur · 70 %' : 'Douleur'}
    </span>
  );
}
