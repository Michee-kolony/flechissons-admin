// detailsarticles.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface Article {
  _id: string;
  titre: string;
  description: string;
  type: string;
  theme: string;
  youtube: string | null;
  images: string[];
  lien: string | null;
  likes: string[];
  commentaires: any[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

@Component({
  selector: 'app-detailsarticles',
  templateUrl: './detailsarticles.component.html',
  styleUrl: './detailsarticles.component.css'
})
export class DetailsarticlesComponent implements OnInit {

  private urlArticle = "https://backend-flechissons.onrender.com/article";

  article: Article | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';
  currentImageIndex: number = 0;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadArticle();
  }

  // =====================================================
  // CHARGER L'ARTICLE
  // =====================================================

  loadArticle(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id) {
      this.errorMessage = 'ID de l\'article non trouvé';
      this.isLoading = false;
      this.showToastMessage('ID de l\'article non trouvé', 'error');
      return;
    }

    this.isLoading = true;
    
    this.http.get(`${this.urlArticle}/${id}`).subscribe({
      next: (response: any) => {
        console.log('📦 Article récupéré:', response);
        
        if (response.success && response.article) {
          this.article = response.article;
          if (this.article && this.article.images) {
            console.log('📸 Images de l\'article:', this.article.images);
          }
        } else {
          this.errorMessage = 'Article non trouvé';
          this.showToastMessage('Article non trouvé', 'error');
        }
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('❌ Erreur lors du chargement de l\'article:', error);
        this.isLoading = false;
        
        let errorMessage = 'Erreur lors du chargement de l\'article';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.errorMessage = errorMessage;
        this.showToastMessage(errorMessage, 'error');
      }
    });
  }

  // =====================================================
  // NAVIGATION DES IMAGES
  // =====================================================

  nextImage(): void {
    if (this.article && this.article.images && this.article.images.length > 0) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.article.images.length;
    }
  }

  prevImage(): void {
    if (this.article && this.article.images && this.article.images.length > 0) {
      this.currentImageIndex = (this.currentImageIndex - 1 + this.article.images.length) % this.article.images.length;
    }
  }

  selectImage(index: number): void {
    this.currentImageIndex = index;
  }

  // =====================================================
  // YOUTUBE
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
      'annonces': 'bg-blue-100 text-blue-700',
      'predications': 'bg-purple-100 text-purple-700',
      'exhortations': 'bg-green-100 text-green-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'annonces': 'fa-bullhorn',
      'predications': 'fa-church',
      'exhortations': 'fa-heart'
    };
    return icons[type] || 'fa-tag';
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
  // GESTION DES IMAGES
  // =====================================================

  getCurrentImageUrl(): string {
    if (this.article && this.article.images && this.article.images.length > 0) {
      return this.article.images[this.currentImageIndex];
    }
    return '';
  }

  hasImages(): boolean {
    if (this.article && this.article.images) {
      return this.article.images.length > 0;
    }
    return false;
  }

  getImageCount(): number {
    if (this.article && this.article.images) {
      return this.article.images.length;
    }
    return 0;
  }

  onImageError(event: any): void {
    console.error('❌ Erreur de chargement d\'image:', event.target.src);
    event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%23d1d5db" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';
    event.target.className = 'w-full h-full object-contain p-8 bg-gray-100';
  }

  // =====================================================
  // NAVIGATION
  // =====================================================

  goBack(): void {
    this.router.navigate(['/admin/gestion']);
  }

  editArticle(): void {
    if (this.article) {
      this.router.navigate(['/admin/publier', this.article._id]);
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