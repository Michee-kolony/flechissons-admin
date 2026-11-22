import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { formatMontant } from '../../shared/paiement.util';
import { isTresorier } from '../../shared/auth.util';
import {
  CATEGORIES,
  DEVISES,
  Devise,
  MODES_PAIEMENT,
  ModePaiement,
  OperationTresorerie,
  ResumeTresorerie,
  TypeOperation,
  URL_TRESORERIE,
  categoriesFormulaire,
  depuisAAAAMMJJ,
  libelleCategorie,
  libelleMode,
  versAAAAMMJJ
} from '../../shared/tresorerie.util';

type Periode = 'mois' | 'mois_precedent' | 'annee' | 'tout' | 'personnalisee';

@Component({
  selector: 'app-tresorerie',
  templateUrl: './tresorerie.component.html',
  styleUrl: './tresorerie.component.css'
})
export class TresorerieComponent implements OnInit {

  readonly devises = DEVISES;
  readonly categories = CATEGORIES;
  readonly modesPaiement = MODES_PAIEMENT;
  readonly formatMontant = formatMontant;
  readonly libelleCategorie = libelleCategorie;
  readonly categoriesFormulaire = categoriesFormulaire;
  readonly libelleMode = libelleMode;
  readonly versDate = depuisAAAAMMJJ;

  // Superadmin : consultation uniquement (le backend refuse aussi toute modification)
  readonly lectureSeule = !isTresorier();

  // =====================================================
  // PÉRIODE
  // =====================================================

  periode: Periode = 'mois';
  debut = '';
  fin = '';

  // Devise affichée dans le résumé
  deviseResume: Devise = 'USD';

  resume: ResumeTresorerie | null = null;
  loadingResume = false;

  // =====================================================
  // LISTE
  // =====================================================

  operations: OperationTresorerie[] = [];
  loadingOperations = false;
  page = 1;
  pages = 1;
  total = 0;

  filtreType: '' | TypeOperation = '';
  filtreDevise: '' | Devise = '';
  filtreCategorie = '';
  recherche = '';
  private rechercheTimer: any;

  // =====================================================
  // FORMULAIRE
  // =====================================================

  formData = this.formulaireVide();
  operationEnEditionId: string | null = null;
  loading = false;

  message = '';
  errorMessage = '';

  // =====================================================
  // SUPPRESSION / EXPORT
  // =====================================================

  operationASupprimer: OperationTresorerie | null = null;
  loadingSuppression = false;
  loadingExport = false;


  constructor(private http: HttpClient) {}


