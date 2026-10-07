// utilisateurs.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Utilisateur, Sexe, URL_UTILISATEURS, SEXES,
  extraireUtilisateurs, sexeDe, infoSexe, nomComplet, getInitiales, formatDate
} from '../../shared/utilisateur.util';

@Component({
  selector: 'app-utilisateurs',
  templateUrl: './utilisateurs.component.html',
  styleUrl: './utilisateurs.component.css'
})
export class UtilisateursComponent implements OnInit {

  utilisateurs: Utilisateur[] = [];
  utilisateursFiltres: Utilisateur[] = [];

  isLoading: boolean = true;
  erreur: string | null = null;

  // Filtres
  recherche: string = '';
  sexeFiltre: '' | Sexe = '';
  profilFiltre: '' | 'complet' | 'incomplet' = '';

  readonly sexes = SEXES;

  // Compteurs par sexe (calculés au chargement)
  compteursSexe: Record<Sexe, number> = { homme: 0, femme: 0, autre: 0, non_precise: 0 };

  // Photos qui n'ont pas pu être chargées : on affiche les initiales à la place
  photosEnErreur = new Set<string>();

  // Utilisés par le template
  readonly infoSexe = infoSexe;
  readonly nomComplet = nomComplet;
  readonly getInitiales = getInitiales;
  readonly formatDate = formatDate;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerUtilisateurs();
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerUtilisateurs(): void {
    this.isLoading = true;
    this.erreur = null;

    this.http.get<any>(URL_UTILISATEURS).subscribe({
      next: (data) => {
        this.utilisateurs = extraireUtilisateurs(data);

        this.compteursSexe = { homme: 0, femme: 0, autre: 0, non_precise: 0 };
        this.utilisateurs.forEach(u => this.compteursSexe[sexeDe(u)]++);

        this.photosEnErreur.clear();
        this.filtrer();
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.erreur = error.error?.message || 'Impossible de charger les utilisateurs.';
      }
    });
  }

  // =====================================================
  // FILTRES
  // =====================================================

  filtrer(): void {
    const terme = this.normaliser(this.recherche);

    this.utilisateursFiltres = this.utilisateurs.filter(u => {
      if (this.sexeFiltre && sexeDe(u) !== this.sexeFiltre) return false;
      if (this.profilFiltre === 'complet' && !u.profilComplete) return false;
      if (this.profilFiltre === 'incomplet' && u.profilComplete) return false;

      if (!terme) return true;
      const texte = this.normaliser(
        [u.nom, u.prenom, u.email, u.telephone, u.ville].filter(Boolean).join(' ')
      );
      return texte.includes(terme);
    });
  }

  basculerSexe(sexe: Sexe): void {
    this.sexeFiltre = this.sexeFiltre === sexe ? '' : sexe;
    this.filtrer();
  }

  get filtresActifs(): boolean {
    return !!(this.recherche || this.sexeFiltre || this.profilFiltre);
  }

  reinitialiserFiltres(): void {
    this.recherche = '';
    this.sexeFiltre = '';
    this.profilFiltre = '';
    this.filtrer();
  }

  private normaliser(texte: string): string {
    return (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  // =====================================================
  // AFFICHAGE
  // =====================================================

  afficherPhoto(u: Utilisateur): boolean {
    return !!u.photo && !this.photosEnErreur.has(u.id);
  }

  photoEnErreur(u: Utilisateur): void {
    this.photosEnErreur.add(u.id);
  }

  trackById(_: number, u: Utilisateur): string {
    return u.id;
  }
}
