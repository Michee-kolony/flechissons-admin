import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import type { DivIcon, LatLngTuple, LeafletMouseEvent, Map as CarteLeaflet, Marker } from 'leaflet';

type Leaflet = typeof import('leaflet');

interface EgliseModel {
  _id: string;
  nom: string;
  adresse: string;
  latitude: number;
  longitude: number;
  description: string;
  updatedAt?: string;
}

interface ResultatRecherche {
  display_name: string;
  lat: string;
  lon: string;
}

// Centre affiché tant qu'aucune position n'est enregistrée (Kinshasa)
const CENTRE_PAR_DEFAUT: LatLngTuple = [-4.3217, 15.3125];

// Tuiles OpenStreetMap : sans clé d'API. URL sans sous-domaine {s} (recommandée, servie en HTTP/2 par CDN).
// Le mode sombre est obtenu par un filtre CSS sur les tuiles (voir styles.css) : bascule instantanée.
const URL_TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Dernière position connue de l'église : la carte s'y place sans attendre l'API
const CLE_POSITION = 'eglisePosition';

@Component({
  selector: 'app-eglise',
  templateUrl: './eglise.component.html',
  styleUrl: './eglise.component.css'
})
export class EgliseComponent implements AfterViewInit, OnDestroy {

  @ViewChild('carte') carteRef!: ElementRef<HTMLDivElement>;

  private urlEglise = 'https://flechissons.com/eglise';

  // Leaflet est chargé à la demande : il ne pèse plus sur le bundle principal
  private L?: Leaflet;
  private carte?: CarteLeaflet;
  private marqueur?: Marker;
  private iconeEglise?: DivIcon;
  private observateurTaille?: ResizeObserver;

  // Une seule vue initiale : évite de charger les tuiles du centre par défaut puis celles de l'église
  private vueDefinie = false;
  private positionEnAttente = false;
  private detruit = false;

  eglise: EgliseModel | null = null;

  loading = false;
  loadingEglise = false;
  loadingRecherche = false;

  message = '';
  errorMessage = '';

  resultatsRecherche: ResultatRecherche[] = [];

  formData = {
    nom: '',
    adresse: '',
    latitude: null as number | null,
    longitude: null as number | null,
    description: ''
  };


  constructor(
    private http: HttpClient,
    private zone: NgZone
  ) {}


  ngAfterViewInit(): void {
    // Données et bibliothèque se chargent en parallèle
    this.getEglise();
    this.initialiserCarte();
  }


