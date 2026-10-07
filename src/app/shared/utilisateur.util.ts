// utilisateur.util.ts
// Types et fonctions d'affichage partagés entre la liste des utilisateurs et la page de détails d'un utilisateur

export type Sexe = 'homme' | 'femme' | 'autre' | 'non_precise';

export interface Utilisateur {
  id: string;
  nom: string;
  prenom?: string;
  email: string;
  photo?: string;
  sexe?: Sexe;
  dateNaissance?: string | null;
  telephone?: string;
  ville?: string;
  preferences?: {
    categories?: string[];
    notifications?: boolean;
    langue?: 'fr' | 'ln';
  };
  profilComplete?: boolean;
  role?: 'user' | 'admin';
  derniereConnexion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// La route renvoie tous les utilisateurs (pas de route publique pour un seul utilisateur par id)
export const URL_UTILISATEURS = 'https://flechissons.com/user';

export const SEXES: { valeur: Sexe; libelle: string; libelleSingulier: string; icone: string; classe: string }[] = [
  { valeur: 'homme', libelle: 'Hommes', libelleSingulier: 'Homme', icone: 'fa-mars', classe: 'bg-blue-50 text-blue-600' },
  { valeur: 'femme', libelle: 'Femmes', libelleSingulier: 'Femme', icone: 'fa-venus', classe: 'bg-pink-50 text-pink-600' },
  { valeur: 'autre', libelle: 'Autre', libelleSingulier: 'Autre', icone: 'fa-genderless', classe: 'bg-purple-50 text-purple-600' },
  { valeur: 'non_precise', libelle: 'Non précisé', libelleSingulier: 'Non précisé', icone: 'fa-question', classe: 'bg-gray-100 text-gray-500' }
];

/**
 * Extrait la liste des utilisateurs de la réponse de l'API ({ utilisateurs: [...] } ou tableau direct)
 */
export function extraireUtilisateurs(data: any): Utilisateur[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.utilisateurs)) return data.utilisateurs;
  return [];
}

export function sexeDe(u: Utilisateur): Sexe {
  return SEXES.some(s => s.valeur === u.sexe) ? u.sexe! : 'non_precise';
}

export function infoSexe(u: Utilisateur) {
  return SEXES.find(s => s.valeur === sexeDe(u))!;
}

export function nomComplet(u: Utilisateur): string {
  return [u.prenom, u.nom].filter(Boolean).join(' ') || u.email;
}

export function getInitiales(u: Utilisateur): string {
  const mots = nomComplet(u).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].substring(0, 2).toUpperCase();
  return (mots[0].charAt(0) + mots[mots.length - 1].charAt(0)).toUpperCase();
}

export function age(u: Utilisateur): number | null {
  if (!u.dateNaissance) return null;
  const naissance = new Date(u.dateNaissance);
  if (isNaN(naissance.getTime())) return null;
  const maintenant = new Date();
  let resultat = maintenant.getFullYear() - naissance.getFullYear();
  const m = maintenant.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && maintenant.getDate() < naissance.getDate())) resultat--;
  return resultat;
}

export function libelleLangue(u: Utilisateur): string {
  return u.preferences?.langue === 'ln' ? 'Lingala' : 'Français';
}

export function formatDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateHeure(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
