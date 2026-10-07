// donations.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  Paiement, StatutPaiement, TypePaiement, OperateurPaiement,
  URL_PAIEMENTS, STATUTS, TYPES, OPERATEURS,
  libelleStatut, classeStatut, iconeStatut, libelleType, libelleOperateur, nomFidele,
  formatMontant, formatDate, formatTelephone, getInitials
} from '../../shared/paiement.util';

@Component({
  selector: 'app-donations',
  templateUrl: './donations.component.html',
  styleUrl: './donations.component.css'
})
export class DonationsComponent implements OnInit {

  paiements: Paiement[] = [];
  paiementsFiltres: Paiement[] = [];

  isLoading: boolean = true;
  erreur: string | null = null;

  // Filtres
  recherche: string = '';
  statutFiltre: '' | StatutPaiement = '';
  deviseFiltre: '' | 'USD' | 'CDF' = '';
  operateurFiltre: '' | OperateurPaiement = '';
  typeFiltre: '' | TypePaiement = '';

  readonly statuts = STATUTS;
  readonly types = TYPES;
  readonly operateurs = OPERATEURS;

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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerPaiements();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerPaiements(): void {
    this.isLoading = true;
    this.erreur = null;

    this.http.get<Paiement[]>(URL_PAIEMENTS, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.paiements = Array.isArray(data) ? data : [];
        this.filtrer();
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 401 || error.status === 403) {
          this.erreur = "Vous n'êtes pas autorisé à consulter les paiements.";
          return;
        }

        this.erreur = error.error?.message || 'Impossible de charger les paiements.';
      }
    });
  }

  // =====================================================
  // FILTRES
  // =====================================================

  filtrer(): void {
    const terme = this.recherche.toLowerCase().trim();

    this.paiementsFiltres = this.paiements.filter(p => {
      const correspondRecherche = !terme ||
        (p.nom || '').toLowerCase().includes(terme) ||
        (p.reference || '').toLowerCase().includes(terme) ||
        (p.telephone || '').includes(terme) ||
        (p.objet || '').toLowerCase().includes(terme) ||
        (p.providerTransactionId || '').toLowerCase().includes(terme) ||
        (p.utilisateurId?.email || '').toLowerCase().includes(terme);

      return correspondRecherche &&
        (!this.statutFiltre || p.statut === this.statutFiltre) &&
        (!this.deviseFiltre || p.devise === this.deviseFiltre) &&
        (!this.operateurFiltre || p.operateur === this.operateurFiltre) &&
        (!this.typeFiltre || p.type === this.typeFiltre);
    });
  }

  get filtresActifs(): boolean {
    return !!(this.recherche || this.statutFiltre || this.deviseFiltre || this.operateurFiltre || this.typeFiltre);
  }

  reinitialiserFiltres(): void {
    this.recherche = '';
    this.statutFiltre = '';
    this.deviseFiltre = '';
    this.operateurFiltre = '';
    this.typeFiltre = '';
    this.filtrer();
  }

  // =====================================================
  // STATISTIQUES (seuls les paiements réussis sont comptés dans les totaux)
  // =====================================================

  private totalReussi(devise: 'USD' | 'CDF'): number {
    return this.paiements
      .filter(p => p.statut === 'reussi' && p.devise === devise)
      .reduce((somme, p) => somme + (p.montant || 0), 0);
  }

  get totalUSD(): number {
    return this.totalReussi('USD');
  }

  get totalCDF(): number {
    return this.totalReussi('CDF');
  }

  compterStatut(statut: StatutPaiement): number {
    return this.paiements.filter(p => p.statut === statut).length;
  }
}
