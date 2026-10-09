import type { Operation } from '../data/types';

const eur = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ca-ES');

export const PENDING = 'Informació pendent';
export const formatPrice = (price: number | null, op: Operation | null) => (price == null ? 'Preu a consultar' : `${eur.format(price)}${op === 'lloguer' ? '/mes' : ''}`);
export const formatNumber = (n: number) => num.format(n);
export const operationLabel = (op: Operation | null) => (op === 'compra' ? 'Venda' : op === 'lloguer' ? 'Lloguer' : 'Operació a consultar');
export const orPending = <T>(v: T | null | undefined, fmt: (v: T) => string = String) => (v == null ? PENDING : fmt(v));
