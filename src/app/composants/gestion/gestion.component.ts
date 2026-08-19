// gestion.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface Article {
  _id: string;
  titre: string;
  description: string;
  type: string;
  theme: string;
  youtube: string | null;
  videoUrl: string | null;  // NOUVEAU : pour les vidéos
  images: string[];
  lien: string | null;
  likes: string[];
  commentaires: any[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

@Component({
  selector: 'app-gestion',
  templateUrl: './gestion.component.html',
  styleUrl: './gestion.component.css'
})
export class GestionComponent implements OnInit {

  private urlArticle = "https://backend-flechissons.onrender.com/article";

  articles: Article[] = [];
  filteredArticles: Article[] = [];
  isLoading: boolean = true;

  // Filtres
  searchTerm: string = '';
  selectedType: string = '';
  selectedStatus: string = '';

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  constructor(
    private http: HttpClient,
    public router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadArticles();
  }

  // =====================================================
  // CHARGER LES ARTICLES
  // =====================================================

  loadArticles(): void {
    this.isLoading = true;
    
    this.http.get(this.urlArticle).subscribe({
      next: (response: any) => {
        console.log('📦 Réponse complète du backend:', response);
        
        if (response.success && response.articles) {
          // Trier par date décroissante (le plus récent en premier)
          this.articles = response.articles.sort((a: Article, b: Article) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          // DEBUG: Afficher toutes les URLs des images
          console.log('🔍 DEBUG IMAGES:');
          this.articles.forEach((article, index) => {
            console.log(`📄 Article ${index + 1}: ${article.titre}`);
            console.log(`  - Type: ${article.type}`);
            console.log(`  - Images: ${article.images ? article.images.length : 0}`);
            if (article.images && article.images.length > 0) {
              article.images.forEach((url, i) => {
                console.log(`    Image ${i + 1}: ${url}`);
              });
            } else {
              console.log(`  - Aucune image trouvée`);
            }
          });
          
          this.totalItems = this.articles.length;
          this.applyFilters();
        } else {
          this.showToastMessage('Aucun article trouvé', 'error');
        }
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('❌ Erreur lors du chargement des articles:', error);
        this.isLoading = false;
        
        let errorMessage = 'Erreur lors du chargement des articles';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.showToastMessage(errorMessage, 'error');
      }
    });
  }

  // =====================================================
  // FILTRES
  // =====================================================

  applyFilters(): void {
    let filtered = [...this.articles];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(article =>
        article.titre.toLowerCase().includes(term) ||
        article.description.toLowerCase().includes(term) ||
        article.theme.toLowerCase().includes(term)
      );
    }

    if (this.selectedType) {
      filtered = filtered.filter(article => article.type === this.selectedType);
    }

    this.filteredArticles = filtered;
    this.totalItems = this.filteredArticles.length;
    this.currentPage = 1;
  }

  onSearch(): void {
    this.applyFilters();
  }

  onTypeChange(event: any): void {
    this.selectedType = event.target.value;
    this.applyFilters();
  }

  onStatusChange(event: any): void {
    this.selectedStatus = event.target.value;
    this.applyFilters();
  }

  // =====================================================
  // PAGINATION
  // =====================================================

  get paginatedArticles(): Article[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredArticles.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get startItem(): number {
    return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (this.currentPage > 3) {
        pages.push(-1);
      }
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(total - 1, this.currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (this.currentPage < total - 2) {
        pages.push(-1);
      }
      pages.push(total);
    }
    return pages;
  }

  // =====================================================
  // SUPPRIMER UN ARTICLE
  // =====================================================

  deleteArticle(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette publication ? Cette action est irréversible.')) {
      this.http.delete(`${this.urlArticle}/${id}`).subscribe({
        next: (response: any) => {
          this.showToastMessage(response.message || 'Article supprimé avec succès', 'success');
          this.loadArticles();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur lors de la suppression:', error);
          const message = error.error?.message || 'Erreur lors de la suppression';
          this.showToastMessage(message, 'error');
        }
      });
    }
  }

  // =====================================================
  // NAVIGATION
  // =====================================================

  viewArticle(id: string): void {
    this.router.navigate(['/admin/article', id]);
  }

  editArticle(id: string): void {
    this.router.navigate(['/admin/publier', id]);
  }

  navigateToPublier(): void {
    this.router.navigate(['/admin/publier']);
  }

  // =====================================================
  // FORMATAGE DES DATES
  // =====================================================

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    if (weeks < 4) return `${weeks} sem`;
    if (months < 12) return `${months} mois`;
    return `${years} an${years > 1 ? 's' : ''}`;
  }

  // =====================================================
  // YOUTUBE (conservé pour compatibilité)
  // =====================================================

  getYoutubeId(url: string | null): string {
    if (!url) return '';
    
    const patterns = [
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtube\.com\/embed\/([^?&]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return url;
  }

  getSafeYoutubeUrl(url: string | null): SafeResourceUrl {
    const videoId = this.getYoutubeId(url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
  }

  // =====================================================
  // NOUVEAU : GESTION DES VIDÉOS
  // =====================================================

  /**
   * Vérifie si un article a une vidéo (videoUrl ou youtube)
   */
  hasVideo(article: Article): boolean {
    return !!(article.videoUrl || article.youtube);
  }

  /**
   * Récupère l'URL de la vidéo (priorité à videoUrl, sinon youtube)
   */
  getVideoUrl(article: Article): string | null {
    return article.videoUrl || article.youtube || null;
  }

  /**
   * Gère les erreurs de chargement de vidéo
   */
  onVideoError(event: any, article: Article): void {
    console.error(`❌ Erreur de chargement de la vidéo pour: ${article.titre}`);
    console.error(`  URL: ${event.target.src}`);
    
    // Afficher un message d'erreur à la place de la vidéo
    const parent = event.target.parentElement;
    if (parent) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'w-full h-full flex items-center justify-center bg-gray-900 text-white';
      errorDiv.innerHTML = `
        <div class="text-center p-4">
          <i class="fa-solid fa-video-slash text-5xl text-gray-500 mb-3"></i>
          <p class="text-sm text-gray-400">Vidéo non disponible</p>
          <p class="text-xs text-gray-500 mt-1">Format non supporté ou fichier introuvable</p>
        </div>
      `;
      parent.appendChild(errorDiv);
    }
  }

  /**
   * Alterne lecture/pause de la vidéo
   */
  toggleVideoPlay(videoElement: HTMLVideoElement): void {
    if (!videoElement) return;
    
    if (videoElement.paused) {
      videoElement.play().catch(error => {
        console.error('Erreur lors de la lecture de la vidéo:', error);
        this.showToastMessage('Impossible de lire la vidéo', 'error');
      });
    } else {
      videoElement.pause();
    }
  }

  /**
   * Alterne muet/son de la vidéo
   */
  toggleVideoMute(videoElement: HTMLVideoElement): void {
    if (!videoElement) return;
    videoElement.muted = !videoElement.muted;
  }

  // =====================================================
  // AFFICHAGE DES TYPES
  // =====================================================

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'annonces': 'Annonces',
      'predications': 'Prédications',
      'exhortations': 'Exhortations'
    };
    return labels[type] || type;
  }

  getTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      'annonces': 'bg-blue-50 text-blue-600',
      'predications': 'bg-purple-50 text-purple-600',
      'exhortations': 'bg-green-50 text-green-600'
    };
    return colors[type] || 'bg-gray-50 text-gray-600';
  }

  // =====================================================
  // IMAGES
  // =====================================================

  getImageUrl(article: Article): string {
    if (article.images && article.images.length > 0) {
      let url = article.images[0].trim();
      return url;
    }
    return '';
  }

  hasImages(article: Article): boolean {
    return article.images && article.images.length > 0 && article.images[0].trim() !== '';
  }

  onImageError(event: any, article: Article): void {
    console.error(`❌ Erreur de chargement d'image pour: ${article.titre}`);
    console.error(`  URL: ${event.target.src}`);
    event.target.style.display = 'none';
    
    const parent = event.target.parentElement;
    if (parent) {
      const placeholder = document.createElement('div');
      placeholder.className = 'w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-gray-100';
      placeholder.innerHTML = `
        <div class="text-center p-4">
          <i class="fa-solid fa-image text-4xl text-gray-300 mb-2"></i>
          <p class="text-xs text-gray-400">Image non disponible</p>
        </div>
      `;
      parent.appendChild(placeholder);
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
}