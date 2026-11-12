// televersement-r2.service.ts
import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

/**
 * Téléversement multipart direct navigateur → Cloudflare R2.
 *
 * Le backend crée le Multipart Upload, signe chaque partie (URL présignée
 * limitée dans le temps), puis vérifie les ETags et la taille avant de
 * finaliser. Aucune clé Cloudflare n'est présente dans l'admin.
 */

const URL_API = 'https://flechissons.com/api/uploads/multipart';

// Reprise après fermeture de l'admin (le serveur nettoie au bout de 24 h)
const CLE_REPRISES = 'televersementsEnCours';
const DUREE_REPRISE_MS = 20 * 60 * 60 * 1000;

// Parties envoyées en parallèle
const PARALLELE = 4;

// Tentatives par partie (hors coupure réseau, qui met en pause sans compter)
const ESSAIS_MAX = 6;

// Délai maximum pour envoyer une partie
const DELAI_PARTIE_MS = 10 * 60 * 1000;

// Fréquence de rafraîchissement de la barre de progression
const RAFRAICHISSEMENT_MS = 250;

const CONFIG_PAR_DEFAUT: ConfigurationTeleversement = {
  tailleMax: 5120 * 1024 * 1024,
  tailleMaxMo: 5120,
  extensions: ['mp3', 'wav', 'm4a', 'aac', 'mp4', 'mov', 'webm'],
  mimes: [
    'audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/x-mp3',
    'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
    'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/x-aac', 'audio/aacp', 'audio/x-hx-aac-adts',
    'video/mp4', 'application/mp4', 'video/quicktime', 'video/webm', 'audio/webm'
  ]
};

export type StatutTeleversement =
  'attente' | 'en_cours' | 'pause' | 'finalisation' | 'termine' | 'echec' | 'annule';

export interface ConfigurationTeleversement {
  tailleMax: number;
  tailleMaxMo: number;
  extensions: string[];
  mimes: string[];
}

export interface ResultatTeleversement {
  televersementId: string;
  url: string;
  key: string;
  nature: 'audio' | 'video';
}

export interface EtatTeleversement {
  statut: StatutTeleversement;
  pourcentage: number;
  octetsEnvoyes: number;
  taille: number;
  /** Octets par seconde (0 si inconnu) */
  vitesse: number;
  secondesRestantes: number | null;
  message: string | null;
  reprise: boolean;
  resultat: ResultatTeleversement | null;
}

interface SessionServeur {
  televersementId: string;
  key: string;
  nomOriginal: string;
  nature: 'audio' | 'video';
  taille: number;
  taillePartie: number;
  nombreParties: number;
  statut: string;
  url: string | null;
}

interface PartieRecue {
  numeroPartie: number;
  etag: string;
  taille?: number;
}

interface Reprise {
  televersementId: string;
  nom: string;
  date: number;
}

/** Erreur à ne pas retenter (refus du serveur, CORS mal configuré…) */
class ErreurDefinitive extends Error {}

/** La requête vers R2 a échoué avant qu'un seul octet parte (CORS bloqué, R2 injoignable…) */
class ErreurConnexionR2 extends Error {}

// Nombre d'URL signées demandées en un seul appel (maximum accepté par le backend : 20)
const URLS_PAR_LOT = 20;

// Une URL est redemandée si elle expire dans moins de 2 minutes
const MARGE_EXPIRATION_MS = 2 * 60 * 1000;

const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms));


// =====================================================
// TÂCHE : UN FICHIER EN COURS DE TÉLÉVERSEMENT
// =====================================================

export class TacheTeleversement {

  private readonly etat$: BehaviorSubject<EtatTeleversement>;
  readonly etat: Observable<EtatTeleversement>;

  private session: SessionServeur | null = null;
  private readonly etags = new Map<number, string>();
  private readonly chargeEnVol = new Map<number, number>();
  private readonly xhrs = new Set<XMLHttpRequest>();
  private readonly attenteReseau = new Set<() => void>();
  /** URL présignées déjà obtenues (signées par lots pour limiter les allers-retours) */
  private readonly urls = new Map<number, { url: string; expire: number }>();
  /** Parties pas encore envoyées, pour signer les suivantes en avance */
  private fileAttente: number[] = [];
  private signatureEnCours: Promise<void> | null = null;

