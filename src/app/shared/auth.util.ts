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

// Le superadmin consulte la trésorerie en lecture seule
export function peutVoirTresorerie(): boolean {
  return isTresorier() || isSuperAdmin();
}
