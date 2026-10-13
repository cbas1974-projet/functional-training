// 👎 « Pas aimé » : un petit bouton discret dans la carte de l'exercice, à
// côté de « J'ai mal », un par personne (`BoutonPasAime`) ; et la fois
// suivante, sur l'accueil, un bandeau qui propose de le changer
// (`BandeauPasAime`). Facultatif : rien n'est bloqué, aucun toucher n'est
// demandé. Habillage : les jetons de couleur de `index.css`.

interface BoutonPasAimeProps {
  actif: boolean;
  /** Celui qui ne l'a pas aimé : pour le lecteur d'écran. */
  nom: string;
  onBasculer: () => void;
}

/** 👎, d'un toucher : pas aimé, ou de nouveau rien. */
export function BoutonPasAime({ actif, nom, onBasculer }: BoutonPasAimeProps) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={`${nom} : pas aimé cet exercice`}
      title="Pas aimé"
      onClick={onBasculer}
      className="flex shrink-0 touch-manipulation items-center justify-center rounded-lg text-base"
      style={{
        minHeight: 36,
        minWidth: 36,
        background: actif ? 'var(--surface)' : 'transparent',
        border: `1px solid ${actif ? 'var(--pause)' : 'var(--bordure)'}`,
        // Discret tant qu'il n'est pas dit.
        opacity: actif ? 1 : 0.5,
      }}
    >
      <span aria-hidden="true">👎</span>
    </button>
  );
}

interface BandeauPasAimeProps {
  /** Les noms de ceux qui ne l'ont pas aimé ; vide : la personne du
   *  téléphone, sans nom connu. */
  noms: string[];
  /** Ouvre « Changer » pour cet exercice. */
  onChanger: () => void;
  /** Le garder quand même : le 👎 s'en va. */
  onGarder: () => void;
}

/** « Pas aimé par Big Max · Changer ? » : la fois suivante où l'exercice
 *  revient. */
export function BandeauPasAime({ noms, onChanger, onGarder }: BandeauPasAimeProps) {
  const qui = noms.length > 0 ? ` par ${noms.join(' et ')}` : '';
  return (
    <div
      role="note"
      className="mt-2 flex flex-wrap items-center gap-x-2 rounded-xl px-2 py-1 text-sm"
      style={{ border: '1px solid var(--pause)', background: 'var(--surface)' }}
    >
      <span className="min-w-[9rem] flex-1 font-semibold" style={{ color: 'var(--texte)' }}>
        <span aria-hidden="true">👎 </span>Pas aimé{qui}
      </span>
      <button
        type="button"
        onClick={onChanger}
        className="shrink-0 rounded-lg px-2 text-sm font-bold"
        style={{ minHeight: 36, background: 'transparent', color: 'var(--accent)' }}
      >
        Changer ?
      </button>
      <button
        type="button"
        onClick={onGarder}
        aria-label="Le garder quand même"
        className="shrink-0 rounded-lg px-2 text-xs font-semibold"
        style={{ minHeight: 36, background: 'transparent', color: 'var(--texte-discret)' }}
      >
        Garder
      </button>
    </div>
  );
}
