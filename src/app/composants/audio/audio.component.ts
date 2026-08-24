import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface AudioModel {
  _id: string;
  nom: string;
  personne: string;
  photoCouverture: string;
  fichierAudio: string;
  categorie: 'priere' | 'miracles' | 'esperances';
  datePublication: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-audio',
  templateUrl: './audio.component.html',
  styleUrl: './audio.component.css'
})
export class AudioComponent implements OnInit {

  private urlAudio = 'https://backend-flechissons.onrender.com/audio';

  audios: AudioModel[] = [];
  audiosFiltres: AudioModel[] = [];

  loading = false;
  loadingAudios = false;
  loadingSuppression = false;

  message = '';
  errorMessage = '';

  selectedCover: File | null = null;
  selectedAudio: File | null = null;

  coverPreview: string | null = null;

  // =====================================================
  // PROGRESSIONS POUR L'UX
  // =====================================================

  coverUploadProgress = 0;
  audioUploadProgress = 0;

  // Simulateur de progression
  private coverProgressInterval: any = null;
  private audioProgressInterval: any = null;

  // =====================================================
  // RECHERCHE
  // =====================================================

  recherche = '';

  // =====================================================
  // MODAL SUPPRESSION
  // =====================================================

  modalSuppressionOuvert = false;
  audioASupprimerId: string | null = null;

  formData = {
    nom: '',
    personne: '',
    categorie: '',
    datePublication: ''
  };


  constructor(
    private http: HttpClient
  ) {}


  ngOnInit(): void {
    this.setDefaultDate();
    this.getAudios();
  }


  // =====================================================
  // GETTER PROGRESSION GLOBALE
  // =====================================================

  get globalProgress(): number {
    const total = this.coverUploadProgress + this.audioUploadProgress;
    return Math.round(total / 2);
  }


  // =====================================================
  // STATUT DE LA PROGRESSION
  // =====================================================

  getProgressStatus(): string {
    if (this.coverUploadProgress < 100 && this.audioUploadProgress < 100) {
      return 'Veuillez importer l\'image et l\'audio';
    }
    if (this.coverUploadProgress < 100) {
      return 'Importation de l\'image en cours...';
    }
    if (this.audioUploadProgress < 100) {
      return 'Importation de l\'audio en cours...';
    }
    return 'Tous les fichiers sont importés, vous pouvez publier !';
  }


  // =====================================================
  // DATE PAR DÉFAUT
  // =====================================================

  setDefaultDate(): void {
    const today = new Date();
    this.formData.datePublication = today.toISOString().split('T')[0];
  }


  // =====================================================
  // GET TOUS LES AUDIOS
  // =====================================================

  getAudios(): void {
    this.loadingAudios = true;
    this.errorMessage = '';

    this.http.get<any>(this.urlAudio).subscribe({
      next: (response) => {
        console.log('🎵 Audios reçus :', response);
        this.audios = response.audios || [];

        // Plus récent → plus ancien
        this.audios.sort((a, b) => {
          return new Date(b.datePublication).getTime() - new Date(a.datePublication).getTime();
        });

        this.loadingAudios = false;
        this.filtrerAudios();
      },
      error: (error) => {
        console.error('❌ Erreur récupération audios :', error);
        this.errorMessage = error?.error?.message || 'Impossible de récupérer les audios.';
        this.loadingAudios = false;
      }
    });
  }


  // =====================================================
  // FILTRER LES AUDIOS (RECHERCHE DYNAMIQUE)
  // =====================================================

  filtrerAudios(): void {
    if (!this.recherche.trim()) {
      this.audiosFiltres = [...this.audios];
      return;
    }

    const terme = this.recherche.toLowerCase().trim();
    this.audiosFiltres = this.audios.filter(audio => {
      return audio.nom.toLowerCase().includes(terme) ||
             audio.personne.toLowerCase().includes(terme) ||
             this.getCategoryLabel(audio.categorie).toLowerCase().includes(terme);
    });
  }


  // =====================================================
  // RÉINITIALISER LA RECHERCHE
  // =====================================================

  reinitialiserRecherche(): void {
    this.recherche = '';
    this.filtrerAudios();
  }