  private execution: Promise<void> | null = null;
  private arrete = false;
  private annulee = false;
  /** Une partie a échoué définitivement : les autres ne doivent pas être retentées */
  private lotEnErreur = false;

  private echantillons: { t: number; o: number }[] = [];
  private dernierRafraichissement = 0;

  constructor(
    private readonly service: TeleversementR2Service,
    private readonly zone: NgZone,
    readonly fichier: File
  ) {
    this.etat$ = new BehaviorSubject<EtatTeleversement>({
      statut: 'attente',
      pourcentage: 0,
      octetsEnvoyes: 0,
      taille: fichier.size,
      vitesse: 0,
      secondesRestantes: null,
      message: null,
      reprise: false,
      resultat: null
    });
    this.etat = this.etat$.asObservable();
  }

  get statut(): StatutTeleversement {
    return this.etat$.value.statut;
  }

  /** Démarre ou reprend le téléversement */
  demarrer(): void {
    if (this.execution || this.annulee || this.statut === 'termine') {
      return;
    }
    this.arrete = false;
    this.execution = this.executer().finally(() => { this.execution = null; });
  }

  /** Reprend après un échec (les parties déjà reçues ne sont pas renvoyées) */
  reprendre(): void {
    this.demarrer();
  }

  /** Arrête les transferts mais garde la reprise possible (changement de page) */
  suspendre(): void {
    this.arrete = true;
    this.interrompreTransferts();
  }

  /** Annule définitivement : supprime l'upload (ou le fichier non publié) sur R2 */
  async annuler(): Promise<void> {
    this.annulee = true;
    this.arrete = true;
    this.interrompreTransferts();
    this.service.supprimerReprise(this.fichier);
    this.maj({ statut: 'annule', message: 'Téléversement annulé.', vitesse: 0, secondesRestantes: null });

    const id = this.session?.televersementId;
    if (id) {
      await this.service.annuler(id).catch(() => undefined);
    }
  }

  // ---------------------------------------------------
  // DÉROULEMENT
  // ---------------------------------------------------

  private async executer(): Promise<void> {
    try {
      this.maj({ statut: 'en_cours', message: null });

      await this.preparerSession();
      if (this.arrete) return;

      const session = this.session!;

      if (session.statut === 'termine' && session.url) {
        this.terminer(session);
        return;
      }

      const restantes: number[] = [];
      for (let n = 1; n <= session.nombreParties; n++) {
        if (!this.etags.has(n)) restantes.push(n);
      }

      await this.envoyerParties(restantes);
      if (this.arrete) return;

      await this.finaliser();

    } catch (err) {
      if (this.arrete) return;

      this.interrompreTransferts();
      this.maj({
        statut: 'echec',
        message: this.service.messageErreur(err),
        vitesse: 0,
        secondesRestantes: null
      });
    }
  }

  /** Nouvelle session, ou reprise d'une session existante (même fichier) */
  private async preparerSession(): Promise<void> {

    // Reprise : on se resynchronise toujours sur ce que R2 a vraiment reçu
    const id = this.session?.televersementId || this.service.lireReprise(this.fichier)?.televersementId;

    if (id) {
      try {
        const etat = await this.service.parties(id);

        if (etat.taille === this.fichier.size && (etat.statut === 'en_cours' || etat.statut === 'termine')) {
          this.session = etat;
          this.etags.clear();
          for (const p of etat.parties) {
            this.etags.set(p.numeroPartie, p.etag);
          }

          if (this.etags.size) {
            this.maj({
              reprise: true,
              message: `Reprise : ${this.etags.size} partie(s) sur ${etat.nombreParties} déjà enregistrée(s).`
            });
          }
          this.rafraichir(true);
          return;
        }
      } catch (err) {
        // Coupure réseau : inutile de recréer un upload, on réessaiera
        if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
          throw err;
        }
      }

      this.service.supprimerReprise(this.fichier);
      this.session = null;
      this.etags.clear();
    }

