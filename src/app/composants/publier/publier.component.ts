// publier.component.ts
import { Component } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-publier',
  templateUrl: './publier.component.html',
  styleUrl: './publier.component.css'
})
export class PublierComponent {

  private urlArticle = "https://backend-flechissons.onrender.com/article";

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
  // SOUMISSION DU FORMULAIRE
  // =====================================================

  onSubmit(): void {
    // Validation côté client
    if (!this.articleData.titre || !this.articleData.description || 
        !this.articleData.type || !this.articleData.theme) {
      this.showToastMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('titre', this.articleData.titre);
    formData.append('description', this.articleData.description);
    formData.append('type', this.articleData.type);
    formData.append('theme', this.articleData.theme);
    
    // YouTube est facultatif - on l'envoie seulement s'il est rempli
    if (this.articleData.youtube && this.articleData.youtube.trim() !== '') {
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
      lien: this.articleData.lien || '(vide)',
      images: this.selectedFiles.length
    });

    this.http.post(this.urlArticle, formData).subscribe({
      next: (response: any) => {
        const successMessage = response.message || 'Publication créée avec succès !';
        this.showToastMessage(successMessage, 'success');
        
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
    this.resetForm();
    this.router.navigate(['/admin/gestion']);
  }
}