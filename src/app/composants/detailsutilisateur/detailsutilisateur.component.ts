// detailsutilisateur.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Utilisateur, URL_UTILISATEURS,
  extraireUtilisateurs, infoSexe, nomComplet, getInitiales, age, libelleLangue, formatDate, formatDateHeure
} from '../../shared/utilisateur.util';

@Component({
  selector: 'app-detailsutilisateur',
  templateUrl: './detailsutilisateur.component.html',
  styleUrl: './detailsutilisateur.component.css'
})
export class DetailsutilisateurComponent implements OnInit {

  utilisateur: Utilisateur | null = null;

  isLoading: boolean = true;
  erreur: string | null = null;

  // Photo qui n'a pas pu être chargée : on affiche les initiales à la place
  photoEnErreur: boolean = false;

  // Utilisés par le template
  readonly infoSexe = infoSexe;
  readonly nomComplet = nomComplet;
  readonly getInitiales = getInitiales;
  readonly age = age;
  readonly libelleLangue = libelleLangue;
  readonly formatDate = formatDate;
  readonly formatDateHeure = formatDateHeure;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerUtilisateur();
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  chargerUtilisateur(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isLoading = true;
    this.erreur = null;

    // Pas de route pour un seul utilisateur : on charge la liste et on retrouve l'utilisateur par son id
    this.http.get<any>(URL_UTILISATEURS).subscribe({
      next: (data) => {
        this.utilisateur = extraireUtilisateurs(data).find(u => u.id === id) || null;
        this.photoEnErreur = false;
        this.isLoading = false;
        if (!this.utilisateur) {
          this.erreur = "Cet utilisateur est introuvable. Il a peut-être supprimé son compte.";
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.erreur = error.error?.message || "Impossible de charger l'utilisateur.";
      }
    });
  }

  get afficherPhoto(): boolean {
    return !!this.utilisateur?.photo && !this.photoEnErreur;
  }

  goBack(): void {
    this.router.navigate(['/admin/utilisateurs']);
  }
}