    this.session = await this.service.initier(this.fichier);
    this.service.enregistrerReprise(this.fichier, this.session.televersementId);
  }

  /** Envoie les parties en parallèle ; la première erreur définitive arrête tout */
  private async envoyerParties(numeros: number[]): Promise<void> {
    const fileAttente = [...numeros];
    this.fileAttente = fileAttente;
    let erreur: unknown = null;
    this.lotEnErreur = false;

    const travailleur = async () => {
      while (fileAttente.length && !this.arrete && !erreur) {
        const numero = fileAttente.shift()!;
        try {
          await this.envoyerPartieAvecEssais(numero);
        } catch (err) {
          if (!erreur) {
            erreur = err;
            this.lotEnErreur = true;
            this.interrompreTransferts();
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(PARALLELE, fileAttente.length) }, travailleur)
    );

    if (erreur && !this.arrete) {
      throw erreur;
    }
  }

  private async envoyerPartieAvecEssais(numero: number): Promise<void> {
    let essai = 0;

    while (true) {
      essai++;
      try {
        const url = await this.urlPartie(numero);
        const etag = await this.envoyerPartie(url, numero);

        this.etags.set(numero, etag);
        this.chargeEnVol.delete(numero);
        this.urls.delete(numero);
        this.rafraichir();
        return;

      } catch (err) {
        this.chargeEnVol.delete(numero);
        // URL peut-être expirée ou refusée : une nouvelle sera signée au prochain essai
        this.urls.delete(numero);

        if (this.arrete || this.lotEnErreur || err instanceof ErreurDefinitive || this.estRefusServeur(err)) {
          throw err;
        }

        // R2 bloque la connexion dès le départ alors qu'Internet fonctionne et
        // qu'aucune partie n'est jamais passée : c'est une configuration, pas le réseau
        if (err instanceof ErreurConnexionR2 && navigator.onLine && this.etags.size === 0 && essai >= 2) {
          throw new ErreurDefinitive(
            "Cloudflare R2 refuse la connexion depuis cette application. " +
            "Vérifiez que l'origine de l'admin est autorisée dans la règle CORS du bucket."
          );
        }

        // Coupure réseau : pause, reprise automatique au retour de la connexion
        if (!navigator.onLine) {
          essai--;
          await this.attendreConnexion();
          if (this.arrete || this.lotEnErreur) throw err;
          continue;
        }

        if (essai >= ESSAIS_MAX) {
          throw err;
        }

        await attendre(Math.min(1000 * 2 ** (essai - 1), 30000));
      }
    }
  }

  /** URL présignée de la partie ; les suivantes de la file sont signées dans le même appel */
  private async urlPartie(numero: number): Promise<string> {
    for (let i = 0; i < 2; i++) {
      const connue = this.urls.get(numero);
      if (connue && connue.expire - Date.now() > MARGE_EXPIRATION_MS) {
        return connue.url;
      }

      // Un seul appel de signature à la fois : les autres envois attendent son résultat
      if (this.signatureEnCours) {
        await this.signatureEnCours.catch(() => undefined);
        continue;
      }

      const lot = [numero, ...this.fileAttente.filter(n => n !== numero && !this.urls.has(n))]
        .slice(0, URLS_PAR_LOT);

      this.signatureEnCours = this.service.signerLot(this.session!.televersementId, lot)
        .then(({ urls, expireDans }) => {
          const expire = Date.now() + expireDans * 1000;
          for (const u of urls) this.urls.set(u.numeroPartie, { url: u.url, expire });
        })
        .finally(() => { this.signatureEnCours = null; });

      await this.signatureEnCours;
    }

    const url = this.urls.get(numero)?.url;
    if (url) return url;

    // Lot signé sans cette partie (cas improbable) : demande individuelle
    return this.service.signer(this.session!.televersementId, numero);
  }

  /** PUT direct vers R2 ; renvoie l'ETag de la partie */
  private envoyerPartie(url: string, numero: number): Promise<string> {
    const session = this.session!;
    const debut = (numero - 1) * session.taillePartie;
    const fin = Math.min(debut + session.taillePartie, this.fichier.size);
    const morceau = this.fichier.slice(debut, fin);

    return new Promise<string>((resolve, reject) => {

      // Hors zone Angular : la barre est rafraîchie à intervalle régulier
      this.zone.runOutsideAngular(() => {
        const xhr = new XMLHttpRequest();
        this.xhrs.add(xhr);

        const finir = () => this.xhrs.delete(xhr);
        let progression = false;

        xhr.open('PUT', url, true);
        xhr.timeout = DELAI_PARTIE_MS;

        xhr.upload.onprogress = (e) => {
          if (e.loaded > 0) progression = true;
          this.chargeEnVol.set(numero, e.loaded);
          this.rafraichir();
        };

        xhr.onload = () => {
          finir();
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader('ETag');
            if (!etag) {
              reject(new ErreurDefinitive(
                "Cloudflare R2 n'expose pas l'en-tête ETag. Vérifiez la règle CORS du bucket (ExposeHeaders : ETag)."
              ));
              return;
            }
            resolve(etag);
          } else {
            // 403 (URL expirée) : une nouvelle URL sera signée à la tentative suivante
            reject(new Error(`R2 a refusé la partie ${numero} (HTTP ${xhr.status}).`));
          }
        };

        xhr.onerror = () => {
          finir();
          reject(progression
            ? new Error('Erreur réseau pendant le transfert.')
            : new ErreurConnexionR2('Connexion à Cloudflare R2 impossible.'));
        };
        xhr.ontimeout = () => { finir(); reject(new Error('Délai dépassé pendant le transfert.')); };
        xhr.onabort = () => { finir(); reject(new Error('Transfert interrompu.')); };

        xhr.send(morceau);
      });
    });
  }

  private async finaliser(): Promise<void> {
    for (let essai = 1; ; essai++) {
      if (this.arrete) return;

      this.maj({ statut: 'finalisation', message: null, vitesse: 0, secondesRestantes: null });

      try {
        const parties = [...this.etags.entries()].map(([numeroPartie, etag]) => ({ numeroPartie, etag }));
        const session = await this.service.finaliser(this.session!.televersementId, parties);
        this.terminer(session);
        return;

      } catch (err) {
        if (!(err instanceof HttpErrorResponse) || essai >= 3) {
          throw err;
        }

        // Parties manquantes ou invalides : on les renvoie puis on refinalise
        if (err.status === 422 && (err.error?.partiesManquantes || err.error?.partiesInvalides)) {
          const aRenvoyer: number[] = [...(err.error.partiesManquantes || []), ...(err.error.partiesInvalides || [])];
          aRenvoyer.forEach(n => this.etags.delete(n));
          this.maj({ statut: 'en_cours' });
          await this.envoyerParties(aRenvoyer);
          continue;
        }

        if (err.status === 0 || err.status >= 500) {
          if (!navigator.onLine) {
            await this.attendreConnexion();
          } else {
            await attendre(2000 * essai);
          }
          continue;
        }

        throw err;
      }
    }
  }

  private terminer(session: SessionServeur): void {
    this.service.supprimerReprise(this.fichier);
    this.session = session;
    this.maj({
      statut: 'termine',
      pourcentage: 100,
      octetsEnvoyes: this.fichier.size,
      vitesse: 0,
      secondesRestantes: 0,
      message: null,
      resultat: {
        televersementId: session.televersementId,
        url: session.url!,
        key: session.key,
        nature: session.nature
      }
    });
  }

  // ---------------------------------------------------
  // OUTILS
  // ---------------------------------------------------

  /** Refus clair du backend (400, 401, 403, 404, 409, 410…) : inutile de réessayer */
  private estRefusServeur(err: unknown): boolean {
    return err instanceof HttpErrorResponse &&
      err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
  }

  private attendreConnexion(): Promise<void> {
    this.zone.run(() => this.maj({
      statut: 'pause',
      vitesse: 0,
      secondesRestantes: null,
      message: 'Connexion perdue. Le téléversement reprendra automatiquement dès le retour du réseau.'
    }));

    return new Promise<void>((resolve) => {
      const reprendre = () => {
        window.removeEventListener('online', reprendre);
        this.attenteReseau.delete(reprendre);
        if (!this.arrete) {
          this.zone.run(() => this.maj({ statut: 'en_cours', message: 'Connexion rétablie, reprise du téléversement…' }));
        }
        resolve();
      };
      this.attenteReseau.add(reprendre);
      window.addEventListener('online', reprendre);
    });
  }

  private interrompreTransferts(): void {
    this.xhrs.forEach(xhr => xhr.abort());
    this.xhrs.clear();
    this.chargeEnVol.clear();
    [...this.attenteReseau].forEach(fn => fn());
  }

  private octetsEnvoyes(): number {
    const session = this.session;
    if (!session) return 0;

    let total = 0;
    for (const numero of this.etags.keys()) {
      total += numero < session.nombreParties
        ? session.taillePartie
        : session.taille - session.taillePartie * (session.nombreParties - 1);
    }
    for (const charge of this.chargeEnVol.values()) {
      total += charge;
    }
    return Math.min(total, this.fichier.size);
  }

  /** Met à jour pourcentage, vitesse et temps restant (limité à 4 fois par seconde) */
  private rafraichir(force = false): void {
    const maintenant = Date.now();
    if (!force && maintenant - this.dernierRafraichissement < RAFRAICHISSEMENT_MS) {
      return;
    }
    this.dernierRafraichissement = maintenant;

    const envoyes = this.octetsEnvoyes();

    this.echantillons.push({ t: maintenant, o: envoyes });
    this.echantillons = this.echantillons.filter(e => maintenant - e.t <= 8000);

    const premier = this.echantillons[0];
    const duree = maintenant - premier.t;
    const vitesse = duree >= 1000 ? Math.max(0, (envoyes - premier.o) / duree * 1000) : this.etat$.value.vitesse;

    const restant = this.fichier.size - envoyes;

    this.zone.run(() => this.maj({
      octetsEnvoyes: envoyes,
      // 100 % uniquement après vérification par le serveur
      pourcentage: Math.min(99, Math.floor(envoyes / this.fichier.size * 100)),
      vitesse,
      secondesRestantes: vitesse > 0 ? Math.ceil(restant / vitesse) : null
    }));
  }

  private maj(partiel: Partial<EtatTeleversement>): void {
    if (this.annulee && partiel.statut && partiel.statut !== 'annule') {
      return;
    }
    this.etat$.next({ ...this.etat$.value, ...partiel });
  }
}


