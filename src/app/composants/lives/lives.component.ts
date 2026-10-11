import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

type Plateforme = 'youtube' | 'facebook' | 'tiktok' | 'instagram' | 'autre';

interface LiveModel {
  _id: string;
  titre: string;
  plateforme: Plateforme;
  lien: string;
  description: string;
  enDirect: boolean;
  actif: boolean;
  ordre: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PlateformeInfo {
  value: Plateforme;
  label: string;
  icon: string;
  couleur: string;
}

@Component({
  selector: 'app-lives',
  templateUrl: './lives.component.html',
  styleUrl: './lives.component.css'
})
export class LivesComponent implements OnInit {

  private urlLive = 'https://flechissons.com/live';

  readonly plateformes: PlateformeInfo[] = [
    { value: 'youtube', label: 'YouTube', icon: 'fa-brands fa-youtube', couleur: 'bg-red-600' },
    { value: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook', couleur: 'bg-blue-600' },
    { value: 'tiktok', label: 'TikTok', icon: 'fa-brands fa-tiktok', couleur: 'bg-slate-900' },
    { value: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', couleur: 'bg-pink-600' },
    { value: 'autre', label: 'Autre', icon: 'fa-solid fa-globe', couleur: 'bg-orange-500' }
  ];

  lives: LiveModel[] = [];

  loading = false;
  loadingLives = false;
  loadingSuppression = false;

  message = '';
  errorMessage = '';

  // null = ajout ; sinon id du live en cours de modification
  liveEnEditionId: string | null = null;

  formData = this.formulaireVide();

  // =====================================================
  // MODAL SUPPRESSION
  // =====================================================

  modalSuppressionOuvert = false;
  liveASupprimerId: string | null = null;


  constructor(
    private http: HttpClient
  ) {}


  ngOnInit(): void {
    this.getLives();
  }


  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }


  private formulaireVide() {
    return {
      titre: '',
      plateforme: '' as Plateforme | '',
      lien: '',
      description: '',
      enDirect: false,
      actif: true,
      ordre: 0
    };
  }


  infoPlateforme(plateforme: Plateforme): PlateformeInfo {
    return this.plateformes.find(p => p.value === plateforme) || this.plateformes[4];
  }


  get nombreEnDirect(): number {
    return this.lives.filter(l => l.enDirect && l.actif).length;
  }


  // =====================================================
  // LISTE
  // =====================================================

  getLives(): void {

    this.loadingLives = true;

    this.http.get<{ success: boolean; lives: LiveModel[] }>(
      `${this.urlLive}/admin`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.lives = res.lives || [];
        this.loadingLives = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loadingLives = false;
        this.afficherErreur(err, 'Impossible de charger les lives.');
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

    if (!this.formData.plateforme) {
      this.errorMessage = 'Choisissez une plateforme.';
      return;
    }

    if (!this.formData.lien.trim()) {
      this.errorMessage = 'Le lien du live est obligatoire.';
      return;
    }

    this.loading = true;

    const requete = this.liveEnEditionId
      ? this.http.put<{ live: LiveModel; message: string }>(
          `${this.urlLive}/${this.liveEnEditionId}`,
          this.formData,
          { headers: this.authHeaders() }
        )
      : this.http.post<{ live: LiveModel; message: string }>(
          this.urlLive,
          this.formData,
          { headers: this.authHeaders() }
        );

    requete.subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        this.annulerEdition();
        this.getLives();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.afficherErreur(err, "Erreur lors de l'enregistrement du live.");
      }
    });
  }


  modifier(live: LiveModel): void {

    this.message = '';
    this.errorMessage = '';
    this.liveEnEditionId = live._id;

    this.formData = {
      titre: live.titre,
      plateforme: live.plateforme,
      lien: live.lien,
      description: live.description || '',
      enDirect: live.enDirect,
      actif: live.actif,
      ordre: live.ordre || 0
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  annulerEdition(): void {
    this.liveEnEditionId = null;
    this.formData = this.formulaireVide();
  }


  // Bascule rapide "en direct" / "visible" depuis la liste
  basculer(live: LiveModel, champ: 'enDirect' | 'actif'): void {

    const valeur = !live[champ];

    this.http.put<{ live: LiveModel }>(
      `${this.urlLive}/${live._id}`,
      { [champ]: valeur },
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        Object.assign(live, res.live);
      },
      error: (err: HttpErrorResponse) => {
        this.afficherErreur(err, 'Impossible de modifier le live.');
      }
    });
  }


  // =====================================================
  // SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(id: string): void {
    this.liveASupprimerId = id;
    this.modalSuppressionOuvert = true;
  }


  fermerModalSuppression(): void {
    this.modalSuppressionOuvert = false;
    this.liveASupprimerId = null;
  }


  confirmerSuppression(): void {

    if (!this.liveASupprimerId) {
      return;
    }

    const id = this.liveASupprimerId;
    this.loadingSuppression = true;

    this.http.delete<{ message: string }>(
      `${this.urlLive}/${id}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.loadingSuppression = false;
        this.lives = this.lives.filter(l => l._id !== id);
        this.message = res.message;
        if (this.liveEnEditionId === id) {
          this.annulerEdition();
        }
        this.fermerModalSuppression();
      },
      error: (err: HttpErrorResponse) => {
        this.loadingSuppression = false;
        this.fermerModalSuppression();
        this.afficherErreur(err, 'Erreur lors de la suppression du live.');
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
