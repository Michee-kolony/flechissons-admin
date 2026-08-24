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

export interface Statistiques {
  totalFideles: number;
  totalActualites: number;
  totalRequetes: number;
  totalRequetesPriere: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private urlRequete = "https://backend-flechissons.onrender.com/requete/";
  private urlArticle = "https://backend-flechissons.onrender.com/article";
  private urlUser = "https://backend-flechissons.onrender.com/user";
  
  // Liste des requêtes
  toutesLesRequetes: Requete[] = [];
  dernieresRequetes: Requete[] = [];
  
  // Statistiques
  statistiques: Statistiques = {
    totalFideles: 0,
    totalActualites: 0,
    totalRequetes: 0,
    totalRequetesPriere: 0
  };
  
  // Date du jour
  dateAujourdhui: string = '';
  
  // Indicateurs de chargement
  chargement: boolean = false;
  erreur: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.dateAujourdhui = this.formaterDate(new Date());
    this.chargerToutesLesDonnees();
  }

  /**
   * Charge toutes les données nécessaires
   */
  chargerToutesLesDonnees(): void {
    this.chargement = true;
    this.erreur = null;

    // Charger les requêtes
    this.http.get<Requete[]>(this.urlRequete).subscribe({
      next: (data) => {
        this.toutesLesRequetes = data.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.dernieresRequetes = this.toutesLesRequetes.slice(0, 5);
        
        // Mettre à jour les statistiques des requêtes
        this.mettreAJourStatistiquesRequetes();
        
        // Vérifier si toutes les données sont chargées
        this.verifierChargementComplet();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des requêtes:', err);
        this.erreur = 'Impossible de charger les données. Veuillez réessayer.';
        this.chargement = false;
      }
    });

    // Charger les articles
    this.http.get<any>(this.urlArticle).subscribe({
      next: (data) => {
        // Si l'API retourne un tableau d'articles
        if (Array.isArray(data)) {
          this.statistiques.totalActualites = data.length;
        } 
        // Si l'API retourne un objet avec une propriété contenant les articles
        else if (data && data.articles && Array.isArray(data.articles)) {
          this.statistiques.totalActualites = data.articles.length;
        }
        // Si l'API retourne un objet avec une propriété total
        else if (data && data.total) {
          this.statistiques.totalActualites = data.total;
        }
        
        // Vérifier si toutes les données sont chargées
        this.verifierChargementComplet();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des articles:', err);
        // Ne pas bloquer l'interface si les articles ne se chargent pas
        this.verifierChargementComplet();
      }
    });

    // Charger les utilisateurs
    this.http.get<any>(this.urlUser).subscribe({
      next: (data) => {
        // Si l'API retourne un tableau d'utilisateurs
        if (Array.isArray(data)) {
          this.statistiques.totalFideles = data.length;
        }
        // Si l'API retourne un objet avec une propriété total ou utilisateurs
        else if (data) {
          if (data.total) {
            this.statistiques.totalFideles = data.total;
          } else if (data.utilisateurs && Array.isArray(data.utilisateurs)) {
            this.statistiques.totalFideles = data.utilisateurs.length;
          }
        }
        
        // Vérifier si toutes les données sont chargées
        this.verifierChargementComplet();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        // Ne pas bloquer l'interface si les utilisateurs ne se chargent pas
        this.verifierChargementComplet();
      }
    });
  }

  /**
   * Vérifie si toutes les données sont chargées
   */
  verifierChargementComplet(): void {
    // Ici on peut ajouter une logique pour vérifier que toutes les données sont chargées
    // Pour simplifier, on désactive le chargement après un délai
    setTimeout(() => {
      this.chargement = false;
    }, 500);
  }

  /**
   * Met à jour les statistiques des requêtes
   */
  mettreAJourStatistiquesRequetes(): void {
    this.statistiques.totalRequetes = this.toutesLesRequetes.length;
    this.statistiques.totalRequetesPriere = this.toutesLesRequetes.filter(
      req => req.sujet.toLowerCase().includes('prière') || 
             req.sujet.toLowerCase().includes('priere')
    ).length;
  }

  /**
   * Formate une date en "11 Août 2026"
   */
  formaterDate(date: Date): string {
    const jours = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const jour = date.getDate();
    const mois = jours[date.getMonth()];
    const annee = date.getFullYear();
    return `${jour} ${mois} ${annee}`;
  }

  /**
   * Calcule le temps écoulé depuis la création
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
      return diffJour === 1 ? '1 j' : `${diffJour} j`;
    } else if (diffHeure > 0) {
      return diffHeure === 1 ? '1 h' : `${diffHeure} h`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? '1 min' : `${diffMin} min`;
    } else {
      return 'À l\'instant';
    }
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
      'bg-orange-50 text-orange-700',
      'bg-blue-50 text-blue-700',
      'bg-purple-50 text-purple-700',
      'bg-green-50 text-green-700',
      'bg-pink-50 text-pink-700',
      'bg-red-50 text-red-700',
      'bg-indigo-50 text-indigo-700',
      'bg-yellow-50 text-yellow-700',
      'bg-teal-50 text-teal-700',
      'bg-cyan-50 text-cyan-700'
    ];
    
    let hash = 0;
    for (let i = 0; i < nom.length; i++) {
      hash = nom.charCodeAt(i) + ((hash << 5) - hash);
    }
    return couleurs[Math.abs(hash) % couleurs.length];
  }

  /**
   * Récupère les requêtes de prière uniquement
   */
  get requetesPriere(): Requete[] {
    return this.toutesLesRequetes.filter(
      req => req.sujet.toLowerCase().includes('prière') || 
             req.sujet.toLowerCase().includes('priere')
    );
  }
}