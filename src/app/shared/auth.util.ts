// auth.util.ts
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
