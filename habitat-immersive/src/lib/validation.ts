export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
}
export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{9,17}$/;

export function validateContact(v: ContactValues): ContactErrors {
  const e: ContactErrors = {};
  if (v.name.trim().length < 2) e.name = 'Escriu el teu nom (mínim 2 caràcters).';
  if (!v.email.trim()) e.email = 'Necessitem un correu electrònic per respondre’t.';
  else if (!EMAIL.test(v.email.trim())) e.email = 'El format del correu no és vàlid.';
  if (v.phone.trim() && !PHONE.test(v.phone.trim())) e.phone = 'El telèfon ha de tenir com a mínim 9 xifres.';
  if (v.message.trim().length < 10) e.message = 'Explica’ns una mica més (mínim 10 caràcters).';
  else if (v.message.length > 1000) e.message = 'El missatge no pot superar els 1.000 caràcters.';
  if (!v.consent) e.consent = 'Cal acceptar la nota de privacitat de la demo.';
  return e;
}