// =====================================================
// SERVICE
// =====================================================

@Injectable({ providedIn: 'root' })
export class TeleversementR2Service {

  private configuration$?: Observable<ConfigurationTeleversement>;

  constructor(
    private http: HttpClient,
    private zone: NgZone
  ) {}

  /** Formats acceptés et taille maximale (définis par le backend) */
  configuration(): Observable<ConfigurationTeleversement> {
    if (!this.configuration$) {
      this.configuration$ = this.http
        .get<ConfigurationTeleversement>(`${URL_API}/config`, { headers: this.entetes() })
        .pipe(
          map(c => ({ ...CONFIG_PAR_DEFAUT, ...c })),
          catchError(() => {
            this.configuration$ = undefined;
            return of(CONFIG_PAR_DEFAUT);
          }),
          shareReplay(1)
        );
    }
    return this.configuration$;
  }

  /** Vérifie extension, type MIME et taille avant tout envoi. Renvoie un message d'erreur ou null. */
  verifierFichier(fichier: File, config: ConfigurationTeleversement): string | null {
    const extension = fichier.name.includes('.') ? fichier.name.split('.').pop()!.toLowerCase() : '';

    if (!config.extensions.includes(extension)) {
      return 'Format non pris en charge. Utilisez MP3, WAV, M4A, AAC, MP4, MOV ou WebM.';
    }

    const mime = (fichier.type || '').toLowerCase();
    if (mime && mime !== 'application/octet-stream' && !config.mimes.includes(mime)) {
      return `Le type du fichier (${mime}) ne correspond pas à un audio ou une vidéo autorisé.`;
    }

    if (fichier.size <= 0) {
      return 'Le fichier est vide.';
    }

    if (fichier.size > config.tailleMax) {
      return `Le fichier dépasse la taille maximale autorisée (${this.formaterTaille(config.tailleMax)}).`;
    }

    return null;
  }

