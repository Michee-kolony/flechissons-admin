// admin.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isSuperAdmin, isTresorier, pageAutoriseeTresorier, peutVoirTresorerie } from '../../shared/auth.util';
import { ThemeService } from '../../shared/theme.service';
import { MessagerieService, peutUtiliserMessagerie } from '../../shared/messagerie.service';
import { EVENEMENT_PROFIL_MAJ } from '../profil/profil.component';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit, OnDestroy {

  // Desktop : sidebar étendue (icônes + libellés) ou repliée (icônes seules)
  sidebarExpanded = true;

  // Mobile : tiroir latéral ouvert ou fermé (superposé au contenu)
  mobileMenuOpen = false;

  adminData: any = null;
  adminName: string = '';
  adminEmail: string = '';
  estSuperAdmin: boolean = false;
  /** Trésorier : menu limité au tableau de bord et à la trésorerie */
  estTresorier: boolean = false;
  voitTresorerie: boolean = false;
  voitMessagerie: boolean = false;
  adminPhoto: string = '';
  messagesNonLus = 0;

  private nonLusSub?: Subscription;
  // Profil modifié depuis la page « Mon profil » : nom et photo mis à jour tout de suite
  private readonly surProfilMaj = () => this.loadAdminData();
  // Clic sur une notification de bureau « nouveau message »
  private readonly surOuvrirMessagerie = () => void this.router.navigate(['/admin/messagerie']);

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private http: HttpClient,
    private messagerie: MessagerieService
  ) {}

  get estSombre(): boolean {
    return this.themeService.estSombre;
  }

  /**
   * Bascule entre le mode clair et le mode sombre
   */
  basculerTheme(): void {
    this.themeService.basculer();
  }

  ngOnInit(): void {
    // Récupérer les données de l'administrateur depuis localStorage
    this.loadAdminData();
    this.appliquerRole();
    this.rafraichirRole();

    window.addEventListener(EVENEMENT_PROFIL_MAJ, this.surProfilMaj);
    window.addEventListener('ouvrir-messagerie', this.surOuvrirMessagerie);
    this.nonLusSub = this.messagerie.nonLus$.subscribe(n => this.messagesNonLus = n);
  }

  ngOnDestroy(): void {
    window.removeEventListener(EVENEMENT_PROFIL_MAJ, this.surProfilMaj);
    window.removeEventListener('ouvrir-messagerie', this.surOuvrirMessagerie);
    this.nonLusSub?.unsubscribe();
    this.messagerie.arreterSurveillance();
  }

  private appliquerRole(): void {
    this.estSuperAdmin = isSuperAdmin();
    this.estTresorier = isTresorier();
    this.voitTresorerie = peutVoirTresorerie();
    // Rôle changé en trésorier pendant la session : on quitte la page interdite
    if (this.estTresorier && !pageAutoriseeTresorier(this.router.url)) {
      void this.router.navigate(['/admin/dashboard']);
    }
    this.voitMessagerie = peutUtiliserMessagerie();
    if (this.voitMessagerie) {
      this.messagerie.demarrerSurveillance();
    } else {
      this.messagerie.arreterSurveillance();
    }
  }

  /**
   * Relit le rôle à jour sur le serveur : un administrateur promu trésorier
   * (ou dont le rôle a été retiré) voit le bon menu sans se reconnecter.
   */
  private rafraichirRole(): void {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    this.http.get<{ id: string; nom: string; email: string; role: string }>(
      'https://flechissons.com/auth/moi',
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    ).subscribe({
      next: (admin) => {
        const donnees = { ...(this.adminData || {}), ...admin };
        localStorage.setItem('adminData', JSON.stringify(donnees));
        this.loadAdminData();
        this.appliquerRole();
      },
      // Hors ligne ou ancien serveur : on garde le rôle enregistré à la connexion
      error: () => {}
    });
  }

  loadAdminData(): void {
    const adminDataString = localStorage.getItem('adminData');
    if (adminDataString) {
      try {
        this.adminData = JSON.parse(adminDataString);
        this.adminName = this.adminData.nom || 'Administrateur';
        this.adminEmail = this.adminData.email || 'admin@example.com';
        this.adminPhoto = this.adminData.photo || '';
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
    this.messagerie.arreterSurveillance();

    // Rediriger vers la page de connexion
    this.router.navigate(['/login']);
  }

}
