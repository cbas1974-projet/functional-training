// Éditeur du programme à deux : les prénoms, les soirs de jiu-jitsu, et les
// séances du cycle. Pour remplir vite, une liste se tape ou se dicte d'un coup :
// « trap bar trois fois huit, bench press 3x8, leg press ».
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Cible, ExerciceProgramme, Personne, Programme, SeanceProgramme } from '../types';
import { PERSONNES, lireListe, nouvelExercice, nouvelId } from '../utils/programme';

export interface EditeurProgrammeProps {
  programme: Programme;
  /** Séance ouverte au départ. */
  seanceId?: string;
  onChange: (programme: Programme) => void;
  onFermer: () => void;
}

const CIBLE = 44;
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function Petit({
  onClick,
  children,
  label,
  actif = false,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  label?: string;
  actif?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={actif}
      disabled={disabled}
      className="rounded-xl px-3 text-sm font-semibold disabled:opacity-30"
      style={{
        minHeight: CIBLE,
        minWidth: CIBLE,
        background: actif ? 'var(--accent)' : 'var(--surface-haute)',
        color: actif ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      {children}
    </button>
  );
}

/** − 3 + : un nombre qu'on règle au pouce, sans clavier. Il occupe toute la
 *  largeur de sa colonne. */
function Compteur({
  valeur,
  mini,
  maxi,
  label,
  onChange,
}: {
  valeur: number;
  mini: number;
  maxi: number;
  label: string;
  onChange: (valeur: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <Petit onClick={() => onChange(Math.max(mini, valeur - 1))} label={`${label} : moins`} disabled={valeur <= mini}>
        −
      </Petit>
      <span className="chiffres flex-1 text-center text-lg font-bold" aria-label={`${label} : ${valeur}`}>
        {valeur}
      </span>
      <Petit onClick={() => onChange(Math.min(maxi, valeur + 1))} label={`${label} : plus`} disabled={valeur >= maxi}>
        +
      </Petit>
    </div>
  );
}

const champ = {
  background: 'var(--surface-haute)',
  color: 'var(--texte)',
  border: '1px solid var(--bordure)',
} as const;

export default function EditeurProgramme({ programme, seanceId, onChange, onFermer }: EditeurProgrammeProps) {
  const [ouverte, setOuverte] = useState(seanceId ?? programme.seances[0]?.id);
  const [liste, setListe] = useState('');
  const seance = programme.seances.find((s) => s.id === ouverte) ?? programme.seances[0];

  const changerSeance = (modifiee: SeanceProgramme) =>
    onChange({
      ...programme,
      seances: programme.seances.map((s) => (s.id === modifiee.id ? modifiee : s)),
    });

  const changerExercice = (id: string, modif: Partial<ExerciceProgramme>) =>
    changerSeance({
      ...seance,
      exercices: seance.exercices.map((e) => (e.id === id ? { ...e, ...modif } : e)),
    });

  const changerCible = (exercice: ExerciceProgramme, personne: Personne, modif: Partial<Cible>) =>
    changerExercice(exercice.id, {
      cibles: { ...exercice.cibles, [personne]: { ...exercice.cibles[personne], ...modif } },
    });

  const deplacer = (index: number, sens: -1 | 1) => {
    const exercices = [...seance.exercices];
    const cible = index + sens;
    if (cible < 0 || cible >= exercices.length) return;
    [exercices[index], exercices[cible]] = [exercices[cible], exercices[index]];
    changerSeance({ ...seance, exercices });
  };

  const ajouterListe = () => {
    const lus = lireListe(liste);
    if (lus.length === 0) return;
    changerSeance({
      ...seance,
      exercices: [...seance.exercices, ...lus.map(({ nom, cible }) => nouvelExercice(nom, cible))],
    });
    setListe('');
  };

  const ajouterSeance = () => {
    const nouvelle: SeanceProgramme = {
      id: nouvelId('seance'),
      nom: `Séance ${programme.seances.length + 1}`,
      exercices: [],
    };
    onChange({ ...programme, seances: [...programme.seances, nouvelle] });
    setOuverte(nouvelle.id);
  };

  const supprimerSeance = () => {
    if (programme.seances.length <= 1) return;
    if (!window.confirm(`Supprimer « ${seance.nom} » et ses ${seance.exercices.length} exercices ?`)) return;
    const reste = programme.seances.filter((s) => s.id !== seance.id);
    onChange({ ...programme, seances: reste, prochaine: Math.min(programme.prochaine, reste.length - 1) });
    setOuverte(reste[0].id);
  };

  const basculerJour = (jour: number) => {
    const jours = programme.joursJiuJitsu.includes(jour)
      ? programme.joursJiuJitsu.filter((j) => j !== jour)
      : [...programme.joursJiuJitsu, jour].sort();
    onChange({ ...programme, joursJiuJitsu: jours });
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Notre programme</h2>
        <Petit onClick={onFermer} actif>
          Terminé
        </Petit>
      </div>

      {/* Les séances */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {programme.seances.map((s) => (
            <Petit key={s.id} onClick={() => setOuverte(s.id)} actif={s.id === seance.id}>
              {s.nom}
            </Petit>
          ))}
          <Petit onClick={ajouterSeance} label="Ajouter une séance">
            +
          </Petit>
        </div>

        <div className="space-y-3 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--bordure)' }}>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--texte-discret)' }}>
              Nom de la séance
            </span>
            <input
              type="text"
              value={seance.nom}
              onChange={(e) => changerSeance({ ...seance, nom: e.target.value })}
              className="mt-1 w-full rounded-xl px-3 text-lg font-bold"
              style={{ ...champ, minHeight: CIBLE }}
            />
          </label>

          {seance.exercices.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
              Aucun exercice pour l’instant. Ajoutez-les plus bas, d’un coup.
            </p>
          )}

          {seance.exercices.map((exercice, index) => (
            <div key={exercice.id} className="space-y-2 rounded-xl p-3" style={{ background: 'var(--surface-haute)' }}>
              <input
                type="text"
                value={exercice.nom}
                aria-label="Nom de l’exercice"
                onChange={(e) => changerExercice(exercice.id, { nom: e.target.value })}
                className="w-full rounded-xl px-3 font-semibold"
                style={{ ...champ, background: 'var(--surface)', minHeight: CIBLE }}
              />

              <div className="grid grid-cols-2 gap-2">
                <Petit onClick={() => changerExercice(exercice.id, { facon: 'tour' })} actif={exercice.facon === 'tour'}>
                  Chacun son tour
                </Petit>
                <Petit onClick={() => changerExercice(exercice.id, { facon: 'ensemble' })} actif={exercice.facon === 'ensemble'}>
                  En même temps
                </Petit>
              </div>

              {PERSONNES.map((personne) => (
                <div key={personne}>
                  <div className="flex justify-between text-xs font-semibold" style={{ color: 'var(--texte-discret)' }}>
                    <span>{programme.noms[personne]}</span>
                    <span>séries × répétitions</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Compteur
                      valeur={exercice.cibles[personne].series}
                      mini={1}
                      maxi={10}
                      label={`${programme.noms[personne]}, séries`}
                      onChange={(series) => changerCible(exercice, personne, { series })}
                    />
                    <span className="font-semibold" style={{ color: 'var(--texte-discret)' }}>
                      ×
                    </span>
                    <Compteur
                      valeur={exercice.cibles[personne].reps}
                      mini={1}
                      maxi={50}
                      label={`${programme.noms[personne]}, répétitions`}
                      onChange={(reps) => changerCible(exercice, personne, { reps })}
                    />
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <Petit onClick={() => deplacer(index, -1)} label="Monter" disabled={index === 0}>
                  ↑
                </Petit>
                <Petit onClick={() => deplacer(index, 1)} label="Descendre" disabled={index === seance.exercices.length - 1}>
                  ↓
                </Petit>
                <Petit
                  onClick={() => changerSeance({ ...seance, exercices: seance.exercices.filter((e) => e.id !== exercice.id) })}
                  label={`Retirer ${exercice.nom}`}
                >
                  Retirer
                </Petit>
              </div>
            </div>
          ))}

          <label className="block">
            <span className="text-sm font-semibold">Ajouter des exercices</span>
            <textarea
              value={liste}
              onChange={(e) => setListe(e.target.value)}
              rows={4}
              placeholder={'Trap bar 3x8\nBench press 3x8\nLeg press 3x10'}
              className="mt-1 w-full rounded-xl p-3"
              style={champ}
            />
            <span className="mt-1 block text-xs" style={{ color: 'var(--texte-discret)' }}>
              Un par ligne ou séparés par des virgules. Ça se dicte : « trap bar trois fois huit ».
            </span>
          </label>
          <Petit onClick={ajouterListe} actif disabled={!liste.trim()}>
            Ajouter à {seance.nom}
          </Petit>

          {programme.seances.length > 1 && (
            <button type="button" onClick={supprimerSeance} className="block py-2 text-sm underline" style={{ color: 'var(--alerte)' }}>
              Supprimer cette séance
            </button>
          )}
        </div>
      </section>

      {/* Les prénoms */}
      <section className="space-y-2">
        <h3 className="font-semibold">Vos prénoms</h3>
        <div className="grid grid-cols-2 gap-2">
          {PERSONNES.map((personne) => (
            <input
              key={personne}
              type="text"
              value={programme.noms[personne]}
              aria-label={personne === 'moi' ? 'Ton prénom' : 'Le prénom de ton ami'}
              onChange={(e) => onChange({ ...programme, noms: { ...programme.noms, [personne]: e.target.value } })}
              className="rounded-xl px-3"
              style={{ ...champ, minHeight: CIBLE }}
            />
          ))}
        </div>
      </section>

      {/* Les soirs de jiu-jitsu */}
      <section className="space-y-2">
        <h3 className="font-semibold">Soirs de jiu-jitsu</h3>
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          Ces jours-là, ta séance du matin perd une série. Celle de {programme.noms.ami} ne change pas.
        </p>
        <div className="flex flex-wrap gap-2">
          {JOURS.map((jour, i) => (
            <Petit key={jour} onClick={() => basculerJour(i)} actif={programme.joursJiuJitsu.includes(i)}>
              {jour}
            </Petit>
          ))}
        </div>
      </section>
    </div>
  );
}