  creerTache(fichier: File): TacheTeleversement {
    return new TacheTeleversement(this, this.zone, fichier);
  }

  // ---------------------------------------------------
  // APPELS BACKEND
  // ---------------------------------------------------

  initier(fichier: File): Promise<SessionServeur> {
    return firstValueFrom(this.http.post<SessionServeur>(
      `${URL_API}/initiate`,
      { nomFichier: fichier.name, taille: fichier.size, typeMime: fichier.type || '' },
      { headers: this.entetes() }
    ));
  }

  /** Signe plusieurs parties en un seul appel */
  signerLot(televersementId: string, numerosParties: number[])
    : Promise<{ expireDans: number; urls: { numeroPartie: number; url: string }[] }> {
    return firstValueFrom(this.http.post<{ expireDans: number; urls: { numeroPartie: number; url: string }[] }>(
      `${URL_API}/presign-part`,
      { televersementId, numerosParties },
      { headers: this.entetes() }
    ));
  }

  async signer(televersementId: string, numeroPartie: number): Promise<string> {
    const reponse = await firstValueFrom(this.http.post<{ urls: { numeroPartie: number; url: string }[] }>(
      `${URL_API}/presign-part`,
      { televersementId, numeroPartie },
      { headers: this.entetes() }
    ));
    return reponse.urls[0].url;
  }

