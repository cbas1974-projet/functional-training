import { EXERCICES_PAR_ID, cheminImage } from '../data/exercices';
import type { Seance } from '../types';
import { groupesUnTelephone } from './etapesSeance';

// L'image de la séance du jour, comme celle du mardi 27 octobre faite à la main
// (docs/mardi-max.html) : une rangée par exercice seul ou par paire, puis la
// finale. Elle sert à l'envoyer à Max, par le partage du téléphone.

interface Rangee {
  etiquette: string;
  fond: string;
  cases: { id: string; nom: string }[];
}

const nomDe = (id: string): string => EXERCICES_PAR_ID[id]?.nomFr ?? id;

/** Les rangées de la séance : seuls et paires dans l'ordre, puis la finale. */
export function rangeesDeSeance(seance: Seance): Rangee[] {
  let paire = 0;
  const rangees: Rangee[] = groupesUnTelephone(seance).map((groupe) => {
    const estPaire = groupe.length > 1;
    if (estPaire) paire += 1;
    return {
      etiquette: estPaire ? `PAIRE ${paire}` : 'SEUL',
      fond: estPaire ? '#fff0dc' : '#eaf0ff',
      cases: groupe.map((bloc) => ({ id: bloc.exerciceId, nom: nomDe(bloc.exerciceId) })),
    };
  });
  if (seance.finaleChrono) {
    const minutes = Math.round(seance.finaleChrono.dureeSec / 60);
    rangees.push({
      etiquette: `FINALE ${minutes} MIN`,
      fond: '#e6f6e6',
      cases: [{ id: seance.finaleChrono.exerciceId, nom: nomDe(seance.finaleChrono.exerciceId) }],
    });
  }
  return rangees;
}

const chargerImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/** Dessine la séance sur un canvas et le rend en PNG ; null si le navigateur
 *  ne sait pas dessiner. */
export async function imageDeSeance(seance: Seance, titre: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const rangees = rangeesDeSeance(seance);
  const images = await Promise.all(rangees.map((r) => Promise.all(r.cases.map((c) => chargerImage(cheminImage(c.id))))));
  const L = 760;
  const colG = 110;
  const caseL = 300;
  const caseH = 200;
  const rangeeH = caseH + 50;
  const H = 70 + rangees.length * (rangeeH + 12) + 10;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, L, H);
  ctx.fillStyle = '#000';
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText(titre, 16, 42);
  rangees.forEach((r, i) => {
    const y = 60 + i * (rangeeH + 12);
    ctx.fillStyle = r.fond;
    ctx.beginPath();
    ctx.roundRect(8, y, L - 16, rangeeH, 12);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.etiquette, 22, y + caseH / 2 + 6);
    r.cases.forEach((c, k) => {
      const x = colG + k * (caseL + 50);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y + 8, caseL, caseH);
      const image = images[i][k];
      if (image) {
        const echelle = Math.min(caseL / image.width, caseH / image.height);
        const w = image.width * echelle;
        const h = image.height * echelle;
        ctx.drawImage(image, x + (caseL - w) / 2, y + 8 + (caseH - h) / 2, w, h);
      }
      ctx.fillStyle = '#000';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.nom, x + caseL / 2, y + caseH + 32);
      if (k === 0 && r.cases.length > 1) {
        ctx.font = '800 30px system-ui, sans-serif';
        ctx.fillText('+', x + caseL + 25, y + caseH / 2 + 10);
      }
    });
  });
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

export type IssueEnvoi = 'partage' | 'telecharge' | 'impossible';

/** Ouvre le partage du téléphone avec l'image : rien ne part sans que Séb
 *  choisisse lui-même la personne. Sans partage de fichiers, l'image est
 *  téléchargée. Ne lève jamais d'erreur. */
export async function envoyerImageSeance(seance: Seance, titre: string): Promise<IssueEnvoi> {
  try {
    const blob = await imageDeSeance(seance, titre);
    if (!blob) return 'impossible';
    const nom = `${titre.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'seance'}.png`;
    const fichier = new File([blob], nom, { type: 'image/png' });
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichier] })) {
      try {
        await navigator.share({ files: [fichier], title: titre });
        return 'partage';
      } catch (e) {
        // Fermé sans choisir : rien n'est parti, rien à dire de plus.
        if (e instanceof DOMException && e.name === 'AbortError') return 'partage';
      }
    }
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    return 'telecharge';
  } catch {
    return 'impossible';
  }
}
