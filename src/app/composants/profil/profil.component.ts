// profil.component.ts
// Profil de l'administrateur connecté : nom, e-mail, téléphone, titre, bio, photo, mot de passe.
// Le rôle n'est pas modifiable ici (seul un superadmin le change, depuis « Gestion administrateur »).
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ROLES_ADMIN } from '../../shared/auth.util';

const URL_AUTH = 'https://flechissons.com/auth';

/** Évènement écouté par la barre latérale pour afficher tout de suite le nouveau nom / la nouvelle photo */
export const EVENEMENT_PROFIL_MAJ = 'admin-profil-maj';

interface ProfilAdmin {
  id: string;
  nom: string;
  email: string;
  role: string;
  photo: string;
  telephone: string;
  titre: string;
  bio: string;
}

@Component({
  selector: 'app-profil',
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.css'
})
export class ProfilComponent implements OnInit {

  chargement = true;
  enregistrement = false;
  message = '';
  erreur = '';

  role = '';
  photoActuelle = '';
  formulaire = { nom: '', email: '', telephone: '', titre: '', bio: '' };

  // Photo
  nouvellePhoto: File | null = null;
  apercuPhoto = '';
  supprimerPhoto = false;

  // Mot de passe
  mdp = { actuel: '', nouveau: '', confirmation: '' };
  mdpEnCours = false;
  mdpMessage = '';
  mdpErreur = '';
  afficherMdp = false;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  get libelleRole(): string {
    return ROLES_ADMIN.find(r => r.valeur === this.role)?.libelle || this.role;
  }

  get photoAffichee(): string {
    if (this.apercuPhoto) return this.apercuPhoto;
    return this.supprimerPhoto ? '' : this.photoActuelle;
  }

  get initiales(): string {
    return (this.formulaire.nom || '?').split(/\s+/).slice(0, 2).map(m => m.charAt(0).toUpperCase()).join('');
  }

  ngOnInit(): void {
    this.http.get<ProfilAdmin>(`${URL_AUTH}/moi`, { headers: this.headers }).subscribe({
      next: p => {
        this.appliquer(p);
        this.chargement = false;
      },
      error: (err: HttpErrorResponse) => {
        this.chargement = false;
        this.erreur = err?.error?.message || 'Impossible de charger votre profil.';
      }
    });
  }

  private appliquer(p: ProfilAdmin): void {
    this.role = p.role;
    this.photoActuelle = p.photo || '';
    this.formulaire = {
      nom: p.nom || '',
      email: p.email || '',
      telephone: p.telephone || '',
      titre: p.titre || '',
      bio: p.bio || ''
    };
  }

  choisirPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    if (!fichier) return;

    if (!fichier.type.startsWith('image/') && !/\.(heic|heif)$/i.test(fichier.name)) {
      this.erreur = 'Choisissez une image (JPG, PNG, WEBP, HEIC…).';
      input.value = '';
      return;
    }
    if (fichier.size > 10 * 1024 * 1024) {
      this.erreur = 'La photo ne doit pas dépasser 10 Mo.';
      input.value = '';
      return;
    }

    this.erreur = '';
    this.nouvellePhoto = fichier;
    this.supprimerPhoto = false;
    const lecteur = new FileReader();
    lecteur.onload = () => this.apercuPhoto = String(lecteur.result || '');
    lecteur.readAsDataURL(fichier);
    input.value = '';
  }

  retirerPhoto(): void {
    this.nouvellePhoto = null;
    this.apercuPhoto = '';
    this.supprimerPhoto = !!this.photoActuelle;
  }

  enregistrer(): void {
    this.message = '';
    this.erreur = '';

    if (this.formulaire.nom.trim().length < 2) {
      this.erreur = 'Le nom doit contenir au moins 2 caractères.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formulaire.email.trim())) {
      this.erreur = 'Adresse e-mail invalide.';
      return;
    }

    const donnees = new FormData();
    donnees.append('nom', this.formulaire.nom.trim());
    donnees.append('email', this.formulaire.email.trim());
    donnees.append('telephone', this.formulaire.telephone.trim());
    donnees.append('titre', this.formulaire.titre.trim());
    donnees.append('bio', this.formulaire.bio.trim());
    if (this.nouvellePhoto) {
      donnees.append('photo', this.nouvellePhoto);
    } else if (this.supprimerPhoto) {
      donnees.append('supprimerPhoto', 'true');
    }

    this.enregistrement = true;

    this.http.put<{ message: string; admin: ProfilAdmin }>(`${URL_AUTH}/moi`, donnees, { headers: this.headers }).subscribe({
      next: r => {
        this.enregistrement = false;
        this.message = r.message || 'Profil mis à jour.';
        this.appliquer(r.admin);
        this.nouvellePhoto = null;
        this.apercuPhoto = '';
        this.supprimerPhoto = false;

        // Met à jour le nom / la photo affichés dans la barre latérale
        try {
          const actuel = JSON.parse(localStorage.getItem('adminData') || '{}');
          localStorage.setItem('adminData', JSON.stringify({ ...actuel, ...r.admin }));
        } catch {
          localStorage.setItem('adminData', JSON.stringify(r.admin));
        }
        window.dispatchEvent(new Event(EVENEMENT_PROFIL_MAJ));
      },
      error: (err: HttpErrorResponse) => {
        this.enregistrement = false;
        this.erreur = err?.error?.message || "Erreur lors de l'enregistrement du profil.";
      }
    });
  }

  changerMotDePasse(): void {
    this.mdpMessage = '';
    this.mdpErreur = '';

    if (!this.mdp.actuel || !this.mdp.nouveau) {
      this.mdpErreur = 'Renseignez le mot de passe actuel et le nouveau.';
      return;
    }
    if (this.mdp.nouveau.length < 8) {
      this.mdpErreur = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
      return;
    }
    if (this.mdp.nouveau !== this.mdp.confirmation) {
      this.mdpErreur = 'La confirmation ne correspond pas au nouveau mot de passe.';
      return;
    }

    this.mdpEnCours = true;

    this.http.put<{ message: string }>(
      `${URL_AUTH}/moi/mot-de-passe`,
      { actuel: this.mdp.actuel, nouveau: this.mdp.nouveau },
      { headers: this.headers }
    ).subscribe({
      next: r => {
        this.mdpEnCours = false;
        this.mdpMessage = r.message || 'Mot de passe modifié.';
        this.mdp = { actuel: '', nouveau: '', confirmation: '' };
      },
      error: (err: HttpErrorResponse) => {
        this.mdpEnCours = false;
        this.mdpErreur = err?.error?.message || 'Erreur lors du changement de mot de passe.';
      }
    });
  }
}
