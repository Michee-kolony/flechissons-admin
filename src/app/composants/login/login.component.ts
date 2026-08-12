// login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  private Urllogin = "https://backend-flechissons.onrender.com/auth/login";

  loginData = {
    email: '',
    password: ''
  };

  rememberMe: boolean = false;
  isLoading: boolean = false; // Nouvelle variable pour l'état de chargement

  // Variables pour le toast
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Méthode pour afficher le toast
  showToastMessage(message: string, type: 'success' | 'error' = 'success') {
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

  hideToast() {
    this.showToast = false;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    
    if (!this.loginData.email || !this.loginData.password) {
      this.showToastMessage('Veuillez remplir tous les champs', 'error');
      return;
    }

    // Activation de l'état de chargement
    this.isLoading = true;

    this.http.post(this.Urllogin, this.loginData).subscribe({
      next: (response: any) => {
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminData', JSON.stringify(response.admin));
        
        if (this.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('adminEmail', this.loginData.email);
        } else {
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('adminEmail');
        }

        this.showToastMessage('Connexion réussie ! Bienvenue ' + response.admin.nom, 'success');
        
        setTimeout(() => {
          this.router.navigate(['/admin/dashboard']);
        }, 1500);
      },
      error: (error) => {
        // Désactivation de l'état de chargement en cas d'erreur
        this.isLoading = false;
        const message = error.error?.message || 'Erreur lors de la connexion';
        this.showToastMessage(message, 'error');
      },
      complete: () => {
        // Désactivation de l'état de chargement quand c'est terminé
        this.isLoading = false;
      }
    });
  }
}