import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

export interface Requete {
  _id: string;
  nom: string;
  email: string;
  sujet: string;
  message: string;
  createdAt: string;
  __v: number;
}

@Component({
  selector: 'app-requetes',
  templateUrl: './requetes.component.html',
  styleUrl: './requetes.component.css'
})
export class RequetesComponent implements OnInit {
  private urlRequete = "https://flechissons.com/requete/";
  
  // Liste complète des requêtes
  toutesLesRequetes: Requete[] = [];
  
  // Liste filtrée (pour l'affichage)
  requetesFiltrees: Requete[] = [];
  
  // Terme de recherche
  termeRecherche: string = '';
  
  // Pagination
  pageActuelle: number = 1;
  itemsParPage: number = 15;
  totalPages: number = 0;
  
  // Indicateurs de chargement
  chargement: boolean = false;
  erreur: string | null = null;

  // Gestion de la suppression
  requeteASupprimer: Requete | null = null;
  modalSuppressionOuverte: boolean = false;
  suppressionEnCours: boolean = false;

  // Requête actuellement affichée dans le panneau de détail
  requeteSelectionnee: Requete | null = null;

  // Id de la requête à ouvrir automatiquement (venant du dashboard, via ?id=...)
  private idARevelerDepuisRoute: string | null = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.idARevelerDepuisRoute = params['id'] || null;
      this.appliquerSelectionDepuisRoute();
    });

    this.chargerRequetes();
  }

  /**
   * En-têtes d'authentification (routes réservées au superadmin côté backend)
   */
  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  /**
   * Sélectionne automatiquement la requête ciblée par le paramètre d'URL "id"
   * (utilisé quand on arrive depuis le dashboard en cliquant sur un message)
   */
  appliquerSelectionDepuisRoute(): void {
    if (!this.idARevelerDepuisRoute) return;

    const requete = this.toutesLesRequetes.find(r => r._id === this.idARevelerDepuisRoute);
    if (!requete) return;

    this.requeteSelectionnee = requete;

    const index = this.requetesFiltrees.findIndex(r => r._id === requete._id);
    if (index >= 0) {
      this.pageActuelle = Math.floor(index / this.itemsParPage) + 1;
    }
  }

  /**
   * Charge les requêtes depuis l'API et les trie par date (plus récent en premier)
   */
  chargerRequetes(): void {
    this.chargement = true;
    this.erreur = null;

    this.http.get<Requete[]>(this.urlRequete, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        // Trier par date décroissante (plus récent en premier)
        this.toutesLesRequetes = data.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Initialiser les requêtes filtrées
        this.requetesFiltrees = [...this.toutesLesRequetes];
        this.calculerTotalPages();
        this.chargement = false;
        this.appliquerSelectionDepuisRoute();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erreur lors du chargement des requêtes:', err);
        this.erreur = err.status === 403
          ? 'Accès réservé au superadmin.'
          : 'Impossible de charger les requêtes. Veuillez réessayer.';
        this.chargement = false;
      }
    });
  }

  /**
   * Filtre les requêtes en fonction du terme de recherche
   */
  filtrerRequetes(): void {
    const terme = this.termeRecherche.toLowerCase().trim();
    
    if (!terme) {
      this.requetesFiltrees = [...this.toutesLesRequetes];
    } else {
      this.requetesFiltrees = this.toutesLesRequetes.filter(requete => 
        requete.nom.toLowerCase().includes(terme) ||
        requete.message.toLowerCase().includes(terme) ||
        requete.sujet.toLowerCase().includes(terme) ||
        requete.email.toLowerCase().includes(terme)
      );
    }
    
    // Réinitialiser la pagination après un filtre
    this.pageActuelle = 1;
    this.calculerTotalPages();
  }

  /**
   * Calcule le nombre total de pages
   */
  calculerTotalPages(): void {
    this.totalPages = Math.ceil(this.requetesFiltrees.length / this.itemsParPage);
    if (this.totalPages === 0) this.totalPages = 1;
  }

  /**
   * Récupère les requêtes de la page actuelle
   */
  get requetesPage(): Requete[] {
    const debut = (this.pageActuelle - 1) * this.itemsParPage;
    const fin = debut + this.itemsParPage;
    return this.requetesFiltrees.slice(debut, fin);
  }

  /**
   * Change de page
   */
  changerPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageActuelle = page;
  }

  /**
   * Sélectionne une requête pour l'afficher dans le panneau de détail
   */
  selectionnerRequete(requete: Requete): void {
    this.requeteSelectionnee = requete;
  }

  /**
   * Revient à la liste (vue mobile)
   */
  fermerDetail(): void {
    this.requeteSelectionnee = null;
  }

  /**
   * Ouvre la modale de confirmation de suppression
   */
  ouvrirModalSuppression(requete: Requete): void {
    this.requeteASupprimer = requete;
    this.modalSuppressionOuverte = true;
    document.body.style.overflow = 'hidden'; // Empêche le scroll
  }

  /**
   * Ferme la modale de suppression
   */
  fermerModalSuppression(): void {
    this.modalSuppressionOuverte = false;
    this.requeteASupprimer = null;
    this.suppressionEnCours = false;
    document.body.style.overflow = ''; // Réactive le scroll
  }

  /**
   * Supprime une requête
   */
  supprimerRequete(): void {
    if (!this.requeteASupprimer) return;

    this.suppressionEnCours = true;

    this.http.delete(`${this.urlRequete}${this.requeteASupprimer._id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        // Si la requête supprimée était affichée dans le détail, on referme le panneau
        if (this.requeteSelectionnee?._id === this.requeteASupprimer!._id) {
          this.requeteSelectionnee = null;
        }

        // Supprimer la requête de la liste complète
        this.toutesLesRequetes = this.toutesLesRequetes.filter(
          req => req._id !== this.requeteASupprimer!._id
        );

        // Mettre à jour les requêtes filtrées
        this.filtrerRequetes();

        // Vérifier si la page actuelle est vide après suppression
        if (this.requetesPage.length === 0 && this.pageActuelle > 1) {
          this.pageActuelle--;
        }

        // Fermer la modale
        this.fermerModalSuppression();
      },
      error: (err) => {
        console.error('Erreur lors de la suppression:', err);
        this.erreur = 'Impossible de supprimer la requête. Veuillez réessayer.';
        this.suppressionEnCours = false;
        
        // Fermer la modale après un délai
        setTimeout(() => {
          this.fermerModalSuppression();
        }, 3000);
      }
    });
  }

  /**
   * Génère les initiales du nom
   */
  getInitiales(nom: string): string {
    if (!nom) return '?';
    const noms = nom.split(' ');
    if (noms.length === 1) {
      return noms[0].substring(0, 2).toUpperCase();
    }
    return (noms[0].charAt(0) + noms[noms.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Retourne une couleur aléatoire mais cohérente pour un nom
   */
  getCouleurAvatar(nom: string): string {
    const couleurs = [
      'bg-orange-100 text-orange-600',
      'bg-blue-100 text-blue-600',
      'bg-purple-100 text-purple-600',
      'bg-green-100 text-green-600',
      'bg-pink-100 text-pink-600',
      'bg-red-100 text-red-600',
      'bg-indigo-100 text-indigo-600',
      'bg-yellow-100 text-yellow-600',
      'bg-teal-100 text-teal-600',
      'bg-cyan-100 text-cyan-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < nom.length; i++) {
      hash = nom.charCodeAt(i) + ((hash << 5) - hash);
    }
    return couleurs[Math.abs(hash) % couleurs.length];
  }

  /**
   * Formate la date en "Il y a X min/heure/jour"
   */
  getTempsEcoule(date: string): string {
    const maintenant = new Date();
    const dateRequete = new Date(date);
    const diffMs = maintenant.getTime() - dateRequete.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHeure = Math.floor(diffMin / 60);
    const diffJour = Math.floor(diffHeure / 24);

    if (diffJour > 0) {
      return diffJour === 1 ? 'Hier' : `Il y a ${diffJour} jours`;
    } else if (diffHeure > 0) {
      return diffHeure === 1 ? 'Il y a 1 heure' : `Il y a ${diffHeure} heures`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? 'Il y a 1 minute' : `Il y a ${diffMin} minutes`;
    } else {
      return 'À l\'instant';
    }
  }

  /**
   * Formate la date complète (ex: 3 octobre 2026 à 14:32)
   */
  getDateComplete(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Construit le lien mailto pour répondre à l'auteur de la requête
   */
  getLienReponse(requete: Requete): string {
    const sujet = encodeURIComponent(`Re: ${requete.sujet}`);
    return `mailto:${requete.email}?subject=${sujet}`;
  }

  /**
   * Retourne le nombre total de requêtes
   */
  get totalRequetes(): number {
    return this.requetesFiltrees.length;
  }

  /**
   * Retourne la plage affichée
   */
  get plageAffichage(): string {
    const debut = (this.pageActuelle - 1) * this.itemsParPage + 1;
    const fin = Math.min(debut + this.itemsParPage - 1, this.totalRequetes);
    if (this.totalRequetes === 0) return '0';
    return `${debut}–${fin}`;
  }

  /**
   * Génère la liste des pages pour la pagination
   */
  get pages(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let debut = Math.max(1, this.pageActuelle - Math.floor(maxPages / 2));
    let fin = Math.min(this.totalPages, debut + maxPages - 1);
    
    if (fin - debut + 1 < maxPages) {
      debut = Math.max(1, fin - maxPages + 1);
    }
    
    for (let i = debut; i <= fin; i++) {
      pages.push(i);
    }
    return pages;
  }
}