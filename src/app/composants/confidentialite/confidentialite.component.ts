// confidentialite.component.ts
// Page publique (hors espace admin) : politique de confidentialité de l'application mobile,
// dont le lien est donné à l'App Store et au Google Play
import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';
import { ThemeService } from '../../shared/theme.service';

@Component({
  selector: 'app-confidentialite',
  templateUrl: './confidentialite.component.html',
  styleUrl: './confidentialite.component.css'
})
export class ConfidentialiteComponent implements AfterViewInit, OnDestroy {

  readonly emailContact = 'contact@flechissons.com';
  readonly dateMiseAJour = '12 octobre 2026';
  readonly annee = new Date().getFullYear();

  readonly sections = [
    { id: 'qui', titre: 'Qui sommes-nous' },
    { id: 'donnees', titre: 'Données recueillies' },
    { id: 'utilisation', titre: 'Utilisation' },
    { id: 'partage', titre: 'Partage' },
    { id: 'conservation', titre: 'Durée de conservation' },
    { id: 'securite', titre: 'Sécurité' },
    { id: 'droits', titre: 'Vos droits' },
    { id: 'enfants', titre: 'Enfants' },
    { id: 'modifications', titre: 'Modifications' },
    { id: 'contact', titre: 'Contact' }
  ];

  readonly liensNavigation = [
    { id: 'donnees', libelle: 'Données' },
    { id: 'utilisation', libelle: 'Utilisation' },
    { id: 'partage', libelle: 'Partage' },
    { id: 'droits', libelle: 'Vos droits' },
    { id: 'contact', libelle: 'Contact' }
  ];

  menuOuvert = false;
  sectionActive = 'qui';
  emailCopie = false;

  private observateur?: IntersectionObserver;
  private minuterieCopie: any;

  constructor(
    public themeService: ThemeService,
    private hote: ElementRef<HTMLElement>
  ) {}

  ngAfterViewInit(): void {
    // Surligne dans le sommaire la section en cours de lecture
    if (!('IntersectionObserver' in window)) return;
    this.observateur = new IntersectionObserver(entrees => {
      for (const entree of entrees) {
        if (entree.isIntersecting) this.sectionActive = entree.target.id;
      }
    }, { rootMargin: '-30% 0px -60% 0px' });

    this.hote.nativeElement
      .querySelectorAll('article section')
      .forEach(section => this.observateur!.observe(section));
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
    clearTimeout(this.minuterieCopie);
  }

  // Défilement manuel : avec <base href="/">, un simple href="#id" renverrait vers la racine du site
  allerA(id: string, event?: Event): void {
    event?.preventDefault();
    this.menuOuvert = false;
    const cible = id === 'haut' ? null : document.getElementById(id);
    if (cible) {
      cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  basculerMenu(): void {
    this.menuOuvert = !this.menuOuvert;
  }

  copierEmail(element: HTMLElement): void {
    const selectionnerTexte = () => {
      const plage = document.createRange();
      plage.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(plage);
    };

    if (!navigator.clipboard?.writeText) {
      selectionnerTexte();
      return;
    }
    navigator.clipboard.writeText(this.emailContact).then(() => {
      this.emailCopie = true;
      clearTimeout(this.minuterieCopie);
      this.minuterieCopie = setTimeout(() => this.emailCopie = false, 2000);
    }, selectionnerTexte);
  }
}
