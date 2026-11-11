// Processus principal Electron : enveloppe l'application Angular compilée
// dans une fenêtre de bureau Windows.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const SCHEMA = 'app';
const HOTE = 'fleshissons';
const ORIGINE = `${SCHEMA}://${HOTE}`;
const DOSSIER_APP = path.join(__dirname, '..', 'dist', 'fleshissons-admin', 'browser');
const API = ['https://flechissons.com/*', 'https://*.flechissons.com/*'];
// Téléversement direct des prédications vers Cloudflare R2 (URL présignées)
const R2 = ['https://*.r2.cloudflarestorage.com/*'];

// Schéma "app://" se comportant comme https (localStorage, fetch, routes Angular…)
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Une seule instance de l'application à la fois
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let fenetre = null;
let splash = null;

// Durée minimale d'affichage du splash, pour éviter un simple flash
const DUREE_SPLASH_MIN = 2500;

function creerSplash() {
  splash = new BrowserWindow({
    width: 480,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    title: 'Fléchissons Admin',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splash.once('ready-to-show', () => splash.show());
  splash.loadFile(path.join(__dirname, 'splash.html'), { query: { v: app.getVersion() } });
  splash.on('closed', () => { splash = null; });
}

function servirFichiers() {
  protocol.handle(SCHEMA, (requete) => {
    const chemin = decodeURIComponent(new URL(requete.url).pathname);
    let fichier = path.normalize(path.join(DOSSIER_APP, chemin));

    // Empêche de sortir du dossier de l'application ; les routes Angular
    // (ex. /dashboard) n'existent pas sur disque → index.html
    if (!fichier.startsWith(DOSSIER_APP) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      fichier = path.join(DOSSIER_APP, 'index.html');
    }
    return net.fetch(pathToFileURL(fichier).toString());
  });
}

// L'API n'autorise que les origines web connues : on accepte les réponses
// pour l'origine app:// (l'auth se fait par jeton Bearer, sans cookies).
function autoriserApi() {
  // Un seul écouteur par session Electron : l'API et R2 sont gérés ensemble
  session.defaultSession.webRequest.onHeadersReceived({ urls: [...API, ...R2] }, (details, callback) => {
    const entetes = {};
    for (const [cle, valeur] of Object.entries(details.responseHeaders || {})) {
      if (!cle.toLowerCase().startsWith('access-control-')) entetes[cle] = valeur;
    }
    entetes['Access-Control-Allow-Origin'] = [ORIGINE];
    entetes['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
    entetes['Access-Control-Allow-Headers'] = ['Authorization, Content-Type, Accept, X-Requested-With'];
    // Le navigateur doit lire l'ETag de chaque partie envoyée à R2
    entetes['Access-Control-Expose-Headers'] = ['ETag'];

    const reponse = { responseHeaders: entetes };
    if (details.method === 'OPTIONS') reponse.statusLine = 'HTTP/1.1 204 No Content';
    callback(reponse);
  });
}

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'Fléchissons Admin',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Bascule splash → fenêtre principale une fois Angular prêt
  const debut = Date.now();
  fenetre.webContents.once('did-finish-load', () => {
    const attente = Math.max(0, DUREE_SPLASH_MIN - (Date.now() - debut));
    setTimeout(() => {
      fenetre.show();
      fenetre.focus();
      if (splash) splash.close();
    }, attente);
  });
  fenetre.on('page-title-updated', (event) => event.preventDefault());

  // Liens externes (YouTube, cartes…) → navigateur par défaut
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGINE)) {
      event.preventDefault();
      if (url.startsWith('http')) shell.openExternal(url);
    }
  });

  fenetre.loadURL(`${ORIGINE}/`);
  fenetre.on('closed', () => { fenetre = null; });
}

app.on('second-instance', () => {
  if (fenetre) {
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
  }
});

app.whenReady().then(() => {
  servirFichiers();
  autoriserApi();
  creerSplash();
  creerFenetre();
});

app.on('window-all-closed', () => app.quit());
