// messagerie.service.ts
// Messagerie entre le pasteur / les administrateurs et les utilisateurs de l'app mobile
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, timer } from 'rxjs';
import { getAdminRole } from './auth.util';

export const URL_MESSAGERIE = 'https://flechissons.com/messagerie/admin';

export interface InterlocuteurUtilisateur {
  id: string;
  nom: string;
  prenom: string;
  photo: string;
  email: string;
}

export interface ConversationAdmin {
  _id: string;
  interlocuteur: InterlocuteurUtilisateur | null;
  dernierMessage: { texte: string; auteur: 'utilisateur' | 'admin'; date: string } | null;
  nonLus: number;
  updatedAt: string;
}

export interface MessageChat {
  _id: string;
  conversation: string;
  auteur: 'utilisateur' | 'admin';
  texte: string;
  image?: { url: string | null } | null;
  luLe: string | null;
  createdAt: string;
}

export interface PageMessages {
  messages: MessageChat[];
  complet: boolean;
  luParInterlocuteurJusqua: string | null;
}

/** Le trésorier n'a pas accès à la messagerie (admin et superadmin seulement) */
export function peutUtiliserMessagerie(): boolean {
  return ['admin', 'superadmin'].includes(getAdminRole());
}

export function nomComplet(u: InterlocuteurUtilisateur | null): string {
  if (!u) return 'Compte supprimé';
  return [u.prenom, u.nom].filter(Boolean).join(' ').trim() || u.email || 'Utilisateur';
}

export function initiales(u: InterlocuteurUtilisateur | null): string {
  const nom = nomComplet(u);
  return nom.split(/\s+/).slice(0, 2).map(m => m.charAt(0).toUpperCase()).join('') || '?';
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {

  /** Total des messages non lus (badge du menu) */
  private readonly nonLusSujet = new BehaviorSubject<number>(0);
  readonly nonLus$ = this.nonLusSujet.asObservable();

  private surveillance?: Subscription;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  /** Dernier total connu (null = premier chargement : pas de notification) */
  private dernierTotal: number | null = null;

  /** Actualise le badge toutes les 20 secondes */
  demarrerSurveillance(): void {
    if (this.surveillance || !peutUtiliserMessagerie()) return;
    // Notifications de bureau (Windows / navigateur) pour les nouveaux messages
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    this.surveillance = timer(0, 20000).subscribe(() => this.rafraichirNonLus());
  }

  arreterSurveillance(): void {
    this.surveillance?.unsubscribe();
    this.surveillance = undefined;
    this.dernierTotal = null;
    this.nonLusSujet.next(0);
  }

  rafraichirNonLus(): void {
    this.http.get<{ nonLus: number }>(`${URL_MESSAGERIE}/non-lus`, { headers: this.headers })
      .subscribe({
        next: r => {
          const total = r.nonLus || 0;
          if (this.dernierTotal !== null && total > this.dernierTotal) {
            this.notifierBureau(total - this.dernierTotal);
          }
          this.dernierTotal = total;
          this.nonLusSujet.next(total);
        },
        error: () => {}
      });
  }

  /** Notification Windows / navigateur, sauf si la page Messagerie est déjà sous les yeux */
  private notifierBureau(nouveaux: number): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && location.pathname.includes('/admin/messagerie')) return;
    const notification = new Notification('Fléchissons — Messagerie', {
      body: nouveaux > 1 ? `${nouveaux} nouveaux messages d'utilisateurs` : "Nouveau message d'un utilisateur",
      icon: '/images/logo.png',
      tag: 'flechissons-messagerie'
    });
    notification.onclick = () => {
      window.focus();
      // Écouté par AdminComponent, qui ouvre la page Messagerie
      window.dispatchEvent(new CustomEvent('ouvrir-messagerie'));
      notification.close();
    };
  }

  conversations(): Observable<{ conversations: ConversationAdmin[] }> {
    return this.http.get<{ conversations: ConversationAdmin[] }>(`${URL_MESSAGERIE}/conversations`, { headers: this.headers });
  }

  rechercherUtilisateurs(recherche: string): Observable<{ utilisateurs: InterlocuteurUtilisateur[] }> {
    const params = new HttpParams().set('recherche', recherche);
    return this.http.get<{ utilisateurs: InterlocuteurUtilisateur[] }>(`${URL_MESSAGERIE}/utilisateurs`, { headers: this.headers, params });
  }

  ouvrir(utilisateurId: string): Observable<{ conversation: ConversationAdmin }> {
    return this.http.post<{ conversation: ConversationAdmin }>(`${URL_MESSAGERIE}/conversations`, { utilisateurId }, { headers: this.headers });
  }

  messages(conversationId: string, options: { avant?: string; apres?: string } = {}): Observable<PageMessages> {
    let params = new HttpParams();
    if (options.avant) params = params.set('avant', options.avant);
    if (options.apres) params = params.set('apres', options.apres);
    return this.http.get<PageMessages>(`${URL_MESSAGERIE}/conversations/${conversationId}/messages`, { headers: this.headers, params });
  }

  /** Texte seul en JSON ; avec une photo, envoi multipart (légende facultative) */
  envoyer(conversationId: string, texte: string, photo?: File | null): Observable<{ message: MessageChat }> {
    const url = `${URL_MESSAGERIE}/conversations/${conversationId}/messages`;
    if (!photo) {
      return this.http.post<{ message: MessageChat }>(url, { texte }, { headers: this.headers });
    }
    const donnees = new FormData();
    donnees.append('photo', photo, photo.name);
    if (texte) donnees.append('texte', texte);
    return this.http.post<{ message: MessageChat }>(url, donnees, { headers: this.headers });
  }
}
