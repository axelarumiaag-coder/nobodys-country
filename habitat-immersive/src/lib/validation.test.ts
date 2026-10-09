import { describe, expect, it } from 'vitest';
import { validateContact } from './validation';

const ok = { name: 'Laia Puig', email: 'laia@example.com', phone: '', message: 'M’interessa visitar el pis.', consent: true };

describe('validació del formulari', () => {
  it('accepta un formulari correcte', () => expect(validateContact(ok)).toEqual({}));
  it('detecta camps obligatoris i formats', () => {
    const e = validateContact({ name: '', email: 'no-es-un-correu', phone: '12', message: 'curt', consent: false });
    expect(Object.keys(e).sort()).toEqual(['consent', 'email', 'message', 'name', 'phone']);
  });
  it('el telèfon és opcional però validat', () => {
    expect(validateContact({ ...ok, phone: '+34 600 123 456' })).toEqual({});
    expect(validateContact({ ...ok, phone: 'abc' }).phone).toBeDefined();
  });
});
