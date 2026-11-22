// messagerie.component.ts
// Conversations privées entre l'administrateur connecté et les utilisateurs de l'app mobile
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import {
  ConversationAdmin,
  InterlocuteurUtilisateur,
  MessageChat,
  MessagerieService,
  initiales,
  nomComplet
} from '../../shared/messagerie.service';

@Component({
  selector: 'app-messagerie',
  templateUrl: './messagerie.component.html',
  styleUrl: './messagerie.component.css'
})
export class MessagerieComponent implements OnInit, OnDestroy {

  @ViewChild('fil') fil?: ElementRef<HTMLDivElement>;

  readonly nomComplet = nomComplet;
  readonly initiales = initiales;

  // Liste
  conversations: ConversationAdmin[] = [];
  chargementListe = true;
  filtre = '';

  // Nouvelle conversation
  modeNouvelle = false;
  recherche = '';
  resultats: InterlocuteurUtilisateur[] = [];
  rechercheEnCours = false;
  private rechercheTimer: any;

  // Conversation ouverte
  active: ConversationAdmin | null = null;
  messages: MessageChat[] = [];
  chargementMessages = false;
  complet = true;
  chargementAnciens = false;
  luJusqua: string | null = null;
  texte = '';
  envoiEnCours = false;
  erreur = '';

  private actualisation?: Subscription;
  private actualisationListe?: Subscription;
  private routeSub?: Subscription;

  constructor(
    private messagerie: MessagerieService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerConversations();
    // La liste (nouveaux messages des autres conversations) s'actualise toutes les 15 s
    this.actualisationListe = timer(15000, 15000).subscribe(() => this.chargerConversations(true));

    this.routeSub = this.route.queryParamMap.subscribe(params => {
      const id = params.get('conversation');
      if (id && id !== this.active?._id) {
        const existante = this.conversations.find(c => c._id === id);
        if (existante) this.ouvrir(existante);
      }
    });
  }

  ngOnDestroy(): void {
    this.actualisation?.unsubscribe();
    this.actualisationListe?.unsubscribe();
    this.routeSub?.unsubscribe();
    clearTimeout(this.rechercheTimer);
  }


  // =====================================================
  // LISTE DES CONVERSATIONS
  // =====================================================

  get conversationsFiltrees(): ConversationAdmin[] {
    const f = this.filtre.trim().toLowerCase();
    if (!f) return this.conversations;
    return this.conversations.filter(c =>
      nomComplet(c.interlocuteur).toLowerCase().includes(f)
      || (c.interlocuteur?.email || '').toLowerCase().includes(f));
  }

  chargerConversations(silencieux = false): void {
    if (!silencieux) this.chargementListe = true;

    this.messagerie.conversations().subscribe({
      next: r => {
        this.conversations = r.conversations;
        this.chargementListe = false;

        // Conversation demandée dans l'adresse (?conversation=...)
        const id = this.route.snapshot.queryParamMap.get('conversation');
        if (!this.active && id) {
          const c = this.conversations.find(x => x._id === id);
          if (c) this.ouvrir(c);
        }

        // La conversation ouverte reste lue
        if (this.active) {
          const a = this.conversations.find(c => c._id === this.active!._id);
          if (a) a.nonLus = 0;
        }
      },
      error: (err: HttpErrorResponse) => {
        this.chargementListe = false;
        if (!silencieux) this.erreur = this.messageErreur(err, 'Impossible de charger les conversations.');
      }
    });
  }


  // =====================================================
  // NOUVELLE CONVERSATION
  // =====================================================

  basculerNouvelle(): void {
    this.modeNouvelle = !this.modeNouvelle;
    this.recherche = '';
    this.resultats = [];
    if (this.modeNouvelle) this.rechercher();
  }

  rechercher(): void {
    clearTimeout(this.rechercheTimer);
    this.rechercheTimer = setTimeout(() => {
      this.rechercheEnCours = true;
      this.messagerie.rechercherUtilisateurs(this.recherche.trim()).subscribe({
        next: r => { this.resultats = r.utilisateurs; this.rechercheEnCours = false; },
        error: () => { this.resultats = []; this.rechercheEnCours = false; }
      });
    }, 300);
  }

  demarrerAvec(utilisateur: InterlocuteurUtilisateur): void {
    this.messagerie.ouvrir(utilisateur.id).subscribe({
      next: r => {
        this.modeNouvelle = false;
        this.ouvrir(r.conversation);
      },
      error: (err: HttpErrorResponse) => this.erreur = this.messageErreur(err, "Impossible d'ouvrir la conversation.")
    });
  }


  // =====================================================
  // CONVERSATION OUVERTE
  // =====================================================

