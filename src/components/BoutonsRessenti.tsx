// Le ressenti, dans la séance guidée : sur la dernière série d'un exercice,
// trois gros visages — 😊 facile (« léger »), 😐 correct, ☹️ difficile
// (« lourd ») — à la place des mots Lourd, Correct, Léger (décision de
// Sébastien, 13 octobre 2026). Un seul toucher, facultatif ; on peut en
// toucher un autre plus tard pour changer. Habillage : les jetons de couleur
// de `index.css`, comme le reste de la séance.
import type { Ressenti } from '../types';
import { AIDE_RESSENTI, EMOJI_RESSENTI, LEGENDE_VISAGES, ORDRE_EMOJIS, SENS_EMOJI } from '../utils/ressenti';

export interface ExerciceARessentir {
  id: string;
  nom: string;
}

interface VisagesRessentiProps {
  /** Ce qui a déjà été dit ; absent, rien. */
  choisi: Ressenti | undefined;
  /** Pour le lecteur d'écran : « Big Max, Développé couché ». */
  nom: string;
  onChoisir: (ressenti: Ressenti) => void;
  /** Dans la case d'une colonne, sur la ligne de la dernière série : un peu
   *  plus petits, toujours assez grands pour le doigt. */
  compact?: boolean;
}

/** Les trois visages, de gauche à droite : facile, correct, difficile. Le
 *  choisi est marqué, les deux autres s'effacent un peu. */
export function VisagesRessenti({ choisi, nom, onChoisir, compact = false }: VisagesRessentiProps) {
  return (
    <div role="group" aria-label={`Ressenti : ${nom}`} className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-2'}`}>
      {ORDRE_EMOJIS.map((ressenti) => {
        const actif = choisi === ressenti;
        return (
          <button
            key={ressenti}
            type="button"
            aria-pressed={actif}
            aria-label={SENS_EMOJI[ressenti]}
            title={SENS_EMOJI[ressenti]}
            onClick={() => onChoisir(ressenti)}
            className={`${compact ? 'min-h-12 text-2xl' : 'min-h-14 text-3xl'} touch-manipulation rounded-xl leading-none transition-opacity hover:opacity-90 active:opacity-80`}
            style={{
              background: actif ? 'var(--accent)' : 'var(--surface-haute)',
              opacity: choisi && !actif ? 0.45 : 1,
            }}
          >
            <span aria-hidden="true">{EMOJI_RESSENTI[ressenti]}</span>
          </button>
        );
      })}
    </div>
  );
}

interface BoutonsRessentiProps {
  /** Les exercices dont la dernière série vient d'être faite. */
  exercices: ExerciceARessentir[];
  /** Ce qui a déjà été dit, par exercice. */
  ressentis: Record<string, Ressenti>;
  onChoisir: (exerciceId: string, ressenti: Ressenti) => void;
}

/** Après la dernière série, pendant la pause ou aux étirements : les visages
 *  de chaque exercice qui vient de finir (la séance libre, ou les étirements
 *  après le dernier exercice). */
export default function BoutonsRessenti({ exercices, ressentis, onChoisir }: BoutonsRessentiProps) {
  if (exercices.length === 0) return null;
  return (
    <section
      aria-label="Ressenti sur la dernière série"
      className="space-y-3 rounded-2xl p-3 text-left"
      style={{ background: 'var(--surface)' }}
    >
      <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--texte-discret)' }}>
        Comment était la dernière série ? <span className="font-normal normal-case tracking-normal">(facultatif)</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        {AIDE_RESSENTI} {LEGENDE_VISAGES}.
      </p>
      {exercices.map(({ id, nom }) => (
        <div key={id}>
          <div className="font-bold">{nom}</div>
          <div className="mt-1">
            <VisagesRessenti choisi={ressentis[id]} nom={nom} onChoisir={(ressenti) => onChoisir(id, ressenti)} />
          </div>
        </div>
      ))}
    </section>
  );
}
