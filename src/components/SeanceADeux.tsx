// Séance à deux : la séance du programme, série par série. L'écran dit à qui
// c'est le tour, combien de répétitions faire, et retient la charge de
// chacun. On avance au doigt (« Fait ») : en salle, personne ne sait combien
// de temps prendra le réglage d'une machine ou la série de l'autre.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type {
  ExerciceProgramme,
  Personne,
  Programme,
  SeanceADeuxEnCours,
  SeanceProgramme,
  SeanceProgrammeFaite,
  Tempo,
  UnitePoids,
} from '../types';
import {
  chargeProposee,
  cleSerie,
  departDe,
  dernieresCharges,
  etapesSeance,
  libelleCharges,
  premiereDuDepart,
} from '../utils/programme';
import type { PartEtape } from '../utils/programme';
import { lirePhase } from '../utils/etapesSeance';
import type { PhaseTempo, SensTempo } from '../utils/etapesSeance';
import { secondesParRep } from '../utils/generateurSeance';
import { libelleTempo } from '../utils/formatage';
import { SUFFIXE_UNITE } from '../utils/statistiques';
import { bellSound } from '../utils/sounds';
import { useVerrouEcran } from '../hooks/useVerrouEcran';
import PaceurTempo from './PaceurTempo';
import type { LectureTempo } from './PaceurTempo';

export interface SeanceADeuxProps {
  programme: Programme;
  historique: SeanceProgrammeFaite[];
  seance: SeanceProgramme;
  enCours: SeanceADeuxEnCours;
  unite: UnitePoids;
  tempo: Tempo;
  onChange: (enCours: SeanceADeuxEnCours) => void;
  /** Corrige l'endroit où commence une répétition, pour le tempo. */
  onDepart: (exerciceId: string, depart: 'haut' | 'bas') => void;
  onEnregistrer: () => void;
  onAbandonner: () => void;
}

const CIBLE = 48;

/** Couleur de chacun : on voit d'un coup d'œil à qui c'est le tour. */
const COULEUR: Record<Personne, string> = { moi: 'var(--montee)', ami: 'var(--descente)' };

const MOT_DE_PHASE: Record<PhaseTempo, { mot: string; couleur: string }> = {
  monte: { mot: 'MONTE', couleur: 'var(--montee)' },
  descend: { mot: 'DESCENDS', couleur: 'var(--descente)' },
  pause: { mot: 'TIENS', couleur: 'var(--tenue)' },
};

