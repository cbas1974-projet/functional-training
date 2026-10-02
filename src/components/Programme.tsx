// Notre programme : l'écran d'accueil. Il s'ouvre sur la séance du jour, la
// suivante du cycle, et dit tout de suite si ta version est complète ou
// allégée. Un gros bouton pour commencer ; le reste est derrière.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { EtatProgramme, ExerciceProgramme, Programme as LeProgramme, Tempo, UnitePoids } from '../types';
import {
  PERSONNES,
  chargerEtatProgramme,
  ciblesDuJour,
  dernieresCharges,
  enregistrerEtatProgramme,
  estJourAllege,
  libelleCharges,
  seanceSuivante,
  terminerSeance,
} from '../utils/programme';
import { formaterDateFr } from '../utils/formatage';
import SeanceADeux from './SeanceADeux';
import EditeurProgramme from './EditeurProgramme';

export interface ProgrammeProps {
  unite: UnitePoids;
  tempo: Tempo;
}

type Vue = 'accueil' | 'modifier' | 'historique';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const CIBLE = 44;

function Bouton({
  onClick,
  children,
  actif = false,
  className = '',
}: {
  onClick: () => void;
  children: ReactNode;
  actif?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-xl px-4 text-sm font-semibold ${className}`}
      style={{
        minHeight: CIBLE,
        background: actif ? 'var(--accent)' : 'var(--surface)',
        color: actif ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      {children}
    </button>
  );
}

const carte = { background: 'var(--surface)', border: '1px solid var(--bordure)', borderRadius: 16 } as const;

export default function Programme({ unite, tempo }: ProgrammeProps) {
  const [etat, setEtat] = useState<EtatProgramme>(chargerEtatProgramme);
  useEffect(() => {
    enregistrerEtatProgramme(etat);
  }, [etat]);

  const [vue, setVue] = useState<Vue>('accueil');
  const [choisie, setChoisie] = useState<string | null>(null);
  const [seanceAModifier, setSeanceAModifier] = useState<string | undefined>(undefined);
  const [versionComplete, setVersionComplete] = useState(false);

  const { programme, historique, enCours } = etat;
  const aujourdhui = new Date();
  const jourDeJiuJitsu = estJourAllege(aujourdhui, programme.joursJiuJitsu);
  const allegee = jourDeJiuJitsu && !versionComplete;
  const prevue = seanceSuivante(programme);
  const seance = programme.seances.find((s) => s.id === choisie) ?? prevue;

  const changerProgramme = (nouveau: LeProgramme) => setEtat((prec) => ({ ...prec, programme: nouveau }));

  const commencer = () =>
    setEtat((prec) => ({
      ...prec,
      enCours: {
        seanceId: seance.id,
        allegee,
        etape: 0,
        poids: {},
        faites: [],
        demarreeLe: new Date().toISOString(),
      },
    }));

  const modifier = (seanceId?: string) => {
    setSeanceAModifier(seanceId);
    setVue('modifier');
  };

  // ------------------------------------------------ La séance en cours

  const seanceEnCours = enCours ? programme.seances.find((s) => s.id === enCours.seanceId) : undefined;
  if (enCours && seanceEnCours) {
    return (
      <SeanceADeux
        programme={programme}
        historique={historique}
        seance={seanceEnCours}
        enCours={enCours}
        unite={unite}
        tempo={tempo}
        onChange={(suivant) => setEtat((prec) => ({ ...prec, enCours: suivant }))}
        onDepart={(exerciceId, depart) =>
          setEtat((prec) => ({
            ...prec,
            programme: {
              ...prec.programme,
              seances: prec.programme.seances.map((s) => ({
                ...s,
                exercices: s.exercices.map((e) => (e.id === exerciceId ? { ...e, depart } : e)),
              })),
            },
          }))
        }
        onEnregistrer={() => {
          setEtat((prec) => terminerSeance(prec, new Date()));
          setChoisie(null);
          setVersionComplete(false);
        }}
        onAbandonner={() => setEtat((prec) => ({ ...prec, enCours: null }))}
      />
    );
  }

  // ------------------------------------------------ Modifier le programme

  if (vue === 'modifier') {
    return (
      <EditeurProgramme
        programme={programme}
        seanceId={seanceAModifier}
        onChange={changerProgramme}
        onFermer={() => setVue('accueil')}
      />
    );
  }

  // ------------------------------------------------ L'historique

  if (vue === 'historique') {
    return (
      <div className="space-y-3 pb-10">
        <Bouton onClick={() => setVue('accueil')}>← Aujourd’hui</Bouton>
        <h2 className="text-xl font-bold">Nos séances</h2>
        {historique.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
            Aucune séance enregistrée pour l’instant.
          </p>
        )}
        {historique.map((faite) => (
          <article key={faite.id} className="space-y-2 p-4" style={carte}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-bold">
                {faite.nomSeance}
                {faite.allegee && (
                  <span className="ml-2 text-xs font-semibold" style={{ color: 'var(--texte-discret)' }}>
                    allégée
                  </span>
                )}
              </h3>
              <span className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
                {formaterDateFr(faite.date)}
              </span>
            </div>
            <ul className="space-y-1 text-sm">
              {faite.exercices.map((exo) => (
                <li key={exo.exerciceId}>
                  <span className="font-semibold">{exo.nom}</span>
                  {PERSONNES.map((personne) => {
                    const charges = exo.series
                      .filter((s) => s.personne === personne)
                      .map((s) => (s.poids > 0 ? String(s.poids) : '—'));
                    return charges.length > 0 ? (
                      <span key={personne} className="chiffres block" style={{ color: 'var(--texte-discret)' }}>
                        {programme.noms[personne]} : {charges.join(' · ')}
                      </span>
                    ) : null;
                  })}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Supprimer « ${faite.nomSeance} » du ${formaterDateFr(faite.date)} ?`)) {
                  setEtat((prec) => ({ ...prec, historique: prec.historique.filter((h) => h.id !== faite.id) }));
                }
              }}
              className="text-xs underline"
              style={{ color: 'var(--texte-discret)', minHeight: 32 }}
            >
              Supprimer
            </button>
          </article>
        ))}
      </div>
    );
  }

  // ------------------------------------------------ Aujourd'hui

  const ligneCibles = (exercice: ExerciceProgramme) => {
    const cibles = ciblesDuJour(exercice, allegee);
    return PERSONNES.map(
      (personne) => `${programme.noms[personne]} ${cibles[personne].series}×${cibles[personne].reps}`,
    ).join(' · ');
  };

  const ligneDerniereFois = (exercice: ExerciceProgramme) =>
    PERSONNES.map((personne) => {
      const charges = libelleCharges(dernieresCharges(historique, exercice.nom, personne));
      return charges ? `${programme.noms[personne]} ${charges}` : '';
    })
      .filter(Boolean)
      .join(' · ');

  const vide = seance.exercices.length === 0;

  return (
    <div className="space-y-4">
      <section className="space-y-3 p-4" style={carte}>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
          Aujourd’hui · {JOURS[aujourdhui.getDay()]}
        </p>
        <h2 className="text-3xl font-extrabold leading-tight">{seance.nom}</h2>
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--surface-haute)' }}>
          {allegee ? (
            <>
              <strong>Ta version allégée :</strong> une série de moins, tu as du jiu-jitsu ce soir.{' '}
              {programme.noms.ami} garde la sienne.
            </>
          ) : jourDeJiuJitsu ? (
            <>
              <strong>Ta version complète</strong>, même avec le jiu-jitsu ce soir.
            </>
          ) : (
            <>
              <strong>Ta version complète :</strong> pas de jiu-jitsu ce soir, tu peux pousser.
            </>
          )}
          {jourDeJiuJitsu && (
            <button
              type="button"
              onClick={() => setVersionComplete((v) => !v)}
              className="mt-1 block underline"
              style={{ color: 'var(--texte-discret)' }}
            >
              {versionComplete ? 'Revenir à la version allégée' : 'Faire ma version complète'}
            </button>
          )}
        </div>

        {vide ? (
          <div className="space-y-2">
            <p style={{ color: 'var(--texte-discret)' }}>Cette séance est vide.</p>
            <Bouton onClick={() => modifier(seance.id)} actif>
              Remplir {seance.nom}
            </Bouton>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordure)' }}>
            {seance.exercices.map((exercice) => {
              const derniere = ligneDerniereFois(exercice);
              return (
                <li key={exercice.id} className="py-2" style={{ borderColor: 'var(--bordure)' }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{exercice.nom}</span>
                    <span className="shrink-0 text-xs" style={{ color: 'var(--texte-discret)' }}>
                      {exercice.facon === 'tour' ? 'chacun son tour' : 'en même temps'}
                    </span>
                  </div>
                  <div className="chiffres text-sm">{ligneCibles(exercice)}</div>
                  {derniere && (
                    <div className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
                      Dernière fois : {derniere}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texte-discret)' }}>
          Une autre séance aujourd’hui ?
        </h3>
        <div className="flex flex-wrap gap-2">
          {programme.seances.map((s) => (
            <Bouton key={s.id} onClick={() => setChoisie(s.id === prevue.id ? null : s.id)} actif={s.id === seance.id}>
              {s.nom}
              {s.id === prevue.id ? ' · prévue' : ''}
            </Bouton>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Bouton onClick={() => modifier(seance.id)}>Modifier le programme</Bouton>
        <Bouton onClick={() => setVue('historique')}>
          Nos séances <span className="chiffres" style={{ color: 'var(--texte-discret)' }}>{historique.length}</span>
        </Bouton>
      </div>

      {!vide && (
        <div
          className="sticky bottom-0 z-30 -mx-4 px-4 pt-3"
          style={{
            background: 'var(--fond)',
            borderTop: '1px solid var(--bordure)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
        >
          <button
            type="button"
            onClick={commencer}
            className="w-full text-lg font-bold"
            style={{ height: 60, borderRadius: 16, background: 'var(--montee)', color: 'var(--accent-texte)' }}
          >
            Commencer {seance.nom}
          </button>
        </div>
      )}
    </div>
  );
}