  parties(televersementId: string): Promise<SessionServeur & { parties: PartieRecue[] }> {
    return firstValueFrom(this.http.post<SessionServeur & { parties: PartieRecue[] }>(
      `${URL_API}/parts`,
      { televersementId },
      { headers: this.entetes() }
    ));
  }

  finaliser(televersementId: string, parties: PartieRecue[]): Promise<SessionServeur> {
    return firstValueFrom(this.http.post<SessionServeur>(
      `${URL_API}/complete`,
      { televersementId, parties },
      { headers: this.entetes() }
    ));
  }

  annuler(televersementId: string): Promise<unknown> {
    return firstValueFrom(this.http.post(
      `${URL_API}/abort`,
      { televersementId },
      { headers: this.entetes() }
    ));
  }

  // ---------------------------------------------------
  // REPRISE APRÈS FERMETURE (localStorage)
  // ---------------------------------------------------

  private signature(fichier: File): string {
    return `${fichier.name}|${fichier.size}|${fichier.lastModified}`;
  }

  private lireReprises(): Record<string, Reprise> {
    try {
      const reprises: Record<string, Reprise> = JSON.parse(localStorage.getItem(CLE_REPRISES) || '{}');
      const limite = Date.now() - DUREE_REPRISE_MS;
      for (const cle of Object.keys(reprises)) {
        if (!reprises[cle] || reprises[cle].date < limite) delete reprises[cle];
      }
      return reprises;
    } catch {
      return {};
    }
  }

  private ecrireReprises(reprises: Record<string, Reprise>): void {
    try {
      localStorage.setItem(CLE_REPRISES, JSON.stringify(reprises));
    } catch {
      // stockage plein ou indisponible : la reprise après fermeture ne sera pas possible
    }
  }

  lireReprise(fichier: File): Reprise | null {
    return this.lireReprises()[this.signature(fichier)] || null;
  }

  /** Noms des fichiers dont le téléversement peut être repris */
  repriseEnAttente(): string[] {
    return Object.values(this.lireReprises()).map(r => r.nom);
  }

  enregistrerReprise(fichier: File, televersementId: string): void {
    const reprises = this.lireReprises();
    reprises[this.signature(fichier)] = { televersementId, nom: fichier.name, date: Date.now() };
    this.ecrireReprises(reprises);
  }

  supprimerReprise(fichier: File): void {
    const reprises = this.lireReprises();
    delete reprises[this.signature(fichier)];
    this.ecrireReprises(reprises);
  }

  // ---------------------------------------------------
  // OUTILS
  // ---------------------------------------------------

  messageErreur(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
      if (err.status === 401) return 'Votre session a expiré. Reconnectez-vous puis reprenez le téléversement.';
      if (err.error && typeof err.error === 'object' && err.error.message) return err.error.message;
      return `Erreur serveur (${err.status}).`;
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'Erreur inattendue pendant le téléversement.';
  }

  formaterTaille(octets: number): string {
    if (!octets) return '0 o';
    const unites = ['o', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.min(Math.floor(Math.log(octets) / Math.log(1024)), unites.length - 1);
    const valeur = octets / Math.pow(1024, i);
    return `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: i >= 2 ? 1 : 0 })} ${unites[i]}`;
  }

  private entetes(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }
}
