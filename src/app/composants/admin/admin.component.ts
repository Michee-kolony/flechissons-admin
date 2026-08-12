// admin.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {

  sidebarOpen = true;
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

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
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