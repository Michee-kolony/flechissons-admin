import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
  private urlRequete = "https://backend-flechissons.onrender.com/requete/";
  
  // Liste complète des requêtes
  toutesLesRequetes: Requete[] = [];
  
  // Liste filtrée (pour l'affichage)
  requetesFiltrees: Requete[] = [];
  
  // Terme de recherche
  termeRecherche: string = '';
  
  // Pagination
  pageActuelle: number = 1;
  itemsParPage: number = 5;
  totalPages: number = 0;
  
  // Indicateurs de chargement
  chargement: boolean = false;
  erreur: string | null = null;

  // Gestion de la suppression
  requeteASupprimer: Requete | null = null;
  modalSuppressionOuverte: boolean = false;
  suppressionEnCours: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerRequetes();
  }

  /**
   * Charge les requêtes depuis l'API et les trie par date (plus récent en premier)
   */
  chargerRequetes(): void {
    this.chargement = true;
    this.erreur = null;

    this.http.get<Requete[]>(this.urlRequete).subscribe({
      next: (data) => {
        // Trier par date décroissante (plus récent en premier)
        this.toutesLesRequetes = data.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Initialiser les requêtes filtrées
        this.requetesFiltrees = [...this.toutesLesRequetes];
        this.calculerTotalPages();
        this.chargement = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des requêtes:', err);
        this.erreur = 'Impossible de charger les requêtes. Veuillez réessayer.';
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

    this.http.delete(`${this.urlRequete}${this.requeteASupprimer._id}`).subscribe({
      next: () => {
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