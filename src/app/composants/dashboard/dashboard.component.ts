// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isSuperAdmin } from '../../shared/auth.util';
import { Paiement, OperateurPaiement, OPERATEURS } from '../../shared/paiement.util';

export interface Requete {
  _id: string;
  nom: string;
  email: string;
  sujet: string;
  message: string;
  createdAt: string;
  __v: number;
}

export interface StatOperateur {
  operateur: OperateurPaiement;
  libelle: string;
  couleur: string;
  nombre: number;
  pourcentage: number;
  reussies: number;
  tauxReussite: number;
}

export interface Statistiques {
  totalFideles: number;
  totalActualites: number;
  totalRequetes: number;
  totalRequetesPriere: number;
  totalDonsUSD: number;
  totalDonsCDF: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private urlRequete = "https://flechissons.com/requete/";
  private urlArticle = "https://flechissons.com/article";
  private urlUser = "https://flechissons.com/user";
  private urlDonation = "https://flechissons.com/api/pawapay/admin/paiements";

  // Liste des requêtes
  toutesLesRequetes: Requete[] = [];
  dernieresRequetes: Requete[] = [];

  // Statistiques
  statistiques: Statistiques = {
    totalFideles: 0,
    totalActualites: 0,
    totalRequetes: 0,
    totalRequetesPriere: 0,
    totalDonsUSD: 0,
    totalDonsCDF: 0
  };

  // Analyse des transactions par opérateur
  paiements: Paiement[] = [];
  analyseReussiesSeulement: boolean = false;

  // Couleurs des opérateurs
  private readonly couleursOperateurs: Record<OperateurPaiement, string> = {
    mpesa: '#16A34A',
    orange: '#F97316',
    airtel: '#DC2626'
  };

  // Date du jour
  dateAujourdhui: string = '';

  // Bannière "Commencer à publier" (ouverte en grand, ou repliée en bande fine)
  bannerOuverte: boolean = true;

  // Les requêtes de prière sont réservées au superadmin
  estSuperAdmin: boolean = false;

  // Indicateurs de chargement
  chargement: boolean = false;
  erreur: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.dateAujourdhui = this.formaterDate(new Date());
    this.bannerOuverte = localStorage.getItem('dashboardBannerFerme') !== 'true';
    this.estSuperAdmin = isSuperAdmin();
    this.chargerToutesLesDonnees();
  }

  /**
   * Replie la bannière "Commencer à publier" en une bande fine (préférence mémorisée)
   */
  fermerBanniere(): void {
    this.bannerOuverte = false;
    localStorage.setItem('dashboardBannerFerme', 'true');
  }

  /**
   * Rouvre la bannière "Commencer à publier"
   */
  ouvrirBanniere(): void {
    this.bannerOuverte = true;
    localStorage.setItem('dashboardBannerFerme', 'false');
  }

  /**
   * En-têtes d'authentification (route /requete réservée au superadmin côté backend)
   */
  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  /**
   * Charge toutes les données nécessaires
   */
  chargerToutesLesDonnees(): void {
    // Éviter les appels multiples pendant le chargement
    if (this.chargement) {
      return;
    }

    this.chargement = true;
    this.erreur = null;

    // Nombre de réponses attendues (les requêtes sont réservées au superadmin)
    let reponsesRecues = 0;
    const totalAppels = this.estSuperAdmin ? 4 : 3;

    const verifierFinChargement = () => {
      reponsesRecues++;
      if (reponsesRecues === totalAppels) {
        this.chargement = false;
      }
    };

    // Charger les requêtes (superadmin uniquement)
    if (this.estSuperAdmin) {
      this.http.get<Requete[]>(this.urlRequete, { headers: this.authHeaders() }).subscribe({
        next: (data) => {
          this.toutesLesRequetes = data.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          this.dernieresRequetes = this.toutesLesRequetes.slice(0, 5);
          this.mettreAJourStatistiquesRequetes();
          verifierFinChargement();
        },
        error: (err) => {
          console.error('Erreur lors du chargement des requêtes:', err);
          this.erreur = 'Impossible de charger les données. Veuillez réessayer.';
          this.chargement = false;
        }
      });
    }

    // Charger les articles
    this.http.get<any>(this.urlArticle).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.statistiques.totalActualites = data.length;
        } else if (data && data.articles && Array.isArray(data.articles)) {
          this.statistiques.totalActualites = data.articles.length;
        } else if (data && data.total) {
          this.statistiques.totalActualites = data.total;
        }
        verifierFinChargement();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des articles:', err);
        verifierFinChargement();
      }
    });

    // Charger les utilisateurs
    this.http.get<any>(this.urlUser).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.statistiques.totalFideles = data.length;
        } else if (data) {
          if (data.total) {
            this.statistiques.totalFideles = data.total;
          } else if (data.utilisateurs && Array.isArray(data.utilisateurs)) {
            this.statistiques.totalFideles = data.utilisateurs.length;
          }
        }
        verifierFinChargement();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        verifierFinChargement();
      }
    });

    // Charger les donations
    this.http.get<any[]>(this.urlDonation, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.paiements = Array.isArray(data) ? data : [];

        // Seuls les paiements réussis comptent dans les totaux
        const donations = this.paiements.filter(d => d.statut === 'reussi');
        this.statistiques.totalDonsUSD = donations
          .filter(d => d.devise === 'USD')
          .reduce((somme, d) => somme + (d.montant || 0), 0);
        this.statistiques.totalDonsCDF = donations
          .filter(d => d.devise === 'CDF')
          .reduce((somme, d) => somme + (d.montant || 0), 0);
        verifierFinChargement();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des donations:', err);
        verifierFinChargement();
      }
    });
  }

  /**
   * Transactions prises en compte dans l'analyse par opérateur
   */
  get paiementsAnalyses(): Paiement[] {
    return this.analyseReussiesSeulement
      ? this.paiements.filter(p => p.statut === 'reussi')
      : this.paiements;
  }

  /**
   * Répartition des transactions par opérateur, en pourcentage, de la plus utilisée à la moins utilisée
   */
  get statsOperateurs(): StatOperateur[] {
    const analyses = this.paiementsAnalyses;
    const total = analyses.length;

    return OPERATEURS
      .map(({ valeur, libelle }) => {
        const nombre = analyses.filter(p => p.operateur === valeur).length;
        const tentatives = this.paiements.filter(p => p.operateur === valeur);
        const reussies = tentatives.filter(p => p.statut === 'reussi').length;

        return {
          operateur: valeur,
          libelle,
          couleur: this.couleursOperateurs[valeur],
          nombre,
          pourcentage: total ? (nombre / total) * 100 : 0,
          reussies,
          tauxReussite: tentatives.length ? (reussies / tentatives.length) * 100 : 0
        };
      })
      .sort((a, b) => b.nombre - a.nombre);
  }

  /**
   * Opérateur le plus utilisé (null s'il n'y a aucune transaction ou en cas d'égalité en tête)
   */
  get operateurLeader(): StatOperateur | null {
    const [premier, second] = this.statsOperateurs;
    if (!premier || premier.nombre === 0 || (second && second.nombre === premier.nombre)) {
      return null;
    }
    return premier;
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
   * Formate un montant selon sa devise (USD ou CDF)
   */
  formatMontant(montant: number, devise: 'USD' | 'CDF'): string {
    try {
      const locale = devise === 'CDF' ? 'fr-CD' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: devise,
        maximumFractionDigits: 0
      }).format(montant || 0);
    } catch {
      return `${montant} ${devise}`;
    }
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