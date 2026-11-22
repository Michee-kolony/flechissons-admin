// auth.util.ts
export type RoleAdmin = 'admin' | 'tresorier' | 'superadmin';

export const ROLES_ADMIN: { valeur: RoleAdmin; libelle: string }[] = [
  { valeur: 'admin', libelle: 'Administrateur' },
  { valeur: 'tresorier', libelle: 'Trésorier' },
  { valeur: 'superadmin', libelle: 'Superadmin' }
];

export function getAdminRole(): string {
  try {
    const raw = localStorage.getItem('adminData');
    if (!raw) return '';
    return JSON.parse(raw).role || '';
  } catch {
    return '';
  }
}

export function isSuperAdmin(): boolean {
  return getAdminRole() === 'superadmin';
}

// Seuls les administrateurs ayant le rôle « tresorier » modifient la trésorerie
export function isTresorier(): boolean {
  return getAdminRole() === 'tresorier';
}

// Le trésorier n'a accès qu'au tableau de bord, à la trésorerie et à son profil
export const PAGES_TRESORIER = ['/admin/dashboard', '/admin/tresorerie', '/admin/profil'];

export function pageAutoriseeTresorier(url: string): boolean {
  const chemin = (url || '').split(/[?#]/)[0];
  return PAGES_TRESORIER.some(p => chemin === p || chemin.startsWith(p + '/'));
}

// Le superadmin consulte la trésorerie en lecture seule
export function peutVoirTresorerie(): boolean {
  return isTresorier() || isSuperAdmin();
}
