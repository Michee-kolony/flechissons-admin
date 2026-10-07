// paiement.util.ts
// Types et libellés partagés entre la liste des donations et la page de détails d'un paiement

export type StatutPaiement = 'en_attente' | 'reussi' | 'echoue';
export type TypePaiement = 'offrande' | 'dime' | 'don' | 'action_de_graces' | 'mission' | 'autre';
export type OperateurPaiement = 'mpesa' | 'orange' | 'airtel';

export interface Paiement {
  _id: string;
  depositId: string;
  reference: string;
  utilisateurId?: {
    _id: string;
    nom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
  } | null;
  nom: string;
  type: TypePaiement;
  objet: string;
  description?: string;
  montant: number;
  devise: 'USD' | 'CDF';
  operateur: OperateurPaiement;
  operateurNom?: string;
  provider: string;
  telephone: string;
  statut: StatutPaiement;
  statutPawapay?: string | null;
  echec?: { code: string | null; message: string | null };
  message?: string | null;
  providerTransactionId?: string | null;
  dateFinalisation?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const URL_PAIEMENTS = 'https://flechissons.com/api/pawapay/admin/paiements';

export const STATUTS: { valeur: StatutPaiement; libelle: string }[] = [
  { valeur: 'reussi', libelle: 'Réussi' },
  { valeur: 'en_attente', libelle: 'En attente' },
  { valeur: 'echoue', libelle: 'Échoué' }
];

export const TYPES: { valeur: TypePaiement; libelle: string }[] = [
  { valeur: 'offrande', libelle: 'Offrande' },
  { valeur: 'dime', libelle: 'Dîme' },
  { valeur: 'don', libelle: 'Don' },
  { valeur: 'action_de_graces', libelle: 'Action de grâces' },
  { valeur: 'mission', libelle: 'Mission' },
  { valeur: 'autre', libelle: 'Autre' }
];

export const OPERATEURS: { valeur: OperateurPaiement; libelle: string }[] = [
  { valeur: 'mpesa', libelle: 'M-Pesa' },
  { valeur: 'orange', libelle: 'Orange Money' },
  { valeur: 'airtel', libelle: 'Airtel Money' }
];

// =====================================================
// LIBELLÉS / STYLES
// =====================================================

export function libelleStatut(statut: StatutPaiement): string {
  return STATUTS.find(s => s.valeur === statut)?.libelle || statut;
}

export function classeStatut(statut: StatutPaiement): string {
  switch (statut) {
    case 'reussi': return 'bg-green-50 text-green-600';
    case 'echoue': return 'bg-red-50 text-red-600';
    default: return 'bg-amber-50 text-amber-600';
  }
}

export function iconeStatut(statut: StatutPaiement): string {
  switch (statut) {
    case 'reussi': return 'fa-circle-check';
    case 'echoue': return 'fa-circle-xmark';
    default: return 'fa-clock';
  }
}

export function libelleType(type: TypePaiement): string {
  return TYPES.find(t => t.valeur === type)?.libelle || type;
}

export function libelleOperateur(paiement: Paiement): string {
  return paiement.operateurNom ||
    OPERATEURS.find(o => o.valeur === paiement.operateur)?.libelle ||
    paiement.operateur;
}

export function nomFidele(paiement: Paiement): string {
  const compte = paiement.utilisateurId;
  if (compte && (compte.prenom || compte.nom)) {
    return [compte.prenom, compte.nom].filter(Boolean).join(' ');
  }
  return paiement.nom || 'Anonyme';
}

// =====================================================
// FORMATAGE
// =====================================================

export function formatMontant(montant: number, devise: string): string {
  try {
    const locale = devise === 'CDF' ? 'fr-CD' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: devise,
      maximumFractionDigits: 2
    }).format(montant || 0);
  } catch {
    return `${montant} ${devise}`;
  }
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 243812345678 → +243 812 345 678
export function formatTelephone(telephone: string): string {
  if (!telephone) return '—';
  const m = telephone.match(/^243(\d{3})(\d{3})(\d{3})$/);
  return m ? `+243 ${m[1]} ${m[2]} ${m[3]}` : telephone;
}

export function getInitials(nom: string): string {
  if (!nom) return '?';
  return nom.split(' ').map(part => part.charAt(0)).slice(0, 2).join('').toUpperCase();
}
