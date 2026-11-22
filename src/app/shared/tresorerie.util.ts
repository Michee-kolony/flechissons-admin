// tresorerie.util.ts
// Types et libellés de la trésorerie de l'église (mêmes valeurs que le backend)

export type TypeOperation = 'entree' | 'sortie';
export type Devise = 'USD' | 'CDF';
export type ModePaiement = 'especes' | 'mobile_money' | 'banque' | 'autre';

export interface OperationTresorerie {
  _id: string;
  type: TypeOperation;
  categorie: string;
  libelle: string;
  description: string;
  montant: number;
  devise: Devise;
  date: string; // "AAAA-MM-JJ"
  modePaiement: ModePaiement;
  reference: string;
  creeParNom: string;
  modifieParNom: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDevise {
  solde: number;
  entrees: number;
  sorties: number;
  resultat: number;
  nombreEntrees: number;
  nombreSorties: number;
  parCategorie: { type: TypeOperation; categorie: string; total: number; nombre: number }[];
  parMois: { mois: string; entrees: number; sorties: number; resultat: number }[];
  donsEnLigne: { total: number; nombre: number };
}

export interface ResumeTresorerie {
  periode: { debut: string | null; fin: string | null };
  devises: Record<Devise, ResumeDevise>;
}

export const URL_TRESORERIE = 'https://flechissons.com/tresorerie';

export const DEVISES: Devise[] = ['USD', 'CDF'];

export const CATEGORIES: Record<TypeOperation, { valeur: string; libelle: string }[]> = {
  // Types de contribution définis par le pasteur
  entree: [
    { valeur: 'offrande_adoration', libelle: "Offrande d'adoration" },
    { valeur: 'offrande_prophete', libelle: 'Offrande du prophète' },
    { valeur: 'dime_action_graces', libelle: 'Dîme et action de grâces' },
    { valeur: 'dime_des_dimes', libelle: 'Dîme des dîmes' },
    { valeur: 'loyer_ouvriers', libelle: 'Loyer des ouvriers' },
    { valeur: 'loyer_partenaires', libelle: 'Loyer des partenaires' },
    { valeur: 'contribution', libelle: 'Contribution' },
    { valeur: 'autre_entree', libelle: 'Autre entrée' }
  ],
  sortie: [
    { valeur: 'loyer', libelle: 'Loyer' },
    { valeur: 'salaires', libelle: 'Salaires / honoraires' },
    { valeur: 'factures', libelle: 'Factures (eau, électricité, internet)' },
    { valeur: 'entretien', libelle: 'Entretien / réparations' },
    { valeur: 'materiel', libelle: 'Matériel / équipement' },
    { valeur: 'social', libelle: 'Aide sociale' },
    { valeur: 'mission', libelle: 'Mission / évangélisation' },
    { valeur: 'evenement', libelle: 'Évènement' },
    { valeur: 'transport', libelle: 'Transport' },
    { valeur: 'autre_sortie', libelle: 'Autre dépense' }
  ]
};

// Anciennes catégories : plus proposées, mais encore affichées pour les opérations déjà saisies
export const CATEGORIES_ANCIENNES: Record<TypeOperation, { valeur: string; libelle: string }[]> = {
  entree: [
    { valeur: 'offrande', libelle: 'Offrande (ancienne catégorie)' },
    { valeur: 'dime', libelle: 'Dîme (ancienne catégorie)' },
    { valeur: 'don', libelle: 'Don (ancienne catégorie)' },
    { valeur: 'action_de_graces', libelle: 'Action de grâces (ancienne catégorie)' },
    { valeur: 'mission', libelle: 'Mission (ancienne catégorie)' },
    { valeur: 'cotisation', libelle: 'Cotisation (ancienne catégorie)' },
    { valeur: 'vente', libelle: 'Vente (ancienne catégorie)' }
  ],
  sortie: []
};

export const MODES_PAIEMENT: { valeur: ModePaiement; libelle: string }[] = [
  { valeur: 'especes', libelle: 'Espèces' },
  { valeur: 'mobile_money', libelle: 'Mobile Money' },
  { valeur: 'banque', libelle: 'Banque' },
  { valeur: 'autre', libelle: 'Autre' }
];

export function libelleCategorie(type: TypeOperation, categorie: string): string {
  return CATEGORIES[type]?.find(c => c.valeur === categorie)?.libelle
    || CATEGORIES_ANCIENNES[type]?.find(c => c.valeur === categorie)?.libelle
    || categorie;
}

// Catégories proposées dans le formulaire : on garde l'ancienne catégorie
// d'une opération en cours de modification pour ne pas la changer à son insu.
export function categoriesFormulaire(type: TypeOperation, categorieActuelle: string) {
  const ancienne = CATEGORIES_ANCIENNES[type]?.find(c => c.valeur === categorieActuelle);
  return ancienne ? [...CATEGORIES[type], ancienne] : CATEGORIES[type];
}

export function libelleMode(mode: ModePaiement): string {
  return MODES_PAIEMENT.find(m => m.valeur === mode)?.libelle || mode;
}

// Date locale au format "AAAA-MM-JJ"
export function versAAAAMMJJ(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

// "2026-10-11" -> Date locale (sans décalage de fuseau)
export function depuisAAAAMMJJ(date: string): Date {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(a, m - 1, j || 1);
}
