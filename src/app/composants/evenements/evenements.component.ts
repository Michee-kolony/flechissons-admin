import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

interface EvenementModel {
  _id: string;
  titre: string;
  date: string;   // "AAAA-MM-JJ"
  heure: string;  // "HH:mm" ou ""
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

// Date du jour en heure locale, au même format que les évènements
const aujourdhui = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
};

@Component({
  selector: 'app-evenements',
  templateUrl: './evenements.component.html',
  styleUrl: './evenements.component.css'
})
export class EvenementsComponent implements OnInit {

  private urlEvenement = 'https://flechissons.com/evenement';

  evenements: EvenementModel[] = [];

  loading = false;
  loadingEvenements = false;
  loadingSuppression = false;

  message = '';
  errorMessage = '';

  afficherPasses = false;

  // null = ajout ; sinon id de l'évènement en cours de modification
  evenementEnEditionId: string | null = null;

  formData = this.formulaireVide();

  // =====================================================
  // MODAL SUPPRESSION
  // =====================================================

  modalSuppressionOuvert = false;
  evenementASupprimerId: string | null = null;


  constructor(
    private http: HttpClient
  ) {}


  ngOnInit(): void {
    this.getEvenements();
  }


  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }


  private formulaireVide() {
    return {
      titre: '',
      date: '',
      heure: '',
      description: ''
    };
  }


  estPasse(evenement: EvenementModel): boolean {
    return evenement.date < aujourdhui();
  }


  get evenementsAVenir(): EvenementModel[] {
    return this.evenements.filter(e => !this.estPasse(e));
  }


  get evenementsAffiches(): EvenementModel[] {
    return this.afficherPasses ? this.evenements : this.evenementsAVenir;
  }


  get nombrePasses(): number {
    return this.evenements.length - this.evenementsAVenir.length;
  }


  // "2026-10-11" -> Date locale (sans décalage de fuseau) pour le pipe date
  versDate(date: string): Date {
    const [a, m, j] = date.split('-').map(Number);
    return new Date(a, m - 1, j);
  }


  // =====================================================
  // LISTE
  // =====================================================

  getEvenements(): void {

    this.loadingEvenements = true;

    this.http.get<{ success: boolean; evenements: EvenementModel[] }>(this.urlEvenement)
      .subscribe({
        next: (res) => {
          this.evenements = res.evenements || [];
          this.loadingEvenements = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loadingEvenements = false;
          this.afficherErreur(err, 'Impossible de charger les évènements.');
        }
      });
  }


  // =====================================================
  // AJOUT / MODIFICATION
  // =====================================================

  enregistrer(): void {

    this.message = '';
    this.errorMessage = '';

    if (!this.formData.titre.trim()) {
      this.errorMessage = 'Le titre est obligatoire.';
      return;
    }

    if (!this.formData.date) {
      this.errorMessage = 'Choisissez la date de l\'évènement.';
      return;
    }

    this.loading = true;

    const requete = this.evenementEnEditionId
      ? this.http.put<{ evenement: EvenementModel; message: string }>(
          `${this.urlEvenement}/${this.evenementEnEditionId}`,
          this.formData,
          { headers: this.authHeaders() }
        )
      : this.http.post<{ evenement: EvenementModel; message: string }>(
          this.urlEvenement,
          this.formData,
          { headers: this.authHeaders() }
        );

    requete.subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        this.annulerEdition();
        this.getEvenements();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.afficherErreur(err, "Erreur lors de l'enregistrement de l'évènement.");
      }
    });
  }


  modifier(evenement: EvenementModel): void {

    this.message = '';
    this.errorMessage = '';
    this.evenementEnEditionId = evenement._id;

    this.formData = {
      titre: evenement.titre,
      date: evenement.date,
      heure: evenement.heure || '',
      description: evenement.description || ''
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  annulerEdition(): void {
    this.evenementEnEditionId = null;
    this.formData = this.formulaireVide();
  }


  // =====================================================
  // SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(id: string): void {
    this.evenementASupprimerId = id;
    this.modalSuppressionOuvert = true;
  }


  fermerModalSuppression(): void {
    this.modalSuppressionOuvert = false;
    this.evenementASupprimerId = null;
  }


  confirmerSuppression(): void {

    if (!this.evenementASupprimerId) {
      return;
    }

    const id = this.evenementASupprimerId;
    this.loadingSuppression = true;

    this.http.delete<{ message: string }>(
      `${this.urlEvenement}/${id}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.loadingSuppression = false;
        this.evenements = this.evenements.filter(e => e._id !== id);
        this.message = res.message;
        if (this.evenementEnEditionId === id) {
          this.annulerEdition();
        }
        this.fermerModalSuppression();
      },
      error: (err: HttpErrorResponse) => {
        this.loadingSuppression = false;
        this.fermerModalSuppression();
        this.afficherErreur(err, "Erreur lors de la suppression de l'évènement.");
      }
    });
  }


  private afficherErreur(err: HttpErrorResponse, defaut: string): void {
    this.message = '';
    this.errorMessage = err.status === 401
      ? 'Session expirée, reconnectez-vous.'
      : err.error?.message || defaut;
  }

}
