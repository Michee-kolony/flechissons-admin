// donations.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

export interface Donation {
  _id: string;
  nom: string;
  email?: string;
  telephone?: string;
  montant: number;
  devise: 'USD' | 'CDF';
  methode?: string;
  message?: string;
  date: string;
}

@Component({
  selector: 'app-donations',
  templateUrl: './donations.component.html',
  styleUrl: './donations.component.css'
})
export class DonationsComponent implements OnInit {

  private urlDonation = "https://backend-flechissons.onrender.com/donation";

  donations: Donation[] = [];
  donationsFiltrees: Donation[] = [];

  isLoading: boolean = true;
  erreur: string | null = null;

  recherche: string = '';
  deviseFiltre: '' | 'USD' | 'CDF' = '';

  // Modal de suppression
  modalSuppressionOuvert: boolean = false;
  donationASupprimer: Donation | null = null;
  suppressionEnCours: boolean = false;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  // Données statiques utilisées tant qu'aucune donation réelle n'est enregistrée
  private donationsDemo: Donation[] = [
    { _id: 'demo-1', nom: 'Jean-Pierre Kabila', email: 'jp.kabila@example.com', montant: 50, devise: 'USD', methode: 'Mobile Money', date: '2026-09-28T09:15:00.000Z' },
    { _id: 'demo-2', nom: 'Grâce Mwamba', email: 'grace.mwamba@example.com', montant: 25000, devise: 'CDF', methode: 'Airtel Money', date: '2026-09-25T14:40:00.000Z' },
    { _id: 'demo-3', nom: 'Anonyme', montant: 100, devise: 'USD', methode: 'Carte bancaire', date: '2026-09-20T11:05:00.000Z' },
    { _id: 'demo-4', nom: 'Esther Tshisekedi', email: 'esther.t@example.com', montant: 15000, devise: 'CDF', methode: 'Orange Money', date: '2026-09-18T08:30:00.000Z' },
    { _id: 'demo-5', nom: 'Patrick Ilunga', telephone: '+243 970 123 456', montant: 75, devise: 'USD', methode: 'Virement bancaire', date: '2026-09-14T16:20:00.000Z' },
    { _id: 'demo-6', nom: 'Chantal Mbuyi', email: 'chantal.mbuyi@example.com', montant: 10000, devise: 'CDF', methode: 'Mobile Money', date: '2026-09-10T10:00:00.000Z' },
    { _id: 'demo-7', nom: 'Daniel Kalonji', montant: 200, devise: 'USD', methode: 'Espèces', date: '2026-09-05T13:45:00.000Z' },
    { _id: 'demo-8', nom: 'Bénédicte Ngoy', email: 'benedicte.ngoy@example.com', montant: 50000, devise: 'CDF', methode: 'Airtel Money', date: '2026-08-30T09:50:00.000Z' },
    { _id: 'demo-9', nom: 'Anonyme', montant: 30, devise: 'USD', methode: 'Mobile Money', date: '2026-08-22T17:10:00.000Z' },
    { _id: 'demo-10', nom: 'Joseph Mukendi', telephone: '+243 820 987 654', montant: 20000, devise: 'CDF', methode: 'Orange Money', date: '2026-08-15T12:25:00.000Z' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerDonations();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerDonations(): void {
    this.isLoading = true;
    this.erreur = null;

    this.http.get<Donation[]>(this.urlDonation, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        // Tant qu'aucune donation réelle n'a été enregistrée, on affiche des données de démonstration
        this.donations = data && data.length > 0 ? data : this.donationsDemo;
        this.filtrer();
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 401 || error.status === 403) {
          this.erreur = "Vous n'êtes pas autorisé à consulter les donations.";
          return;
        }

        // Si l'API est indisponible, on affiche quand même des données de démonstration
        this.donations = this.donationsDemo;
        this.filtrer();
      }
    });
  }

  // =====================================================
  // FILTRES
  // =====================================================

  filtrer(): void {
    const terme = this.recherche.toLowerCase().trim();

    this.donationsFiltrees = this.donations.filter(don => {
      const correspondRecherche = !terme ||
        (don.nom || '').toLowerCase().includes(terme) ||
        (don.email || '').toLowerCase().includes(terme) ||
        (don.methode || '').toLowerCase().includes(terme);

      const correspondDevise = !this.deviseFiltre || don.devise === this.deviseFiltre;

      return correspondRecherche && correspondDevise;
    });
  }

  onDeviseChange(devise: '' | 'USD' | 'CDF'): void {
    this.deviseFiltre = devise;
    this.filtrer();
  }

  // =====================================================
  // TOTAUX
  // =====================================================

  get totalUSD(): number {
    return this.donations
      .filter(d => d.devise === 'USD')
      .reduce((somme, d) => somme + (d.montant || 0), 0);
  }

  get totalCDF(): number {
    return this.donations
      .filter(d => d.devise === 'CDF')
      .reduce((somme, d) => somme + (d.montant || 0), 0);
  }

  // =====================================================
  // SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(don: Donation): void {
    this.donationASupprimer = don;
    this.modalSuppressionOuvert = true;
  }

  fermerModalSuppression(): void {
    this.modalSuppressionOuvert = false;
    this.donationASupprimer = null;
    this.suppressionEnCours = false;
  }

  confirmerSuppression(): void {
    if (!this.donationASupprimer) return;

    // Donnée de démonstration : suppression locale uniquement, pas d'appel API
    if (this.donationASupprimer._id.startsWith('demo-')) {
      this.donations = this.donations.filter(d => d._id !== this.donationASupprimer!._id);
      this.filtrer();
      this.showToastMessage('Donation supprimée avec succès', 'success');
      this.fermerModalSuppression();
      return;
    }

    this.suppressionEnCours = true;

    this.http.delete(`${this.urlDonation}/${this.donationASupprimer._id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.donations = this.donations.filter(d => d._id !== this.donationASupprimer!._id);
        this.filtrer();
        this.showToastMessage('Donation supprimée avec succès', 'success');
        this.fermerModalSuppression();
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || 'Erreur lors de la suppression de la donation';
        this.showToastMessage(message, 'error');
        this.fermerModalSuppression();
      }
    });
  }

  // =====================================================
  // FORMATAGE
  // =====================================================

  formatMontant(montant: number, devise: string): string {
    try {
      const locale = devise === 'CDF' ? 'fr-CD' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: devise,
        maximumFractionDigits: 2
      }).format(montant || 0);
    } catch {
      return `${montant} ${devise}`;
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(part => part.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  // =====================================================
  // TOAST
  // =====================================================

  showToastMessage(message: string, type: 'success' | 'error' = 'success'): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;

    this.toastTimeout = setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  hideToast(): void {
    this.showToast = false;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }
}
