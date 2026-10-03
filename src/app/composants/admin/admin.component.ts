// admin.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {

  // Desktop : sidebar étendue (icônes + libellés) ou repliée (icônes seules)
  sidebarExpanded = true;

  // Mobile : tiroir latéral ouvert ou fermé (superposé au contenu)
  mobileMenuOpen = false;

  adminData: any = null;
  adminName: string = '';
  adminEmail: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Récupérer les données de l'administrateur depuis localStorage
    this.loadAdminData();
  }

  loadAdminData(): void {
    const adminDataString = localStorage.getItem('adminData');
    if (adminDataString) {
      try {
        this.adminData = JSON.parse(adminDataString);
        this.adminName = this.adminData.nom || 'Administrateur';
        this.adminEmail = this.adminData.email || 'admin@example.com';
      } catch (error) {
        console.error('Erreur lors du chargement des données admin:', error);
        this.adminName = 'Administrateur';
        this.adminEmail = 'admin@example.com';
      }
    } else {
      // Données par défaut si rien dans localStorage
      this.adminName = 'Administrateur';
      this.adminEmail = 'admin@example.com';
    }
  }

  /**
   * Replie/étend la sidebar sur desktop (bouton chevron flottant)
   */
  toggleSidebar(): void {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  /**
   * Ouvre/ferme le tiroir latéral sur mobile (bouton hamburger du header)
   */
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  /**
   * Ferme le tiroir mobile (clic sur un lien, sur le fond sombre, ou bouton fermer)
   */
  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  /**
   * Les libellés texte doivent être visibles quand la sidebar est étendue sur
   * desktop, ou quand le tiroir est ouvert sur mobile (toujours affiché en plein).
   */
  get afficherLabels(): boolean {
    return this.sidebarExpanded || this.mobileMenuOpen;
  }

  logout(): void {
    // Supprimer toutes les données de l'administrateur du localStorage
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('adminEmail');

    // Rediriger vers la page de connexion
    this.router.navigate(['/login']);
  }

}
