// La routine du soir vue de l'accueil : une carte discrète, d'un appui — sa
// durée, ce qu'elle contient, et les sept derniers soirs en points. Le reste
// (la liste, « Commencer ») est sur son propre écran.
import type { Personne, RoutineSoirLocale } from '../types';
import {
  derniersSoirs,
  libelleDureeRoutine,
  libelleSoirsSurSept,
  partiesDe,
  resumeRoutine,
  serieDeSoirs,
  soirDe,
  soirFait,
} from '../utils/routineSoir';

const CARTE = {
  background: 'var(--surface)',
  border: '1px solid var(--bordure)',
  borderRadius: 16,
} as const;

/** Les sept derniers soirs en points : plein quand la routine a été faite, vide
 *  sinon, cerclé d'accent pour ce soir. Chaque point porte l'initiale du jour.
 *  Avec `onBasculerSoir`, chaque point devient un bouton : un appui marque (ou
 *  démarque) ce soir-là, pour rattraper une routine faite sans l'avoir cochée. */
export function PointsSemaine({
  routine,
  maintenant,
  onBasculerSoir,
}: {
  routine: RoutineSoirLocale | undefined;
  maintenant: Date;
  onBasculerSoir?: (soir: string, faite: boolean) => void;
}) {
  const jours = derniersSoirs(routine, maintenant);
  const faits = jours.filter((jour) => jour.faite).length;
  const point = (jour: (typeof jours)[number]) => (
    <>
      <span
        className="block h-3.5 w-3.5 rounded-full"
        style={{
          background: jour.faite ? 'var(--montee)' : 'transparent',
          border: `2px solid ${jour.faite ? 'var(--montee)' : jour.ceSoir ? 'var(--accent)' : 'var(--bordure)'}`,
        }}
      />
      <span
        className="text-[10px] leading-none"
        style={{ color: jour.ceSoir ? 'var(--texte)' : 'var(--texte-discret)', fontWeight: jour.ceSoir ? 700 : 500 }}
      >
        {jour.initiale}
      </span>
    </>
  );
  if (onBasculerSoir) {
    return (
      <div role="group" aria-label={`Les 7 derniers soirs : ${libelleSoirsSurSept(faits)}`} className="flex gap-0.5">
        {jours.map((jour) => (
          <button
            key={jour.soir}
            type="button"
            aria-pressed={jour.faite}
            aria-label={`${jour.soir}${jour.ceSoir ? ' (ce soir)' : ''} : ${jour.faite ? 'faite, appuyer pour retirer' : 'pas faite, appuyer pour marquer'}`}
            onClick={() => onBasculerSoir(jour.soir, jour.faite)}
            className="flex h-11 min-w-10 flex-col items-center justify-center gap-0.5"
          >
            {point(jour)}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="img" aria-label={`Les 7 derniers soirs : ${libelleSoirsSurSept(faits)}`} className="flex gap-1.5">
      {jours.map((jour) => (
        <span key={jour.soir} className="flex flex-col items-center gap-0.5" aria-hidden="true">
          {point(jour)}
        </span>
      ))}
    </div>
  );
}

/** « 5 soirs sur 7 », et la série en cours quand elle compte au moins deux soirs. */
export function BilanSoirs({ routine, maintenant }: { routine: RoutineSoirLocale | undefined; maintenant: Date }) {
  const faits = derniersSoirs(routine, maintenant).filter((jour) => jour.faite).length;
  const serie = serieDeSoirs(routine, maintenant);
  return (
    <span className="chiffres">
      {libelleSoirsSurSept(faits)}
      {serie >= 2 ? ` · ${serie} d’affilée` : ''}
    </span>
  );
}

export default function CarteRoutineSoir({
  personne,
  routine,
  maintenant,
  onOuvrir,
}: {
  personne: Personne;
  routine: RoutineSoirLocale | undefined;
  maintenant: Date;
  onOuvrir: () => void;
}) {
  const parties = partiesDe(personne, routine);
  const faiteCeSoir = soirFait(routine, soirDe(maintenant));
  return (
    <button type="button" onClick={onOuvrir} className="block w-full p-3 text-left" style={CARTE}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-bold" style={{ color: 'var(--texte)' }}>
          Routine du soir · {libelleDureeRoutine(parties)}
        </span>
        <span aria-hidden="true" className="text-xl leading-none" style={{ color: 'var(--texte-discret)' }}>
          ›
        </span>
      </span>
      <span className="block text-xs" style={{ color: faiteCeSoir ? 'var(--montee)' : 'var(--texte-discret)' }}>
        {faiteCeSoir ? 'Faite ce soir ✓' : `${resumeRoutine(parties)}, tous les soirs`}
      </span>
      <span className="mt-2 flex items-center justify-between gap-3">
        <PointsSemaine routine={routine} maintenant={maintenant} />
        <span className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          <BilanSoirs routine={routine} maintenant={maintenant} />
        </span>
      </span>
    </button>
  );
}
