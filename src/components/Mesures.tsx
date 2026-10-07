// Les mensurations : le formulaire pour noter une mesure — poids, taille et âge,
// à une date —, la liste des siennes, et celle de l'autre quand le serveur est
// réglé. La première mesure est le point de départ, le « jour 1 » ; ensuite on
// en ajoute une quand on veut — une fois par mois, c'est le bon rythme. On peut
// corriger ou supprimer une mesure.
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Mesure, UnitePoids } from '../types';
import {
  LIMITES_MESURE,
  jourLocal,
  libellePiedsPouces,
  lireNombre,
  nouvelIdMesure,
  rappelMesure,
  trierMesures,
  verifierSaisie,
} from '../utils/mesures';
import type { ErreursSaisie, SaisieMesure } from '../utils/mesures';
import { formaterNombre, libelleJourIso, phraseVariation, variationDePoids } from '../utils/progression';
import { SUFFIXE_UNITE, convertirPoidsCorps } from '../utils/statistiques';
import { CIBLE } from './Feuille';

interface MesuresProps {
  /** Les mesures de ce téléphone, dans l'ordre qu'on veut. */
  mesures: Mesure[];
  /** L'unité des charges de l'application : celle du poids qu'on note. */
  unite: UnitePoids;
  /** Le prénom de l'autre, quand on regarde aussi ses mesures. */
  nomAutre: string | null;
  /** Les mesures de l'autre ; null tant qu'elles ne sont pas arrivées. */
  mesuresAutre: Mesure[] | null;
  /** Une mesure notée, ou corrigée (même identifiant). */
  onMesure: (mesure: Mesure) => void;
  onSupprimer: (id: string) => void;
}

/** Combien de mesures la liste montre d'abord ; les plus anciennes s'ouvrent d'un
 *  appui — mais on ne cache pas une mesure seule derrière un bouton. */
const MESURES_VISIBLES = 4;

const CHAMP = {
  minHeight: CIBLE,
  background: 'var(--surface-haute)',
  border: '1px solid var(--bordure)',
  color: 'var(--texte)',
} as const;

const BOUTON_SECONDAIRE = {
  minHeight: CIBLE,
  background: 'var(--surface-haute)',
  border: '1px solid var(--bordure)',
  color: 'var(--texte)',
} as const;

/** 82.4 s'écrit « 82,4 » dans un champ : on tape avec une virgule. */
const enTexte = (nombre: number) => String(nombre).replace('.', ',');

/** Le formulaire d'une nouvelle mesure : aujourd'hui, la taille et l'âge de la
 *  dernière fois — ils changent peu —, le poids à taper. */
function saisieVierge(mesures: readonly Mesure[]): SaisieMesure {
  const derniere = trierMesures(mesures).at(-1);
  return {
    date: jourLocal(),
    poids: '',
    tailleCm: derniere ? enTexte(derniere.tailleCm) : '',
    age: derniere ? String(derniere.age) : '',
  };
}

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-semibold" style={{ color: 'var(--texte)' }}>
        {libelle}
      </span>
      {children}
    </label>
  );
}

/** Un champ de texte du formulaire, à 16 px : le téléphone ne zoome pas dessus. */
function Saisie({
  valeur,
  onChange,
  mode,
  invalide,
  placeholder,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  mode: 'decimal' | 'numeric';
  invalide: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode={mode}
      autoComplete="off"
      value={valeur}
      placeholder={placeholder}
      aria-invalid={invalide}
      onChange={(evenement) => onChange(evenement.target.value)}
      className="chiffres w-full rounded-xl px-3 text-base"
      style={{ ...CHAMP, borderColor: invalide ? 'var(--alerte)' : 'var(--bordure)' }}
    />
  );
}

/** Une mesure en deux lignes : le jour, puis poids, taille et âge. */
function Resume({ mesure, unite, depart }: { mesure: Mesure; unite: UnitePoids; depart: boolean }) {
  const poids = convertirPoidsCorps(mesure.poids, mesure.unitePoids, unite);
  return (
    <span className="min-w-0">
      <span className="chiffres flex flex-wrap items-center gap-x-2 text-sm font-semibold" style={{ color: 'var(--texte)' }}>
        {libelleJourIso(mesure.date)}
        {depart && (
          <span
            className="rounded-full px-2 py-0.5 text-[13px] font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--accent-texte)' }}
          >
            Jour 1
          </span>
        )}
      </span>
      <span className="chiffres block text-sm" style={{ color: 'var(--texte-discret)' }}>
        {formaterNombre(poids, 1)} {SUFFIXE_UNITE[unite]} · {formaterNombre(mesure.tailleCm, 1)} cm · {mesure.age} ans
      </span>
    </span>
  );
}

/** La suite d'une mesure : la taille en pieds et pouces, l'écart du poids depuis le jour 1. */
function Details({ mesure, depart, unite }: { mesure: Mesure; depart: Mesure; unite: UnitePoids }) {
  return (
    <span className="chiffres block text-sm" style={{ color: 'var(--texte-discret)' }}>
      {libellePiedsPouces(mesure.tailleCm)}
      {mesure.id !== depart.id && ` · ${phraseVariation(variationDePoids(mesure, depart, unite), unite)}`}
    </span>
  );
}