  // =====================================================
  // SÉLECTION COUVERTURE AVEC PROGRESSION
  // =====================================================

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Veuillez sélectionner une image valide.';
      return;
    }

    // Nettoyer l'intervalle précédent
    if (this.coverProgressInterval) {
      clearInterval(this.coverProgressInterval);
      this.coverProgressInterval = null;
    }

    this.selectedCover = file;
    this.coverUploadProgress = 0;

    // Simuler la progression de l'upload
    this.simulateCoverProgress();

    // Preview
    const reader = new FileReader();
    reader.onload = () => {
      this.coverPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }


  // =====================================================
  // SIMULATION PROGRESSION COUVERTURE
  // =====================================================

  simulateCoverProgress(): void {
    this.coverProgressInterval = setInterval(() => {
      if (this.coverUploadProgress >= 100) {
        clearInterval(this.coverProgressInterval);
        this.coverProgressInterval = null;
        return;
      }

      // Incrément de 5 à 15%
      const increment = 5 + Math.floor(Math.random() * 10);
      this.coverUploadProgress = Math.min(this.coverUploadProgress + increment, 100);
    }, 250 + Math.random() * 200);
  }


  // =====================================================
  // SÉLECTION AUDIO AVEC PROGRESSION
  // =====================================================

  onAudioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('audio/')) {
      this.errorMessage = 'Veuillez sélectionner un fichier audio valide.';
      return;
    }

    // Nettoyer l'intervalle précédent
    if (this.audioProgressInterval) {
      clearInterval(this.audioProgressInterval);
      this.audioProgressInterval = null;
    }

    this.selectedAudio = file;
    this.audioUploadProgress = 0;

    // Simuler la progression de l'upload
    this.simulateAudioProgress();
  }


  // =====================================================
  // SIMULATION PROGRESSION AUDIO
  // =====================================================

  simulateAudioProgress(): void {
    this.audioProgressInterval = setInterval(() => {
      if (this.audioUploadProgress >= 100) {
        clearInterval(this.audioProgressInterval);
        this.audioProgressInterval = null;
        return;
      }

      // Incrément de 3 à 12% (l'audio est généralement plus long)
      const increment = 3 + Math.floor(Math.random() * 9);
      this.audioUploadProgress = Math.min(this.audioUploadProgress + increment, 100);
    }, 300 + Math.random() * 250);
  }


  // =====================================================
  // CRÉER AUDIO
  // =====================================================

  createAudio(): void {
    this.message = '';
    this.errorMessage = '';


    // Vérifier que l'import de la couverture est terminé
    if (this.coverUploadProgress < 100) {
      this.errorMessage = 'Veuillez attendre la fin de l\'importation de l\'image.';
      return;
    }

    // Vérifier que l'import de l'audio est terminé
    if (this.audioUploadProgress < 100) {
      this.errorMessage = 'Veuillez attendre la fin de l\'importation de l\'audio.';
      return;
    }


    // Couverture
    if (!this.selectedCover) {
      this.errorMessage = 'Veuillez sélectionner une photo de couverture.';
      return;
    }


    // Audio
    if (!this.selectedAudio) {
      this.errorMessage = 'Veuillez sélectionner un fichier audio.';
      return;
    }


    // Nom
    if (!this.formData.nom.trim()) {
      this.errorMessage = "Le nom de l'audio est obligatoire.";
      return;
    }


    // Personne
    if (!this.formData.personne.trim()) {
      this.errorMessage = 'Le nom de la personne est obligatoire.';
      return;
    }


    // Catégorie
    if (!this.formData.categorie) {
      this.errorMessage = 'Veuillez sélectionner une catégorie.';
      return;
    }


    // ===================================================
    // FORMDATA
    // ===================================================

    const formData = new FormData();

    formData.append('nom', this.formData.nom.trim());
    formData.append('personne', this.formData.personne.trim());
    formData.append('categorie', this.formData.categorie);
    formData.append('datePublication', this.formData.datePublication);
    formData.append('photoCouverture', this.selectedCover);
    formData.append('fichierAudio', this.selectedAudio);


    // ===================================================
    // ENVOI
    // ===================================================

    this.loading = true;


    this.http.post<any>(this.urlAudio, formData).subscribe({
      next: (response) => {
        console.log('✅ Audio publié :', response);

        this.message = 'Audio publié avec succès.';
        this.loading = false;

        this.resetForm();
        this.getAudios();
      },
      error: (error) => {
        console.error('❌ Erreur publication audio :', error);

        this.errorMessage = error?.error?.message || "Erreur lors de la publication de l'audio.";
        this.loading = false;
      }
    });
  }


  // =====================================================
  // OUVRIR MODAL SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(id: string): void {
    this.audioASupprimerId = id;
    this.modalSuppressionOuvert = true;
  }


  // =====================================================
  // FERMER MODAL SUPPRESSION
  // =====================================================

  fermerModalSuppression(): void {
    this.modalSuppressionOuvert = false;
    this.audioASupprimerId = null;
    this.loadingSuppression = false;
  }


  // =====================================================
  // CONFIRMER SUPPRESSION
  // =====================================================

  confirmerSuppression(): void {
    if (!this.audioASupprimerId) {
      return;
    }

    this.loadingSuppression = true;

    this.http.delete<any>(`${this.urlAudio}/${this.audioASupprimerId}`).subscribe({
      next: (response) => {
        console.log('🗑️ Audio supprimé :', response);
        this.message = 'Audio supprimé avec succès.';
        this.loadingSuppression = false;
        this.fermerModalSuppression();
        this.getAudios();
      },
      error: (error) => {
        console.error('❌ Erreur suppression :', error);
        this.errorMessage = error?.error?.message || "Impossible de supprimer l'audio.";
        this.loadingSuppression = false;
        this.fermerModalSuppression();
      }
    });
  }


  // =====================================================
  // RESET FORM
  // =====================================================

  resetForm(): void {
    this.formData = {
      nom: '',
      personne: '',
      categorie: '',
      datePublication: new Date().toISOString().split('T')[0]
    };

    this.selectedCover = null;
    this.selectedAudio = null;
    this.coverPreview = null;

    // Réinitialiser les progressions
    this.coverUploadProgress = 0;
    this.audioUploadProgress = 0;

    // Nettoyer les intervalles
    if (this.coverProgressInterval) {
      clearInterval(this.coverProgressInterval);
      this.coverProgressInterval = null;
    }
    if (this.audioProgressInterval) {
      clearInterval(this.audioProgressInterval);
      this.audioProgressInterval = null;
    }

    const inputs = document.querySelectorAll('input[type="file"]');
    inputs.forEach((input: any) => {
      input.value = '';
    });
  }


  // =====================================================
  // FORMAT DATE
  // =====================================================

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }


  // =====================================================
  // CATÉGORIE
  // =====================================================

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'priere':
        return 'Prière';
      case 'miracles':
        return 'Miracles';
      case 'esperances':
        return 'Espérances';
      default:
        return category;
    }
  }


  // =====================================================
  // ICÔNE CATÉGORIE
  // =====================================================

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'priere':
        return 'fa-hands-praying';
      case 'miracles':
        return 'fa-wand-magic-sparkles';
      case 'esperances':
        return 'fa-heart';
      default:
        return 'fa-headphones';
    }
  }

}