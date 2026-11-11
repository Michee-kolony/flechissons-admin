// televersement-media.component.ts
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';

import {
  ConfigurationTeleversement,
  EtatTeleversement,
  ResultatTeleversement,
  StatutTeleversement,
  TacheTeleversement,
  TeleversementR2Service
} from '../../shared/televersement-r2.service';

/**
 * Sélection d'un fichier audio / vidéo et téléversement direct vers Cloudflare R2.
 * Émet (termine) avec le lien public une fois le fichier vérifié par le serveur.
 */
@Component({
  selector: 'app-televersement-media',
  templateUrl: './televersement-media.component.html',
  styleUrl: './televersement-media.component.css',
  standalone: false
})
export class TeleversementMediaComponent implements OnInit, OnDestroy {

  @Input() desactive = false;

  /** Fichier enregistré et vérifié sur R2 */
  @Output() termine = new EventEmitter<ResultatTeleversement>();

  /** Fichier retiré ou annulé : plus aucun média */
  @Output() reinitialise = new EventEmitter<void>();

  /** true tant qu'un transfert est en cours (publication impossible) */
  @Output() occupe = new EventEmitter<boolean>();

  config: ConfigurationTeleversement | null = null;
  tache: TacheTeleversement | null = null;
  etat: EtatTeleversement | null = null;

  erreurSelection: string | null = null;
  reprisesEnAttente: string[] = [];
  survol = false;
  annulationEnCours = false;

  private abonnements = new Subscription();
  private abonnementTache?: Subscription;
  private etaitOccupe = false;

  constructor(private televersementService: TeleversementR2Service) {}

  ngOnInit(): void {
    this.abonnements.add(
      this.televersementService.configuration().subscribe(config => this.config = config)
    );
    this.reprisesEnAttente = this.televersementService.repriseEnAttente();
  }

  ngOnDestroy(): void {
    // Changement de page pendant un transfert : on suspend sans annuler,
    // le téléversement pourra être repris en sélectionnant le même fichier.
    if (this.tache && this.estOccupe(this.tache.statut)) {
      this.tache.suspendre();
    }
    this.abonnementTache?.unsubscribe();
    this.abonnements.unsubscribe();
    this.signalerOccupation(false);
  }

  // =====================================================
  // SÉLECTION DU FICHIER
  // =====================================================

  get accept(): string {
    const extensions = (this.config?.extensions || ['mp3', 'wav', 'm4a', 'aac', 'mp4', 'mov', 'webm'])
      .map(e => `.${e}`);
    return [...extensions, 'audio/*', 'video/*'].join(',');
  }

  get formatsLisibles(): string {
    return (this.config?.extensions || []).map(e => e.toUpperCase()).join(', ')
      || 'MP3, WAV, M4A, AAC, MP4, MOV, WEBM';
  }

  onFichierChoisi(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (fichier) {
      this.choisir(fichier);
    }
  }

  onSurvol(event: DragEvent, actif: boolean): void {
    event.preventDefault();
    this.survol = actif && !this.desactive;
  }

  onDepot(event: DragEvent): void {
    event.preventDefault();
    this.survol = false;
    if (this.desactive || this.tache) return;

    const fichier = event.dataTransfer?.files?.[0];
    if (fichier) {
      this.choisir(fichier);
    }
  }

  private choisir(fichier: File): void {
    this.erreurSelection = null;

    const config = this.config;
    if (!config) {
      this.erreurSelection = 'Configuration en cours de chargement, réessayez dans un instant.';
      return;
    }

    const erreur = this.televersementService.verifierFichier(fichier, config);
    if (erreur) {
      this.erreurSelection = erreur;
      return;
    }

    this.lancer(fichier);
  }

  private lancer(fichier: File): void {
    this.abonnementTache?.unsubscribe();

    const tache = this.televersementService.creerTache(fichier);
    this.tache = tache;

    this.abonnementTache = tache.etat.subscribe(etat => {
      const precedent = this.etat?.statut;
      this.etat = etat;
      this.signalerOccupation(this.estOccupe(etat.statut));

      if (etat.statut === 'termine' && precedent !== 'termine' && etat.resultat) {
        this.reprisesEnAttente = this.televersementService.repriseEnAttente();
        this.termine.emit(etat.resultat);
      }
    });

    tache.demarrer();
  }

  // =====================================================
  // ACTIONS
  // =====================================================

  reessayer(): void {
    this.tache?.reprendre();
  }

  /** Annule le transfert (ou supprime le fichier téléversé mais pas encore publié) */
  async annuler(): Promise<void> {
    if (!this.tache || this.annulationEnCours) return;

    this.annulationEnCours = true;
    try {
      await this.tache.annuler();
    } finally {
      this.annulationEnCours = false;
      this.vider();
    }
  }

  /** Abandon silencieux (bouton Annuler du formulaire) */
  abandonner(): void {
    if (this.tache && this.tache.statut !== 'annule') {
      this.tache.annuler();
    }
  }

  private vider(): void {
    this.abonnementTache?.unsubscribe();
    this.tache = null;
    this.etat = null;
    this.signalerOccupation(false);
    this.reprisesEnAttente = this.televersementService.repriseEnAttente();
    this.reinitialise.emit();
  }

  // =====================================================
  // AFFICHAGE
  // =====================================================

  estOccupe(statut: StatutTeleversement): boolean {
    return statut === 'attente' || statut === 'en_cours' || statut === 'pause' || statut === 'finalisation';
  }

  get libelleStatut(): string {
    const libelles: Record<StatutTeleversement, string> = {
      attente: 'En attente',
      en_cours: 'En cours',
      pause: 'En pause',
      finalisation: 'Finalisation',
      termine: 'Terminé',
      echec: 'Échec',
      annule: 'Annulé'
    };
    return this.etat ? libelles[this.etat.statut] : '';
  }

  get classesStatut(): string {
    switch (this.etat?.statut) {
      case 'termine': return 'bg-green-50 text-green-700';
      case 'echec': return 'bg-red-50 text-red-700';
      case 'pause': return 'bg-amber-50 text-amber-700';
      case 'annule': return 'bg-gray-100 text-gray-600';
      default: return 'bg-orange-50 text-orange-700';
    }
  }

  get estVideo(): boolean {
    const type = this.tache?.fichier.type || '';
    const nom = this.tache?.fichier.name.toLowerCase() || '';
    return type.startsWith('video/') || /\.(mp4|mov|webm)$/.test(nom);
  }

  taille(octets: number): string {
    return this.televersementService.formaterTaille(octets);
  }

  duree(secondes: number | null): string {
    if (secondes === null || !isFinite(secondes)) return 'Calcul…';
    if (secondes < 60) return `${Math.max(1, Math.round(secondes))} s`;
    const minutes = Math.floor(secondes / 60);
    if (minutes < 60) return `${minutes} min ${Math.round(secondes % 60)} s`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }

  private signalerOccupation(occupe: boolean): void {
    if (occupe !== this.etaitOccupe) {
      this.etaitOccupe = occupe;
      this.occupe.emit(occupe);
    }
  }
}