function ListeDeMesures({
  titre,
  mesures,
  unite,
  onCorriger,
  onSupprimer,
}: {
  titre: string;
  mesures: Mesure[];
  unite: UnitePoids;
  /** Absents, la liste n'est que lue : celle de l'autre. */
  onCorriger?: (mesure: Mesure) => void;
  onSupprimer?: (id: string) => void;
}) {
  const [toutes, setToutes] = useState(false);
  const croissantes = trierMesures(mesures);
  const depart = croissantes[0];
  const recentes = [...croissantes].reverse();
  const repliable = recentes.length > MESURES_VISIBLES + 1;
  const montrees = toutes || !repliable ? recentes : recentes.slice(0, MESURES_VISIBLES);

  return (
    <div>
      <h4 className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
        {titre}
      </h4>
      {recentes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Pas encore de mesure.
        </p>
      ) : (
        <ul className="space-y-2">
          {montrees.map((mesure) => (
            <li key={mesure.id} style={{ background: 'var(--surface-haute)', borderRadius: 14 }}>
              {onCorriger && onSupprimer ? (
                <details className="group">
                  <summary
                    className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2"
                    style={{ minHeight: CIBLE + 8, listStyle: 'none' }}
                  >
                    <Resume mesure={mesure} unite={unite} depart={mesure.id === depart.id} />
                    <span className="sr-only">(corriger ou supprimer)</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-sm transition-transform group-open:rotate-180"
                      style={{ color: 'var(--texte-discret)' }}
                    >
                      ▾
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    <Details mesure={mesure} depart={depart} unite={unite} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(evenement) => {
                          // Le formulaire prend le relais : la ligne se referme.
                          evenement.currentTarget.closest('details')?.removeAttribute('open');
                          onCorriger(mesure);
                        }}
                        className="rounded-xl px-3 text-sm font-semibold"
                        style={BOUTON_SECONDAIRE}
                      >
                        Corriger
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Supprimer cette mesure ?')) onSupprimer(mesure.id);
                        }}
                        className="rounded-xl px-3 text-sm font-semibold"
                        style={{ ...BOUTON_SECONDAIRE, background: 'transparent', color: 'var(--alerte)' }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </details>
              ) : (
                <div className="px-3 py-2">
                  <Resume mesure={mesure} unite={unite} depart={mesure.id === depart.id} />
                  <Details mesure={mesure} depart={depart} unite={unite} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {repliable && (
        <button
          type="button"
          onClick={() => setToutes((ouvertes) => !ouvertes)}
          aria-expanded={toutes}
          className="mt-2 w-full rounded-xl px-3 text-sm font-semibold"
          style={BOUTON_SECONDAIRE}
        >
          {toutes ? 'Montrer les plus récentes' : `Voir les ${recentes.length - MESURES_VISIBLES} plus anciennes`}
        </button>
      )}
    </div>
  );
}

export default function Mesures({ mesures, unite, nomAutre, mesuresAutre, onMesure, onSupprimer }: MesuresProps) {
  const [saisie, setSaisie] = useState<SaisieMesure>(() => saisieVierge(mesures));
  const [erreurs, setErreurs] = useState<ErreursSaisie>({});
  const [message, setMessage] = useState('');
  /** La mesure qu'on corrige ; absente, le formulaire en note une nouvelle. */
  const [enCorrection, setEnCorrection] = useState<Mesure | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);

  const rappel = rappelMesure(mesures);
  const derniere = trierMesures(mesures).at(-1);
  /** Dans le champ du poids, vide, le dernier poids noté : de quoi savoir comment l'écrire. */
  const dernierPoids = derniere ? enTexte(convertirPoidsCorps(derniere.poids, derniere.unitePoids, unite)) : '';
  const taille = lireNombre(saisie.tailleCm);
  const tailleLisible =
    taille !== null && taille >= LIMITES_MESURE.tailleCm.min && taille <= LIMITES_MESURE.tailleCm.max;
  const premiere = mesures.length === 0 && enCorrection === null;

  const modifier = (champ: keyof SaisieMesure) => (valeur: string) => {
    setSaisie((avant) => ({ ...avant, [champ]: valeur }));
    setErreurs((avant) => ({ ...avant, [champ]: undefined }));
    setMessage('');
  };

  const enregistrer = (evenement: FormEvent) => {
    evenement.preventDefault();
    const resultat = verifierSaisie(saisie, unite);
    if (!resultat.ok) {
      setErreurs(resultat.erreurs);
      setMessage('');
      return;
    }
    const mesure: Mesure = { id: enCorrection?.id ?? nouvelIdMesure(), ...resultat.valeurs, unitePoids: unite };
    onMesure(mesure);
    // Le formulaire redevient vierge, avec la taille et l'âge de la dernière mesure.
    setSaisie(saisieVierge([...mesures.filter((m) => m.id !== mesure.id), mesure]));
    setErreurs({});
    setMessage(enCorrection ? 'Mesure corrigée.' : premiere ? 'Ton jour 1 est noté.' : 'Mesure notée.');
    setEnCorrection(null);
  };

  const corriger = (mesure: Mesure) => {
    setEnCorrection(mesure);
    setSaisie({
      date: mesure.date,
      poids: enTexte(convertirPoidsCorps(mesure.poids, mesure.unitePoids, unite)),
      tailleCm: enTexte(mesure.tailleCm),
      age: String(mesure.age),
    });
    setErreurs({});
    setMessage('');
    // La liste est plus bas : on amène le formulaire sous les yeux.
    formulaire.current?.scrollIntoView({ block: 'center' });
  };

  const annuler = () => {
    setEnCorrection(null);
    setSaisie(saisieVierge(mesures));
    setErreurs({});
    setMessage('');
  };

  /** Supprimer la mesure qu'on corrige referme aussi le formulaire. */
  const supprimer = (id: string) => {
    if (enCorrection?.id === id) annuler();
    onSupprimer(id);
  };

  const messagesErreur = Object.values(erreurs).filter((texte): texte is string => Boolean(texte));

  return (
    <section aria-labelledby="titre-mensurations" className="space-y-4">
      <div>
        <h3 id="titre-mensurations" className="text-base font-bold" style={{ color: 'var(--texte)' }}>
          Mensurations
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
          Une mesure par mois suffit : le corps change lentement. La première est ton jour 1, le point de départ.
        </p>
        {rappel && (
          <p
            role="status"
            className="mt-2 py-1 pl-3 text-sm"
            style={{ borderLeft: '3px solid var(--pause)', color: 'var(--texte)' }}
          >
            Ta dernière mesure date de {rappel.jours} jours : c’est le moment d’en noter une.
          </p>
        )}
      </div>

      <form ref={formulaire} onSubmit={enregistrer} noValidate className="space-y-3">
        {enCorrection && (
          <p className="text-sm font-semibold" style={{ color: 'var(--texte)' }}>
            Tu corriges la mesure du {libelleJourIso(enCorrection.date)}.
          </p>
        )}
        <Champ libelle="Jour de la mesure">
          <input
            type="date"
            value={saisie.date}
            max={jourLocal()}
            aria-invalid={Boolean(erreurs.date)}
            onChange={(evenement) => modifier('date')(evenement.target.value)}
            className="chiffres w-full rounded-xl px-3 text-base"
            style={{ ...CHAMP, borderColor: erreurs.date ? 'var(--alerte)' : 'var(--bordure)' }}
          />
        </Champ>
        {/* Les cases restent alignées sur leur bas, même si un nom passe sur deux lignes (écran étroit). */}
        <div className="grid grid-cols-3 items-end gap-2">
          <Champ libelle={`Poids (${SUFFIXE_UNITE[unite]})`}>
            <Saisie
              valeur={saisie.poids}
              onChange={modifier('poids')}
              mode="decimal"
              invalide={Boolean(erreurs.poids)}
              placeholder={dernierPoids}
            />
          </Champ>
          <Champ libelle="Taille (cm)">
            <Saisie valeur={saisie.tailleCm} onChange={modifier('tailleCm')} mode="decimal" invalide={Boolean(erreurs.tailleCm)} />
          </Champ>
          <Champ libelle="Âge (ans)">
            <Saisie valeur={saisie.age} onChange={modifier('age')} mode="numeric" invalide={Boolean(erreurs.age)} />
          </Champ>
        </div>
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Poids en {unite === 'lb' ? 'livres' : 'kilos'}, comme tes charges (à changer dans les Réglages).
          {tailleLisible && ` ${formaterNombre(taille, 1)} cm, c’est ${libellePiedsPouces(taille)}.`}
        </p>
        {messagesErreur.length > 0 && (
          <div role="alert" className="space-y-1 text-sm" style={{ color: 'var(--alerte)' }}>
            {messagesErreur.map((texte) => (
              <p key={texte}>{texte}</p>
            ))}
          </div>
        )}
        <div className={enCorrection ? 'grid grid-cols-2 gap-2' : ''}>
          <button
            type="submit"
            className="w-full rounded-xl px-4 text-sm font-bold"
            style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
          >
            {enCorrection ? 'Enregistrer' : premiere ? 'Noter mon jour 1' : 'Noter la mesure'}
          </button>
          {enCorrection && (
            <button type="button" onClick={annuler} className="rounded-xl px-4 text-sm font-semibold" style={BOUTON_SECONDAIRE}>
              Annuler
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm font-semibold" style={{ color: 'var(--montee)' }}>
            {message}
          </p>
        )}
      </form>

      {mesures.length > 0 && (
        <ListeDeMesures titre="Mes mesures" mesures={mesures} unite={unite} onCorriger={corriger} onSupprimer={supprimer} />
      )}
      {nomAutre && mesuresAutre !== null && (
        <ListeDeMesures titre={`Mesures de ${nomAutre}`} mesures={mesuresAutre} unite={unite} />
      )}
    </section>
  );
}
