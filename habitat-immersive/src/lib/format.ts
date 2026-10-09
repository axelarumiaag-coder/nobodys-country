import type { Operation } from '../data/types';

const eur = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ca-ES');

export const formatPrice = (price: number, op: Operation) => `${eur.format(price)}${op === 'lloguer' ? '/mes' : ''}`;
export const formatNumber = (n: number) => num.format(n);
export const operationLabel = (op: Operation) => (op === 'compra' ? 'Venda' : 'Lloguer');
