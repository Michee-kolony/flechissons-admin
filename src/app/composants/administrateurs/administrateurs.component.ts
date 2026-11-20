// administrateurs.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { RoleAdmin, ROLES_ADMIN } from '../../shared/auth.util';

export interface Admin {
  _id?: string;
  nom: string;
  email: string;
  role?: RoleAdmin;
  date?: string;
}

@Component({
  selector: 'app-administrateurs',
  templateUrl: './administrateurs.component.html',
  styleUrl: './administrateurs.component.css'
})
export class AdministrateursComponent implements OnInit {

  private UrlAuth = "https://flechissons.com/auth/";
  private UrlRegister = "https://flechissons.com/auth/register";

  admins: Admin[] = [];
  isLoading: boolean = true;
  currentAdminEmail: string = '';

  // Modal d'ajout
  showModal: boolean = false;
  isSubmitting: boolean = false;

  newAdmin = {
    nom: '',
    email: '',
    password: '',
    role: 'admin' as RoleAdmin
  };

  readonly roles = ROLES_ADMIN;

  // Changement de rôle en cours (id de l'administrateur)
  roleEnCoursId: string | null = null;

  confirmPassword: string = '';

  // Modal de suppression
  adminASupprimer: Admin | null = null;
  modalSuppressionOuverte: boolean = false;
  suppressionEnCours: boolean = false;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const adminDataString = localStorage.getItem('adminData');
    if (adminDataString) {
      try {
        this.currentAdminEmail = JSON.parse(adminDataString).email || '';
      } catch {
        this.currentAdminEmail = '';
      }
    }

    this.loadAdmins();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // =====================================================
  // CHARGER LES ADMINISTRATEURS
  // =====================================================

  loadAdmins(): void {
    this.isLoading = true;

    this.http.get(this.UrlAuth, { headers: this.authHeaders() }).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.admins = response;
        } else if (Array.isArray(response.admins)) {
          this.admins = response.admins;
        } else if (Array.isArray(response.data)) {
          this.admins = response.data;
        } else {
          this.admins = [];
        }
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        const message = error.status === 403
          ? 'Accès réservé au superadmin'
          : (error.error?.message || 'Erreur lors du chargement des administrateurs');
        this.showToastMessage(message, 'error');
      }
    });
  }

  // =====================================================
  // MODAL D'AJOUT
  // =====================================================

  openModal(): void {
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newAdmin = { nom: '', email: '', password: '', role: 'admin' as RoleAdmin };
    this.confirmPassword = '';
  }

  onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.newAdmin.nom || !this.newAdmin.email || !this.newAdmin.password) {
      this.showToastMessage('Veuillez remplir tous les champs', 'error');
      return;
    }

    if (this.newAdmin.password.length < 6) {
      this.showToastMessage('Le mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    if (this.newAdmin.password !== this.confirmPassword) {
      this.showToastMessage('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    this.isSubmitting = true;

    this.http.post(this.UrlRegister, this.newAdmin, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.showToastMessage('Administrateur ajouté avec succès !', 'success');
        this.closeModal();
        this.loadAdmins();
      },
      error: (error: HttpErrorResponse) => {
        const message = error.status === 403
          ? 'Accès réservé au superadmin'
          : (error.error?.message || "Erreur lors de l'ajout de l'administrateur");
        this.showToastMessage(message, 'error');
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  // =====================================================
  // CHANGEMENT DE RÔLE
  // =====================================================

  changerRole(admin: Admin, role: RoleAdmin): void {
    if (!admin._id || admin.role === role) return;

    const ancienRole = admin.role;
    admin.role = role;
    this.roleEnCoursId = admin._id;

    this.http.patch(`${this.UrlAuth}${admin._id}/role`, { role }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.roleEnCoursId = null;
        this.showToastMessage(`${admin.nom} est maintenant ${this.libelleRole(role).toLowerCase()}`, 'success');
      },
      error: (error: HttpErrorResponse) => {
        admin.role = ancienRole;
        this.roleEnCoursId = null;
        this.showToastMessage(error.error?.message || 'Erreur lors du changement de rôle', 'error');
      }
    });
  }

  libelleRole(role?: RoleAdmin): string {
    return this.roles.find(r => r.valeur === role)?.libelle || 'Administrateur';
  }

  // =====================================================
  // SUPPRESSION
  // =====================================================

  ouvrirModalSuppression(admin: Admin): void {
    this.adminASupprimer = admin;
    this.modalSuppressionOuverte = true;
  }

  fermerModalSuppression(): void {
    this.modalSuppressionOuverte = false;
    this.adminASupprimer = null;
    this.suppressionEnCours = false;
  }

  confirmerSuppression(): void {
    if (!this.adminASupprimer?._id) return;

    this.suppressionEnCours = true;

    this.http.delete(`${this.UrlAuth}${this.adminASupprimer._id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.showToastMessage('Administrateur supprimé avec succès', 'success');
        this.fermerModalSuppression();
        this.loadAdmins();
      },
      error: (error: HttpErrorResponse) => {
        const message = error.status === 403
          ? 'Accès réservé au superadmin'
          : (error.error?.message || "Erreur lors de la suppression de l'administrateur");
        this.showToastMessage(message, 'error');
        this.fermerModalSuppression();
      }
    });
  }

  // =====================================================
  // FORMATAGE
  // =====================================================

  formatDate(dateString?: string): string {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  getInitials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(part => part.charAt(0)).slice(0, 2).join('').toUpperCase();
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
