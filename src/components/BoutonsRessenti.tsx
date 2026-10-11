// Le ressenti, dans la séance guidée : après la dernière série d'un exercice,
// trois gros boutons — Lourd, Correct, Léger. Un seul toucher, facultatif ;
// on peut en toucher un autre plus tard pour changer. Habillage : les jetons
// de couleur de `index.css`, comme le reste de la séance.
import type { Ressenti } from '../types';
import { NOM_RESSENTI, RESSENTIS } from '../utils/ressenti';

export interface ExerciceARessentir {
  id: string;
  nom: string;
}

interface BoutonsRessentiProps {
  /** Les exercices dont la dernière série vient d'être faite. */
  exercices: ExerciceARessentir[];
  /** Ce qui a déjà été dit, par exercice. */
  ressentis: Record<string, Ressenti>;
  onChoisir: (exerciceId: string, ressenti: Ressenti) => void;
}

export default function BoutonsRessenti({ exercices, ressentis, onChoisir }: BoutonsRessentiProps) {
  if (exercices.length === 0) return null;
  return (
    <section
      aria-label="Ressenti sur la charge"
      className="space-y-3 rounded-2xl p-3 text-left"
      style={{ background: 'var(--surface)' }}
    >
      <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--texte-discret)' }}>
        Comment était la charge ? <span className="font-normal normal-case tracking-normal">(facultatif)</span>
      </div>
      {exercices.map(({ id, nom }) => (
        <div key={id} role="group" aria-label={`Ressenti : ${nom}`}>
          <div className="font-bold">{nom}</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {RESSENTIS.map((ressenti) => {
              const choisi = ressentis[id] === ressenti;
              return (
                <button
                  key={ressenti}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => onChoisir(id, ressenti)}
                  className="min-h-14 touch-manipulation rounded-2xl px-2 text-lg font-semibold transition-opacity hover:opacity-90 active:opacity-80"
                  style={
                    choisi
                      ? { background: 'var(--accent)', color: 'var(--accent-texte)' }
                      : { background: 'var(--surface-haute)', color: 'var(--texte)' }
                  }
                >
                  {NOM_RESSENTI[ressenti]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