function Bouton({
  onClick,
  children,
  fond = 'var(--surface-haute)',
  couleur = 'var(--texte)',
  className = '',
  hauteur = CIBLE,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  fond?: string;
  couleur?: string;
  className?: string;
  hauteur?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 font-bold disabled:opacity-40 ${className}`}
      style={{ minHeight: hauteur, background: fond, color: couleur, border: '1px solid var(--bordure)' }}
    >
      {children}
    </button>
  );
}

function formaterMmSs(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function lireCharge(texte: string): number | null {
  const valeur = Number.parseFloat(texte.replace(',', '.'));
  return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
}

// ------------------------------------------------------------- Le tempo

interface TempoEnLigneProps {
  tempo: Tempo;
  reps: number;
  depart: 'haut' | 'bas';
  onBasculerDepart: () => void;
  onDemarrer: () => void;
}

/** La bille du tempo, à la demande : on la lance quand on est prêt sous la
 *  charge, pas quand l'écran change. */
function TempoEnLigne({ tempo, reps, depart, onBasculerDepart, onDemarrer }: TempoEnLigneProps) {
  const { monteeSec, descenteSec } = tempo;
  const pauseSec = tempo.pauseSec ?? 0;
  const parRep = secondesParRep(tempo);
  const totalSec = reps * parRep;
  const premiere: SensTempo = premiereDuDepart(depart);
  const [debutMs, setDebutMs] = useState<number | null>(null);
  const [maintenantMs, setMaintenantMs] = useState(0);
  const derniereCle = useRef('');

  useEffect(() => {
    if (debutMs === null) return;
    const intervalle = window.setInterval(() => {
      const t = performance.now();
      const ecoule = (t - debutMs) / 1000;
      if (ecoule >= totalSec) {
        bellSound.playBell('end');
        setDebutMs(null);
        return;
      }
      const cycle = Math.floor(ecoule / parRep);
      const { phase } = lirePhase(
        { monteeSec, descenteSec, pauseSec },
        premiere,
        ecoule - cycle * parRep,
      );
      const cle = `${cycle}:${phase}`;
      // La première phase ne bipe pas : la cloche vient de sonner.
      if (derniereCle.current && derniereCle.current !== cle) bellSound.playTick(phase);
      derniereCle.current = cle;
      setMaintenantMs(t);
    }, 100);
    return () => window.clearInterval(intervalle);
  }, [debutMs, totalSec, parRep, monteeSec, descenteSec, pauseSec, premiere]);

  const lire = useCallback((): LectureTempo | null => {
    if (debutMs === null || parRep <= 0) return null;
    const ecoule = Math.min(totalSec - 0.001, Math.max(0, (performance.now() - debutMs) / 1000));
    const cycle = Math.floor(ecoule / parRep);
    const lecture = lirePhase({ monteeSec, descenteSec, pauseSec }, premiere, ecoule - cycle * parRep);
    return {
      phase: lecture.phase,
      progression: lecture.dureePhaseSec > 0 ? lecture.ecouleDansPhaseSec / lecture.dureePhaseSec : 0,
    };
  }, [debutMs, parRep, totalSec, monteeSec, descenteSec, pauseSec, premiere]);

  if (debutMs === null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Bouton
          onClick={() => {
            bellSound.unlock();
            bellSound.playBell('start');
            derniereCle.current = '';
            const t = performance.now();
            setMaintenantMs(t);
            setDebutMs(t);
            onDemarrer();
          }}
          className="flex-1 text-sm"
        >
          ▶ Tempo {libelleTempo(tempo)}
        </Bouton>
        <button
          type="button"
          onClick={onBasculerDepart}
          className="rounded-xl px-3 text-xs underline"
          style={{ minHeight: 40, color: 'var(--texte-discret)' }}
        >
          Départ : en {depart}
        </button>
      </div>
    );
  }

  const ecoule = Math.max(0, (maintenantMs - debutMs) / 1000);
  const cycle = Math.floor(ecoule / parRep);
  const lecture = lirePhase({ monteeSec, descenteSec, pauseSec }, premiere, ecoule - cycle * parRep);
  const { mot, couleur } = MOT_DE_PHASE[lecture.phase];
  return (
    <div className="text-center">
      <div className="text-4xl font-extrabold tracking-[0.12em]" style={{ color: couleur }}>
        {mot}
      </div>
      <div className="mt-2">
        <PaceurTempo
          lire={lire}
          resteSec={lecture.dureePhaseSec - lecture.ecouleDansPhaseSec}
          phase={lecture.phase}
          avecChiffre
          hauteurPx={190}
        />
      </div>
      <div className="chiffres mt-1 text-xl font-semibold">
        Rép {Math.min(reps, cycle + 1)} / {reps}
      </div>
      <Bouton onClick={() => setDebutMs(null)} className="mt-2 text-sm">
        Arrêter le tempo
      </Bouton>
    </div>
  );
}

// ------------------------------------------------------------- La séance

export default function SeanceADeux({
  programme,
  historique,
  seance,
  enCours,
  unite,
  tempo,
  onChange,
  onDepart,
  onEnregistrer,
  onAbandonner,
}: SeanceADeuxProps) {
  const etapes = useMemo(() => etapesSeance(seance, enCours.allegee), [seance, enCours.allegee]);
  const index = Math.min(enCours.etape, etapes.length);
  const etape = etapes[index];
  const exercice: ExerciceProgramme | undefined = etape
    ? seance.exercices.find((e) => e.id === etape.exerciceId)
    : undefined;
  const faites = useMemo(() => new Set(enCours.faites), [enCours.faites]);
  const [textes, setTextes] = useState<Record<string, string>>({});
  const [confirmer, setConfirmer] = useState(false);
  const verrou = useVerrouEcran(true);
  const pas = unite === 'lb' ? 5 : 2.5;

  // Le repos se compte depuis la dernière série validée.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const intervalle = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(intervalle);
  }, []);
  const reposSec = enCours.derniereSerieLe
    ? Math.max(0, Math.floor((maintenant - Date.parse(enCours.derniereSerieLe)) / 1000))
    : null;

  // À chaque étape, on remonte en haut de l'écran.
  const haut = useRef<HTMLDivElement>(null);
  useEffect(() => {
    haut.current?.scrollIntoView({ block: 'start' });
  }, [index]);

  const allerA = (cible: number) => {
    onChange({ ...enCours, etape: Math.max(0, Math.min(etapes.length, cible)) });
  };

  const saisir = (cle: string, texte: string) => {
    setTextes((prec) => ({ ...prec, [cle]: texte }));
    const valeur = lireCharge(texte);
    const poids = { ...enCours.poids };
    if (valeur === null) delete poids[cle];
    else poids[cle] = valeur;
    onChange({ ...enCours, poids });
  };

  const ajuster = (cle: string, valeurActuelle: number | null, delta: number) => {
    const suivante = Math.max(0, (valeurActuelle ?? 0) + delta);
    saisir(cle, suivante > 0 ? String(suivante) : '');
  };

  const valider = () => {
    if (!etape || !exercice) return;
    void verrou.demander();
    bellSound.unlock();
    const poids = { ...enCours.poids };
    const nouvelles: string[] = [];
    for (const part of etape.parts) {
      const cle = cleSerie(exercice.id, part.personne, part.serie);
      nouvelles.push(cle);
      // La charge proposée et gardée telle quelle est enregistrée d'office :
      // sans cela, une série faite avec la même charge sortirait vide.
      if (poids[cle] === undefined) {
        const proposee = chargeProposee(enCours, historique, exercice, part.personne, part.serie);
        if (proposee !== null) poids[cle] = proposee;
      }
    }
    onChange({
      ...enCours,
      poids,
      faites: [...new Set([...enCours.faites, ...nouvelles])],
      etape: index + 1,
      derniereSerieLe: new Date().toISOString(),
    });
  };

  // ------------------------------------------------ Les exercices de la séance

  const etatExercice = (exo: ExerciceProgramme) => {
    const siennes = etapes.filter((e) => e.exerciceId === exo.id);
    const total = siennes.reduce((n, e) => n + e.parts.length, 0);
    const fait = siennes.reduce(
      (n, e) => n + e.parts.filter((p) => faites.has(cleSerie(exo.id, p.personne, p.serie))).length,
      0,
    );
    return { premiere: etapes.findIndex((e) => e.exerciceId === exo.id), fait, total };
  };

  const listeExercices = (
    <div className="flex flex-wrap gap-2">
      {seance.exercices.map((exo) => {
        const { premiere, fait, total } = etatExercice(exo);
        const courant = exercice?.id === exo.id;
        const complet = total > 0 && fait === total;
        return (
          <button
            key={exo.id}
            type="button"
            onClick={() => premiere >= 0 && allerA(premiere)}
            className="rounded-xl px-3 text-sm font-semibold"
            style={{
              minHeight: 40,
              background: courant ? 'var(--accent)' : 'var(--surface-haute)',
              color: courant ? 'var(--accent-texte)' : 'var(--texte)',
              border: '1px solid var(--bordure)',
              opacity: complet && !courant ? 0.6 : 1,
            }}
          >
            {complet ? '✓ ' : ''}
            {exo.nom}
          </button>
        );
      })}
    </div>
  );

  // ------------------------------------------------ Une personne, une série

  const carte = (part: PartEtape, seule: boolean) => {
    if (!exercice) return null;
    const cle = cleSerie(exercice.id, part.personne, part.serie);
    const proposee = chargeProposee(enCours, historique, exercice, part.personne, part.serie);
    const texte = textes[cle] ?? (proposee !== null ? String(proposee) : '');
    const valeur = lireCharge(texte);
    const derniere = libelleCharges(dernieresCharges(historique, exercice.nom, part.personne));
    const nom = programme.noms[part.personne];
    return (
      <div
        key={cle}
        className="rounded-2xl p-4"
        style={{ background: 'var(--surface)', borderLeft: `6px solid ${COULEUR[part.personne]}` }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div
            className={`${seule ? 'text-3xl' : 'text-2xl'} font-extrabold`}
            style={{ color: COULEUR[part.personne] }}
          >
            {nom}
          </div>
          {faites.has(cle) && (
            <span className="text-sm font-semibold" style={{ color: 'var(--montee)' }}>
              ✓ faite
            </span>
          )}
        </div>
        <div className="chiffres mt-1 text-lg font-semibold">
          Série {part.serie} / {part.series} · {part.reps} reps
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Bouton onClick={() => ajuster(cle, valeur, -pas)} className="w-14 text-xl">
            −
          </Bouton>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Charge de ${nom}, série ${part.serie} (${SUFFIXE_UNITE[unite]})`}
            placeholder="—"
            value={texte}
            onChange={(e: ChangeEvent<HTMLInputElement>) => saisir(cle, e.target.value)}
            className="chiffres h-14 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl"
            style={{ background: 'var(--surface-haute)', color: 'var(--texte)', borderColor: 'var(--bordure)' }}
          />
          <Bouton onClick={() => ajuster(cle, valeur, pas)} className="w-14 text-xl">
            +
          </Bouton>
          <span className="w-6 text-sm" style={{ color: 'var(--texte-discret)' }}>
            {SUFFIXE_UNITE[unite]}
          </span>
        </div>
        <p className="chiffres mt-2 text-xs" style={{ color: 'var(--texte-discret)' }}>
          {derniere ? `La dernière fois : ${derniere}` : 'Première fois : notez la charge.'}
        </p>
      </div>
    );
  };

  // ------------------------------------------------ Le rendu

  const total = etapes.length;
  const finie = index >= total;
  const parts = etape?.parts ?? [];
  const ensemble = parts.length > 1;
  const nbFaites = enCours.faites.length;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: 'var(--fond)' }}>
      <div ref={haut} className="mx-auto max-w-md space-y-4 px-4 pb-8" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{seance.nom}</h1>
            <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
              {enCours.allegee ? 'Ta version allégée · ' : ''}
              {Math.min(index + 1, total)} / {total}
            </p>
          </div>
          <Bouton onClick={() => setConfirmer(true)} className="shrink-0 text-sm">
            Terminer
          </Bouton>
        </header>

        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-haute)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${total ? (Math.min(index, total) / total) * 100 : 0}%`, background: 'var(--accent)' }}
          />
        </div>

        {confirmer && (
          <div className="space-y-2 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '2px solid var(--pause)' }}>
            <p className="font-semibold">
              {nbFaites > 0
                ? `Terminer maintenant ? ${nbFaites} série${nbFaites > 1 ? 's' : ''} seront enregistrées.`
                : 'Aucune série faite : la séance ne sera pas enregistrée.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Bouton onClick={nbFaites > 0 ? onEnregistrer : onAbandonner} fond="var(--accent)" couleur="var(--accent-texte)">
                {nbFaites > 0 ? 'Enregistrer' : 'Quitter'}
              </Bouton>
              <Bouton onClick={() => setConfirmer(false)}>Continuer</Bouton>
            </div>
            {nbFaites > 0 && (
              <button type="button" onClick={onAbandonner} className="w-full py-2 text-sm underline" style={{ color: 'var(--texte-discret)' }}>
                Quitter sans enregistrer
              </button>
            )}
          </div>
        )}

        {finie ? (
          <section className="space-y-4 text-center">
            <h2 className="text-3xl font-extrabold" style={{ color: 'var(--montee)' }}>
              Séance terminée
            </h2>
            <p style={{ color: 'var(--texte-discret)' }}>
              {nbFaites} série{nbFaites > 1 ? 's' : ''} faite{nbFaites > 1 ? 's' : ''}. Les charges seront proposées la
              prochaine fois.
            </p>
            <Bouton onClick={onEnregistrer} fond="var(--montee)" couleur="var(--accent-texte)" hauteur={60} className="w-full text-lg">
              Enregistrer la séance
            </Bouton>
            <Bouton onClick={() => allerA(total - 1)} className="w-full">
              ◀ Revenir à la dernière série
            </Bouton>
          </section>
        ) : (
          exercice && (
            <section className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
                  {ensemble ? 'Ensemble' : exercice.facon === 'tour' ? 'Chacun son tour' : 'Seul'}
                </p>
                <h2 className="text-3xl font-extrabold leading-tight">{exercice.nom}</h2>
              </div>

              {parts.map((part) => carte(part, !ensemble))}

              <TempoEnLigne
                key={`${index}-${departDe(exercice)}`}
                tempo={tempo}
                reps={Math.max(...parts.map((p) => p.reps))}
                depart={departDe(exercice)}
                onBasculerDepart={() => onDepart(exercice.id, departDe(exercice) === 'haut' ? 'bas' : 'haut')}
                onDemarrer={() => void verrou.demander()}
              />

              <Bouton onClick={valider} fond="var(--montee)" couleur="var(--accent-texte)" hauteur={64} className="w-full text-xl">
                ✓ Fait
              </Bouton>
              <div className="grid grid-cols-2 gap-2">
                <Bouton onClick={() => allerA(index - 1)} disabled={index === 0}>
                  ◀ Précédent
                </Bouton>
                <Bouton onClick={() => allerA(index + 1)}>Passer ▶</Bouton>
              </div>
              {reposSec !== null && reposSec < 600 && (
                <p className="chiffres text-center text-sm" style={{ color: 'var(--texte-discret)' }}>
                  Depuis la dernière série : {formaterMmSs(reposSec)}
                </p>
              )}
            </section>
          )
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--texte-discret)' }}>
            Exercices de la séance
          </h3>
          {listeExercices}
        </section>
      </div>
    </div>
  );
}
