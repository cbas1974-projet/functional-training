// Génération de sons de cloche de boxe avec Web Audio API
export class BellSound {
  private audioContext: AudioContext;

  constructor() {
    const Contexte =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new Contexte();
  }

  // Les navigateurs bloquent l'audio tant qu'un geste utilisateur n'a pas
  // « débloqué » le contexte : à appeler dans un gestionnaire de clic.
  unlock(): void {
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  // Bip court pour guider le tempo (montée / descente) ou annoncer le départ
  playTick(type: 'monte' | 'descend' | 'pret' = 'pret'): void {
    const now = this.audioContext.currentTime;
    const frequence = type === 'monte' ? 880 : type === 'descend' ? 440 : 660;
    const duree = type === 'pret' ? 0.12 : 0.08;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequence, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + duree);

    oscillator.start(now);
    oscillator.stop(now + duree);
  }

  // Son de cloche pour début/fin de round
  playBell(type: 'start' | 'end' = 'start'): void {
    const now = this.audioContext.currentTime;

    // Créer un oscillateur pour le son métallique
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Fréquence de base pour le son de cloche
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.5);

    // Envelope pour le son
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    oscillator.start(now);
    oscillator.stop(now + 1.5);

    if (type === 'end') {
      // Triple coup pour la fin
      setTimeout(() => this.playSingleBell(), 200);
      setTimeout(() => this.playSingleBell(), 400);
    }
  }

  // Son simple de cloche
  private playSingleBell(): void {
    const now = this.audioContext.currentTime;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    oscillator.start(now);
    oscillator.stop(now + 0.8);
  }

  // Bip de compte à rebours (10 dernières secondes)
  playCountdown(): void {
    const now = this.audioContext.currentTime;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(600, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  // Alarme pour les validations
  playWarning(): void {
    const now = this.audioContext.currentTime;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.setValueAtTime(550, now + 0.1);
    oscillator.frequency.setValueAtTime(440, now + 0.2);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
}

export const bellSound = new BellSound();