  ngOnDestroy(): void {
    this.detruit = true;
    this.observateurTaille?.disconnect();
    this.carte?.remove();
  }


  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }


  get positionValide(): boolean {
    const { latitude, longitude } = this.formData;
    return latitude !== null && longitude !== null
      && Number.isFinite(+latitude) && Number.isFinite(+longitude)
      && Math.abs(+latitude) <= 90 && Math.abs(+longitude) <= 180;
  }


  // =====================================================
  // CARTE
  // =====================================================

  private async initialiserCarte(): Promise<void> {

    const module = await import('leaflet');
    if (this.detruit) {
      return;
    }

    const L: Leaflet = (module as any).default ?? module;
    this.L = L;

    // Marqueur en CSS : évite les images par défaut de Leaflet, mal résolues par le build Angular
    this.iconeEglise = L.divIcon({
      className: 'eglise-marqueur',
      html: '<span><i class="fa-solid fa-church"></i></span>',
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });

    // Hors zone Angular : déplacements et zooms ne relancent pas la détection de changements
    this.zone.runOutsideAngular(() => {

      this.carte = L.map(this.carteRef.nativeElement);

      L.tileLayer(URL_TUILES, {
        maxZoom: 19,
        attribution: ATTRIBUTION,
        // Pas de requêtes à chaque étape du zoom animé ; tuiles voisines gardées en mémoire.
        // (updateWhenIdle reste à sa valeur par défaut : les tuiles se chargent pendant le glissement)
        updateWhenZooming: false,
        keepBuffer: 4
      }).addTo(this.carte);

      // Un clic sur la carte place l'église à cet endroit
      this.carte.on('click', (e: LeafletMouseEvent) => {
        this.zone.run(() => this.definirPosition(e.latlng.lat, e.latlng.lng));
      });

      // Recalcule la taille dès que le conteneur change (mise en page, sidebar repliée…)
      this.observateurTaille = new ResizeObserver(() => this.carte?.invalidateSize());
      this.observateurTaille.observe(this.carteRef.nativeElement);
    });

    // L'église est déjà connue : on centre directement dessus
    if (this.positionEnAttente) {
      this.placerMarqueur(true);
      return;
    }

    // L'API n'a pas encore répondu : on part de la dernière position connue,
    // les tuiles se chargent pendant que l'API répond (au lieu d'attendre sa réponse)
    const derniere = this.lireDernierePosition();
    if (derniere && this.loadingEglise) {
      this.carte!.setView(derniere, 16);
      this.vueDefinie = true;
    } else if (!this.loadingEglise) {
      this.vueParDefautSiBesoin();
    }
  }


  private lireDernierePosition(): LatLngTuple | null {
    try {
      const valeur = JSON.parse(localStorage.getItem(CLE_POSITION) || 'null');
      return Array.isArray(valeur) && valeur.length === 2 && valeur.every(Number.isFinite)
        ? [valeur[0], valeur[1]]
        : null;
    } catch {
      return null;
    }
  }


  private memoriserPosition(lat: number, lng: number): void {
    try {
      localStorage.setItem(CLE_POSITION, JSON.stringify([lat, lng]));
    } catch {
      // Stockage indisponible : la carte attendra simplement l'API au prochain affichage
    }
  }


  // Aucune église à afficher : vue sur le centre par défaut
  private vueParDefautSiBesoin(): void {
    if (this.carte && !this.vueDefinie) {
      this.carte.setView(CENTRE_PAR_DEFAUT, 12);
      this.vueDefinie = true;
    }
  }


  private definirPosition(lat: number, lng: number, centrer = false): void {

    this.formData.latitude = +lat.toFixed(6);
    this.formData.longitude = +lng.toFixed(6);

    this.placerMarqueur(centrer);
  }


  // Synchronise le marqueur avec les champs latitude / longitude
  placerMarqueur(centrer = true): void {

    if (!this.positionValide) {
      return;
    }

    // Carte pas encore prête : elle se centrera sur l'église à sa création
    if (!this.carte || !this.L) {
      this.positionEnAttente = true;
      return;
    }

    const position: LatLngTuple = [+this.formData.latitude!, +this.formData.longitude!];

    if (this.marqueur) {
      this.marqueur.setLatLng(position);
    } else {
      this.marqueur = this.L.marker(position, { icon: this.iconeEglise, draggable: true }).addTo(this.carte);

      this.marqueur.on('dragend', () => {
        const { lat, lng } = this.marqueur!.getLatLng();
        this.zone.run(() => this.definirPosition(lat, lng));
      });
    }

    if (centrer || !this.vueDefinie) {
      const zoom = this.vueDefinie ? Math.max(this.carte.getZoom(), 16) : 16;
      this.carte.setView(position, zoom);
      this.vueDefinie = true;
      this.positionEnAttente = false;
    }
  }


  // =====================================================
  // RECHERCHE D'ADRESSE (OpenStreetMap Nominatim)
  // =====================================================

  rechercherAdresse(): void {

    const adresse = this.formData.adresse.trim();

    if (!adresse) {
      this.errorMessage = "Saisissez une adresse à rechercher.";
      return;
    }

    this.errorMessage = '';
    this.loadingRecherche = true;
    this.resultatsRecherche = [];

    this.http.get<ResultatRecherche[]>(
      'https://nominatim.openstreetmap.org/search',
      { params: { q: adresse, format: 'json', limit: '5' } }
    ).subscribe({
      next: (resultats) => {
        this.loadingRecherche = false;
        this.resultatsRecherche = resultats;
        if (resultats.length === 0) {
          this.errorMessage = 'Adresse introuvable : cliquez directement sur la carte pour placer l\'église.';
        }
      },
      error: () => {
        this.loadingRecherche = false;
        this.errorMessage = 'La recherche a échoué : cliquez directement sur la carte pour placer l\'église.';
      }
    });
  }


  choisirResultat(resultat: ResultatRecherche): void {
    this.resultatsRecherche = [];
    this.definirPosition(+resultat.lat, +resultat.lon, true);
  }


  // =====================================================
  // CHARGEMENT
  // =====================================================

  getEglise(): void {

    this.loadingEglise = true;

    this.http.get<{ success: boolean; eglise: EgliseModel | null }>(this.urlEglise)
      .subscribe({
        next: (res) => {
          this.loadingEglise = false;
          this.eglise = res.eglise;
          if (res.eglise) {
            this.remplirFormulaire(res.eglise);
          }
          this.vueParDefautSiBesoin();
        },
        error: (err: HttpErrorResponse) => {
          this.loadingEglise = false;
          this.vueParDefautSiBesoin();
          this.afficherErreur(err, "Impossible de charger l'adresse de l'église.");
        }
      });
  }


  private remplirFormulaire(eglise: EgliseModel): void {

    this.formData = {
      nom: eglise.nom || '',
      adresse: eglise.adresse,
      latitude: eglise.latitude,
      longitude: eglise.longitude,
      description: eglise.description || ''
    };

    if (this.positionValide) {
      this.memoriserPosition(+eglise.latitude, +eglise.longitude);
    }

    this.placerMarqueur(true);
  }


  // =====================================================
  // ENREGISTREMENT
  // =====================================================

  enregistrer(): void {

    this.message = '';
    this.errorMessage = '';

    if (!this.formData.adresse.trim()) {
      this.errorMessage = "L'adresse est obligatoire.";
      return;
    }

    if (!this.positionValide) {
      this.errorMessage = 'Placez l\'église sur la carte ou saisissez une latitude et une longitude valides.';
      return;
    }

    this.loading = true;

    this.http.put<{ eglise: EgliseModel; message: string }>(
      this.urlEglise,
      this.formData,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message;
        this.eglise = res.eglise;
        this.remplirFormulaire(res.eglise);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.afficherErreur(err, "Erreur lors de l'enregistrement de l'adresse.");
      }
    });
  }


  private afficherErreur(err: HttpErrorResponse, defaut: string): void {
    this.message = '';
    this.errorMessage = err.status === 401
      ? 'Session expirée, reconnectez-vous.'
      : err.error?.message || defaut;
  }

}