  ouvrir(conversation: ConversationAdmin): void {
    this.actualisation?.unsubscribe();
    this.active = conversation;
    this.messages = [];
    this.texte = '';
    this.erreur = '';
    this.chargementMessages = true;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { conversation: conversation._id },
      replaceUrl: true
    });

    this.messagerie.messages(conversation._id).subscribe({
      next: page => {
        this.messages = page.messages;
        this.complet = page.complet;
        this.luJusqua = page.luParInterlocuteurJusqua;
        this.chargementMessages = false;
        conversation.nonLus = 0;
        this.messagerie.rafraichirNonLus();
        this.defilerEnBas();
        // Nouveaux messages toutes les 4 secondes
        this.actualisation = timer(4000, 4000).subscribe(() => this.actualiser());
      },
      error: (err: HttpErrorResponse) => {
        this.chargementMessages = false;
        this.erreur = this.messageErreur(err, 'Impossible de charger les messages.');
      }
    });
  }

  fermer(): void {
    this.actualisation?.unsubscribe();
    this.active = null;
    this.messages = [];
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  private actualiser(): void {
    const conversation = this.active;
    if (!conversation) return;
    const dernier = this.messages[this.messages.length - 1];

    this.messagerie.messages(conversation._id, dernier ? { apres: dernier.createdAt } : {}).subscribe({
      next: page => {
        if (this.active?._id !== conversation._id) return;
        const connus = new Set(this.messages.map(m => m._id));
        const nouveaux = page.messages.filter(m => !connus.has(m._id));
        this.luJusqua = page.luParInterlocuteurJusqua;
        if (nouveaux.length) {
          const enBas = this.estEnBas();
          this.messages = [...this.messages, ...nouveaux];
          if (enBas) this.defilerEnBas();
          this.messagerie.rafraichirNonLus();
        }
      },
      error: () => {}
    });
  }

  chargerAnciens(): void {
    if (!this.active || this.complet || this.chargementAnciens || !this.messages.length) return;
    this.chargementAnciens = true;
    const el = this.fil?.nativeElement;
    const hauteurAvant = el?.scrollHeight || 0;

    this.messagerie.messages(this.active._id, { avant: this.messages[0].createdAt }).subscribe({
      next: page => {
        this.messages = [...page.messages, ...this.messages];
        this.complet = page.complet;
        this.chargementAnciens = false;
        // Garde la position de lecture
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - hauteurAvant; });
      },
      error: () => this.chargementAnciens = false
    });
  }

  envoyer(): void {
    const texte = this.texte.trim();
    if (!texte || !this.active || this.envoiEnCours) return;

    this.envoiEnCours = true;
    this.erreur = '';
    const conversation = this.active;

    this.messagerie.envoyer(conversation._id, texte).subscribe({
      next: r => {
        this.envoiEnCours = false;
        this.texte = '';
        if (!this.messages.some(m => m._id === r.message._id)) {
          this.messages = [...this.messages, r.message];
        }
        conversation.dernierMessage = { texte, auteur: 'admin', date: r.message.createdAt };
        // La conversation remonte en tête de liste
        this.conversations = [conversation, ...this.conversations.filter(c => c._id !== conversation._id)];
        this.defilerEnBas();
      },
      error: (err: HttpErrorResponse) => {
        this.envoiEnCours = false;
        this.erreur = this.messageErreur(err, "Le message n'a pas pu être envoyé.");
      }
    });
  }

  // Entrée = envoyer, Maj + Entrée = nouvelle ligne
  touche(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyer();
    }
  }


  // =====================================================
  // AFFICHAGE
  // =====================================================

  estLu(message: MessageChat): boolean {
    return message.auteur === 'admin' && !!this.luJusqua
      && new Date(message.createdAt).getTime() <= new Date(this.luJusqua).getTime();
  }

  /** Séparateur de date avant le premier message de chaque jour */
  nouveauJour(index: number): boolean {
    if (index === 0) return true;
    return new Date(this.messages[index - 1].createdAt).toDateString()
      !== new Date(this.messages[index].createdAt).toDateString();
  }

  libelleJour(date: string): string {
    const d = new Date(date);
    const aujourdhui = new Date();
    const hier = new Date();
    hier.setDate(aujourdhui.getDate() - 1);
    if (d.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  heureListe(date: string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (d.toDateString() === new Date().toDateString()) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  trackById(_: number, item: { _id: string }): string {
    return item._id;
  }

  private estEnBas(): boolean {
    const el = this.fil?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  private defilerEnBas(): void {
    setTimeout(() => {
      const el = this.fil?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private messageErreur(err: HttpErrorResponse, defaut: string): string {
    return err?.error?.message || defaut;
  }
}
