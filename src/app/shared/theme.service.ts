// theme.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

const CLE_STOCKAGE = 'theme';

/**
 * Gère le mode clair / sombre de l'application.
 * Le thème est appliqué via la classe "dark" sur <html>
 * (déjà posée avant le démarrage d'Angular par le script de index.html).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly theme$ = new BehaviorSubject<Theme>(this.lireThemeInitial());

  /** Émet le thème courant puis chaque changement (utile pour redessiner les graphiques) */
  readonly changements = this.theme$.asObservable();

  constructor() {
    this.appliquer(this.theme$.value);

    // Suit la préférence du système tant que l'utilisateur n'a rien choisi
    window.matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener?.('change', (e) => {
        if (!this.lireChoixUtilisateur()) {
          this.definir(e.matches ? 'dark' : 'light', false);
        }
      });
  }

  get theme(): Theme {
    return this.theme$.value;
  }

  get estSombre(): boolean {
    return this.theme$.value === 'dark';
  }

  basculer(): void {
    this.definir(this.estSombre ? 'light' : 'dark');
  }

  definir(theme: Theme, memoriser = true): void {
    if (memoriser) {
      try {
        localStorage.setItem(CLE_STOCKAGE, theme);
      } catch {
        // Stockage indisponible (navigation privée) : le thème vaut pour la session
      }
    }
    this.appliquer(theme);
    this.theme$.next(theme);
  }

  private appliquer(theme: Theme): void {
    const racine = document.documentElement;
    racine.classList.toggle('dark', theme === 'dark');
    racine.style.colorScheme = theme;
  }

  private lireChoixUtilisateur(): Theme | null {
    try {
      const valeur = localStorage.getItem(CLE_STOCKAGE);
      return valeur === 'dark' || valeur === 'light' ? valeur : null;
    } catch {
      return null;
    }
  }

  private lireThemeInitial(): Theme {
    return this.lireChoixUtilisateur()
      ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
}

/**
 * Couleurs des graphiques Chart.js selon le thème
 * (les couleurs de données, orange en tête, restent celles de la marque).
 */
export function couleursGraphique(sombre: boolean) {
  return sombre
    ? {
        texteFort: '#FAFAFA',
        texte: '#D4D4D4',
        texteDoux: '#737373',
        grille: 'rgba(255, 255, 255, 0.06)',
        separation: '#0A0A0A',
        vide: '#262626',
        videSurvol: '#404040',
        infobulleFond: 'rgba(23, 23, 23, 0.92)',
        infobulleBordure: 'rgba(255, 255, 255, 0.1)'
      }
    : {
        texteFort: '#111827',
        texte: '#4B5563',
        texteDoux: '#9CA3AF',
        grille: '#F3F4F6',
        separation: '#ffffff',
        vide: '#E5E7EB',
        videSurvol: '#D1D5DB',
        infobulleFond: '#111827',
        infobulleBordure: 'transparent'
      };
}
