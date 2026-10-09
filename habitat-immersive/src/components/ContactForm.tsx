import { useId, useState, type FormEvent } from 'react';
import { validateContact, type ContactErrors, type ContactValues } from '../lib/validation';
import { Icon } from './Icon';

const EMPTY: ContactValues = { name: '', email: '', phone: '', message: '', consent: false };

export function ContactForm({ subject, defaultMessage = '' }: { subject?: string; defaultMessage?: string }) {
  const id = useId();
  const [values, setValues] = useState<ContactValues>({ ...EMPTY, message: defaultMessage });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactValues, boolean>>>({});
  const [sent, setSent] = useState<null | { name: string; ref: string }>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof ContactValues>(k: K, v: ContactValues[K]) => {
    const next = { ...values, [k]: v };
    setValues(next);
    if (touched[k]) setErrors(validateContact(next));
  };
  const blur = (k: keyof ContactValues) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validateContact(values));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateContact(values);
    setErrors(errs);
    setTouched({ name: true, email: true, phone: true, message: true, consent: true });
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    // Simulació local: no s'envia res a cap servidor ni es fa servir cap servei de correu.
    window.setTimeout(() => {
      setSubmitting(false);
      setSent({ name: values.name.trim().split(' ')[0], ref: `DEMO-${Date.now().toString(36).toUpperCase().slice(-6)}` });
    }, 700);
  };

  if (sent) {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <span className="form-success__icon">
          <Icon name="check" size={28} />
        </span>
        <h3>Gràcies, {sent.name}.</h3>
        <p>
          La teva sol·licitud ha quedat registrada <strong>només en aquest navegador</strong> (referència {sent.ref}). Com que això és una demo, no s'ha enviat cap correu ni cap
          dada a cap servidor.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setSent(null);
            setValues({ ...EMPTY, message: defaultMessage });
            setTouched({});
            setErrors({});
          }}
        >
          Envia una altra consulta
        </button>
      </div>
    );
  }

  const err = (k: keyof ContactValues) => (touched[k] ? errors[k] : undefined);
  const field = (k: 'name' | 'email' | 'phone', label: string, type: string, autoComplete: string, optional = false) => (
    <div className={`field${err(k) ? ' has-error' : ''}`}>
      <label htmlFor={`${id}-${k}`}>
        {label}
        {optional && <span className="field__opt"> (opcional)</span>}
      </label>
      <input
        id={`${id}-${k}`}
        name={k}
        type={type}
        autoComplete={autoComplete}
        value={values[k]}
        onChange={(e) => update(k, e.target.value)}
        onBlur={() => blur(k)}
        aria-invalid={!!err(k)}
        aria-describedby={err(k) ? `${id}-${k}-err` : undefined}
      />
      {err(k) && (
        <p className="field__error" id={`${id}-${k}-err`}>
          {err(k)}
        </p>
      )}
    </div>
  );

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      {subject && (
        <p className="contact-form__subject">
          Consulta sobre: <strong>{subject}</strong>
        </p>
      )}
      <div className="contact-form__row">
        {field('name', 'Nom i cognoms', 'text', 'name')}
        {field('email', 'Correu electrònic', 'email', 'email')}
      </div>
      {field('phone', 'Telèfon', 'tel', 'tel', true)}
      <div className={`field${err('message') ? ' has-error' : ''}`}>
        <label htmlFor={`${id}-message`}>Missatge</label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={4}
          value={values.message}
          onChange={(e) => update('message', e.target.value)}
          onBlur={() => blur('message')}
          aria-invalid={!!err('message')}
          aria-describedby={err('message') ? `${id}-message-err` : undefined}
        />
        {err('message') && (
          <p className="field__error" id={`${id}-message-err`}>
            {err('message')}
          </p>
        )}
      </div>
      <div className={`field field--check${err('consent') ? ' has-error' : ''}`}>
        <label>
          <input
            id={`${id}-consent`}
            type="checkbox"
            name="consent"
            checked={values.consent}
            onChange={(e) => update('consent', e.target.checked)}
            onBlur={() => blur('consent')}
            aria-invalid={!!err('consent')}
          />
          <span>Entenc que és un formulari de demostració i que les dades no s'envien enlloc.</span>
        </label>
        {err('consent') && <p className="field__error">{err('consent')}</p>}
      </div>
      <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
        {submitting ? <span className="spinner spinner--small" aria-hidden="true" /> : <Icon name="arrowRight" size={18} />}
        {submitting ? 'Registrant…' : 'Sol·licita informació'}
      </button>
    </form>
  );
}
