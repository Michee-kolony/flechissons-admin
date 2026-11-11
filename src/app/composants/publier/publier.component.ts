// publier.component.ts
import { Component, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { ResultatTeleversement } from '../../shared/televersement-r2.service';
import { TeleversementMediaComponent } from '../televersement-media/televersement-media.component';

@Component({
  selector: 'app-publier',
  templateUrl: './publier.component.html',
  styleUrl: './publier.component.css'
})
export class PublierComponent {

  private urlArticle = "https://flechissons.com/article";

  // Données du formulaire
  articleData = {
    titre: '',
    description: '',
    type: 'annonces',
    theme: '',
    youtube: '',
    lien: ''
  };

  // Images
  selectedFiles: File[] = [];
  imagePreviews: string[] = [];
  isSubmitting: boolean = false;

  // Média (audio / vidéo) téléversé directement sur Cloudflare R2
  @ViewChild(TeleversementMediaComponent) televersementMedia?: TeleversementMediaComponent;
  media: ResultatTeleversement | null = null;
  televersementEnCours: boolean = false;
  // Prédication : coller un lien existant au lieu de téléverser un fichier
  utiliserLienManuel: boolean = false;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // =====================================================
  // GESTION DES IMAGES
  // =====================================================

  onFileSelected(event: any): void {
    const files = event.target.files;
    
    if (files.length > 4) {
      this.showToastMessage('Vous ne pouvez sélectionner que 4 images maximum', 'error');
      event.target.value = '';
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    for (let file of files) {
      if (!validTypes.includes(file.type)) {
        this.showToastMessage('Formats acceptés : PNG, JPG, WEBP', 'error');
        event.target.value = '';
        return;
      }
    }

    this.selectedFiles = Array.from(files);
    
    this.imagePreviews = [];
    for (let file of this.selectedFiles) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreviews.push(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // =====================================================
  // MÉDIA DE LA PRÉDICATION (TÉLÉVERSEMENT R2)
  // =====================================================

  get estPredication(): boolean {
    return this.articleData.type === 'predications';
  }

  /** Le téléversement direct est utilisé (et non un lien collé à la main) */
  get modeTeleversement(): boolean {
    return this.estPredication && !this.utiliserLienManuel;
  }

  onMediaTermine(resultat: ResultatTeleversement): void {
    this.media = resultat;
    // Lien public renseigné automatiquement (le serveur le confirme à la publication)
    this.articleData.youtube = resultat.url;
  }

  onMediaReinitialise(): void {
    if (this.media && this.articleData.youtube === this.media.url) {
      this.articleData.youtube = '';
    }
    this.media = null;
  }

  onTeleversementOccupe(occupe: boolean): void {
    this.televersementEnCours = occupe;
  }

  basculerLienManuel(): void {
    this.utiliserLienManuel = !this.utiliserLienManuel;
    if (this.utiliserLienManuel && this.media && this.articleData.youtube === this.media.url) {
      this.articleData.youtube = '';
    } else if (!this.utiliserLienManuel && this.media) {
      this.articleData.youtube = this.media.url;
    }
  }

  private entetesAuth(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // =====================================================
  // SOUMISSION DU FORMULAIRE
  // =====================================================

  onSubmit(): void {
    // Validation côté client
    if (!this.articleData.titre || !this.articleData.description || 
        !this.articleData.type || !this.articleData.theme) {
      this.showToastMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    // Jamais de publication avant la finalisation réussie du téléversement
    if (this.modeTeleversement && this.televersementEnCours) {
      this.showToastMessage("Patientez jusqu'à la fin du téléversement du fichier avant de publier.", 'error');
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('titre', this.articleData.titre);
    formData.append('description', this.articleData.description);
    formData.append('type', this.articleData.type);
    formData.append('theme', this.articleData.theme);
    
    // Prédication téléversée : le serveur vérifie le fichier et renseigne lui-même le lien
    if (this.modeTeleversement && this.media) {
      formData.append('televersementId', this.media.televersementId);
    }
    // YouTube est facultatif - on l'envoie seulement s'il est rempli
    else if (this.articleData.youtube && this.articleData.youtube.trim() !== '') {
      formData.append('youtube', this.articleData.youtube.trim());
    }
    
    // Lien externe est facultatif
    if (this.articleData.lien && this.articleData.lien.trim() !== '') {
      formData.append('lien', this.articleData.lien.trim());
    }

    // Ajout des images avec le bon nom de champ "images"
    for (let file of this.selectedFiles) {
      formData.append('images', file);
    }

    console.log('📤 Envoi des données:', {
      titre: this.articleData.titre,
      description: this.articleData.description,
      type: this.articleData.type,
      theme: this.articleData.theme,
      youtube: this.articleData.youtube || '(vide)',
      televersementId: this.modeTeleversement && this.media ? this.media.televersementId : '(aucun)',
      lien: this.articleData.lien || '(vide)',
      images: this.selectedFiles.length
    });

    this.http.post(this.urlArticle, formData, { headers: this.entetesAuth() }).subscribe({
      next: (response: any) => {
        const successMessage = response.message || 'Publication créée avec succès !';
        this.showToastMessage(successMessage, 'success');
        // Le fichier appartient désormais à la publication
        this.media = null;
        
        setTimeout(() => {
          this.resetForm();
          this.router.navigate(['/admin/gestion']);
        }, 1500);
      },
      error: (error: HttpErrorResponse) => {
        console.error('❌ Erreur lors de la publication:', error);
        this.isSubmitting = false;
        
        let errorMessage = 'Erreur lors de la publication';
        
        if (error.error) {
          if (typeof error.error === 'object') {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            } else if (error.error.errors) {
              const validationErrors = Object.values(error.error.errors);
              if (validationErrors.length > 0) {
                errorMessage = validationErrors.join(', ');
              }
            }
          } else if (typeof error.error === 'string') {
            errorMessage = error.error;
          }
        } else if (error.status === 0) {
          errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion.';
        } else if (error.status === 500) {
          errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
        }

        if (error.status === 401) {
          errorMessage = 'Votre session a expiré. Reconnectez-vous pour publier.';
        }

        this.showToastMessage(errorMessage, 'error');
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  // =====================================================
  // RÉINITIALISATION
  // =====================================================

  resetForm(): void {
    this.articleData = {
      titre: '',
      description: '',
      type: 'annonces',
      theme: '',
      youtube: '',
      lien: ''
    };
    this.selectedFiles = [];
    this.imagePreviews = [];
    this.isSubmitting = false;
    this.media = null;
    this.televersementEnCours = false;
    this.utiliserLienManuel = false;
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
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
    }, 4000);
  }

  hideToast(): void {
    this.showToast = false;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  annuler(): void {
    // Fichier téléversé mais non publié (ou transfert en cours) : supprimé de R2
    this.televersementMedia?.abandonner();
    this.resetForm();
    this.router.navigate(['/admin/gestion']);
  }
}