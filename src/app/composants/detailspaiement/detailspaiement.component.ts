// detailspaiement.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Paiement, URL_PAIEMENTS,
  libelleStatut, classeStatut, iconeStatut, libelleType, libelleOperateur, nomFidele,
  formatMontant, formatDate, formatTelephone, getInitials
} from '../../shared/paiement.util';

@Component({
  selector: 'app-detailspaiement',
  templateUrl: './detailspaiement.component.html',
  styleUrl: './detailspaiement.component.css'
})
export class DetailspaiementComponent implements OnInit {

  paiement: Paiement | null = null;

  isLoading: boolean = true;
  erreur: string | null = null;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  // Utilisés par le template
  readonly libelleStatut = libelleStatut;
  readonly classeStatut = classeStatut;
  readonly iconeStatut = iconeStatut;
  readonly libelleType = libelleType;
  readonly libelleOperateur = libelleOperateur;
  readonly nomFidele = nomFidele;
  readonly formatMontant = formatMontant;
  readonly formatDate = formatDate;
  readonly formatTelephone = formatTelephone;
  readonly getInitials = getInitials;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerPaiement();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerPaiement(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.isLoading = false;
      this.erreur = 'Paiement introuvable.';
      return;
    }

    this.isLoading = true;
    this.erreur = null;

    this.http.get<Paiement>(`${URL_PAIEMENTS}/${id}`, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.paiement = data;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 401 || error.status === 403) {
          this.erreur = "Vous n'êtes pas autorisé à consulter ce paiement.";
          return;
        }

        this.erreur = error.error?.message || 'Impossible de charger le paiement.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/donations']);
  }

  copier(valeur: string | null | undefined): void {
    if (!valeur) return;

    navigator.clipboard.writeText(valeur)
      .then(() => this.showToastMessage('Copié dans le presse-papiers', 'success'))
      .catch(() => this.showToastMessage('Impossible de copier', 'error'));
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