  ngOnInit(): void {
    this.choisirPeriode('mois');
  }


  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }


  private formulaireVide() {
    return {
      type: 'entree' as TypeOperation,
      categorie: 'offrande_adoration',
      libelle: '',
      montant: null as number | null,
      devise: 'USD' as Devise,
      date: versAAAAMMJJ(new Date()),
      modePaiement: 'especes' as ModePaiement,
      reference: '',
      description: ''
    };
  }


  // =====================================================
  // PÉRIODE
  // =====================================================

  choisirPeriode(periode: Periode): void {

    this.periode = periode;
    const maintenant = new Date();

    switch (periode) {
      case 'mois':
        this.debut = versAAAAMMJJ(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1));
        this.fin = versAAAAMMJJ(new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0));
        break;
      case 'mois_precedent':
        this.debut = versAAAAMMJJ(new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1));
        this.fin = versAAAAMMJJ(new Date(maintenant.getFullYear(), maintenant.getMonth(), 0));
        break;
      case 'annee':
        this.debut = `${maintenant.getFullYear()}-01-01`;
        this.fin = `${maintenant.getFullYear()}-12-31`;
        break;
      case 'tout':
        this.debut = '';
        this.fin = '';
        break;
      case 'personnalisee':
        // Les dates actuelles restent modifiables par l'utilisateur
        break;
    }

    this.rafraichir();
  }


  appliquerDatesPersonnalisees(): void {
    this.periode = 'personnalisee';
    if (this.debut && this.fin && this.debut > this.fin) {
      this.errorMessage = 'La date de début doit précéder la date de fin.';
      return;
    }
    this.rafraichir();
  }


  rafraichir(): void {
    this.page = 1;
    this.getResume();
    this.getOperations();
  }


  private parametresPeriode(): HttpParams {
    let params = new HttpParams();
    if (this.debut) params = params.set('debut', this.debut);
    if (this.fin) params = params.set('fin', this.fin);
    return params;
  }


  private parametresFiltres(): HttpParams {
    let params = this.parametresPeriode();
    if (this.filtreType) params = params.set('type', this.filtreType);
    if (this.filtreDevise) params = params.set('devise', this.filtreDevise);
    if (this.filtreCategorie) params = params.set('categorie', this.filtreCategorie);
    if (this.recherche.trim()) params = params.set('recherche', this.recherche.trim());
    return params;
  }


  // =====================================================
  // RÉSUMÉ
  // =====================================================

  getResume(): void {

    this.loadingResume = true;

    this.http.get<ResumeTresorerie & { success: boolean }>(
      `${URL_TRESORERIE}/resume`,
      { headers: this.authHeaders(), params: this.parametresPeriode() }
    ).subscribe({
      next: (res) => {
        this.resume = res;
        this.loadingResume = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loadingResume = false;
        this.afficherErreur(err, 'Impossible de charger le résumé de la trésorerie.');
      }
    });
  }


  get resumeDevise() {
    return this.resume?.devises?.[this.deviseResume] || null;
  }


  categoriesResume(type: TypeOperation) {
    return (this.resumeDevise?.parCategorie || []).filter(c => c.type === type);
  }


  // Largeur de la barre (en %) par rapport au total du même type
  pourcentage(total: number, type: TypeOperation): number {
    const reference = type === 'entree' ? this.resumeDevise?.entrees : this.resumeDevise?.sorties;
    return reference ? Math.max(2, Math.round((total / reference) * 100)) : 0;
  }


  // "2026-11" -> "novembre 2026"
  libelleMois(mois: string): string {
    return depuisAAAAMMJJ(`${mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }


  // =====================================================
  // LISTE
  // =====================================================

  getOperations(): void {

    this.loadingOperations = true;

    const params = this.parametresFiltres()
      .set('page', String(this.page))
      .set('limite', '30');

    this.http.get<{ operations: OperationTresorerie[]; total: number; page: number; pages: number }>(
      `${URL_TRESORERIE}/operations`,
      { headers: this.authHeaders(), params }
    ).subscribe({
      next: (res) => {
        this.operations = res.operations || [];
        this.total = res.total || 0;
        this.pages = res.pages || 1;
        this.loadingOperations = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loadingOperations = false;
        this.afficherErreur(err, 'Impossible de charger les opérations.');
      }
    });
  }


  // Catégories proposées dans le filtre de la liste (selon le type choisi)
  get categoriesFiltre(): { valeur: string; libelle: string }[] {
    if (this.filtreType) return CATEGORIES[this.filtreType];
    return [
      ...CATEGORIES.entree.map(c => ({ ...c, libelle: `Entrée · ${c.libelle}` })),
      ...CATEGORIES.sortie.map(c => ({ ...c, libelle: `Sortie · ${c.libelle}` }))
    ];
  }


  filtrer(): void {
    // La catégorie filtrée doit exister pour le type choisi
    if (this.filtreCategorie && !this.categoriesFiltre.some(c => c.valeur === this.filtreCategorie)) {
      this.filtreCategorie = '';
    }
    this.page = 1;
    this.getOperations();
  }


  rechercher(): void {
    clearTimeout(this.rechercheTimer);
    this.rechercheTimer = setTimeout(() => this.filtrer(), 350);
  }


  allerPage(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.getOperations();
  }


  // =====================================================
  // FORMULAIRE
  // =====================================================

  changerType(type: TypeOperation): void {
    this.formData.type = type;
    // La catégorie doit appartenir au nouveau type
    if (!CATEGORIES[type].some(c => c.valeur === this.formData.categorie)) {
      this.formData.categorie = CATEGORIES[type][0].valeur;
    }
  }


  enregistrer(): void {

    if (this.lectureSeule) return;

    this.message = '';
    this.errorMessage = '';

    const montant = Number(this.formData.montant);

    if (!this.formData.libelle.trim()) {
      this.errorMessage = 'Le libellé est obligatoire.';
      return;
    }

    if (!Number.isFinite(montant) || montant <= 0) {
      this.errorMessage = 'Le montant doit être supérieur à 0.';
      return;
    }

    if (!this.formData.date) {
      this.errorMessage = "Choisissez la date de l'opération.";
      return;
    }

    this.loading = true;

    const corps = { ...this.formData, montant };

    const requete = this.operationEnEditionId
      ? this.http.put<{ message: string }>(
          `${URL_TRESORERIE}/operations/${this.operationEnEditionId}`,
          corps,
          { headers: this.authHeaders() }
        )
      : this.http.post<{ message: string }>(
          `${URL_TRESORERIE}/operations`,
          corps,
          { headers: this.authHeaders() }
        );

    requete.subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        // Après un ajout, on garde le type, la devise et la date pour enchaîner les saisies
        const etaitEnEdition = !!this.operationEnEditionId;
        const { type, categorie, devise, date, modePaiement } = this.formData;
        this.annulerEdition();
        if (!etaitEnEdition) {
          this.formData = { ...this.formData, type, categorie, devise, date, modePaiement };
        }
        this.getResume();
        this.getOperations();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.afficherErreur(err, "Erreur lors de l'enregistrement de l'opération.");
      }
    });
  }


  modifier(operation: OperationTresorerie): void {

    if (this.lectureSeule) return;

    this.message = '';
    this.errorMessage = '';
    this.operationEnEditionId = operation._id;

    this.formData = {
      type: operation.type,
      categorie: operation.categorie,
      libelle: operation.libelle,
      montant: operation.montant,
      devise: operation.devise,
      date: operation.date,
      modePaiement: operation.modePaiement || 'especes',
      reference: operation.reference || '',
      description: operation.description || ''
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  annulerEdition(): void {
    this.operationEnEditionId = null;
    this.formData = this.formulaireVide();
  }


  // =====================================================
  // SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(operation: OperationTresorerie): void {
    if (this.lectureSeule) return;
    this.operationASupprimer = operation;
  }


  fermerModalSuppression(): void {
    this.operationASupprimer = null;
    this.loadingSuppression = false;
  }


  confirmerSuppression(): void {

    if (!this.operationASupprimer) return;

    const id = this.operationASupprimer._id;
    this.loadingSuppression = true;

    this.http.delete<{ message: string }>(
      `${URL_TRESORERIE}/operations/${id}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.message = res.message;
        this.errorMessage = '';
        if (this.operationEnEditionId === id) {
          this.annulerEdition();
        }
        this.fermerModalSuppression();
        this.getResume();
        this.getOperations();
      },
      error: (err: HttpErrorResponse) => {
        this.fermerModalSuppression();
        this.afficherErreur(err, "Erreur lors de la suppression de l'opération.");
      }
    });
  }


  // =====================================================
  // EXPORT CSV (EXCEL)
  // =====================================================

  exporter(): void {

    this.loadingExport = true;

    this.http.get(`${URL_TRESORERIE}/export`, {
      headers: this.authHeaders(),
      params: this.parametresFiltres(),
      responseType: 'blob'
    }).subscribe({
      next: (fichier) => {
        this.loadingExport = false;
        const url = URL.createObjectURL(fichier);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `tresorerie_${this.debut || 'debut'}_${this.fin || 'fin'}.csv`;
        lien.click();
        URL.revokeObjectURL(url);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingExport = false;
        this.afficherErreur(err, "Erreur lors de l'export.");
      }
    });
  }


  private afficherErreur(err: HttpErrorResponse, defaut: string): void {
    this.message = '';
    this.errorMessage = err.status === 401
      ? 'Session expirée, reconnectez-vous.'
      : err.status === 403
        ? (err.error?.message || 'Accès réservé au trésorier.')
        : err.error?.message || defaut;
  }

}
