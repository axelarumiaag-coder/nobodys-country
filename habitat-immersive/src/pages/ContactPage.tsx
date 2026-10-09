import { useEffect } from 'react';
import { ContactForm } from '../components/ContactForm';
import { Icon } from '../components/Icon';

export function ContactPage() {
  useEffect(() => {
    document.title = 'Contacte — HABITAT IMMERSIVE';
  }, []);
  return (
    <div className="page contact-page">
      <div className="container contact-page__grid">
        <header>
          <p className="eyebrow">Contacte</p>
          <h1 className="page__title">Parlem de la teva pròxima llar</h1>
          <p className="lead">Explica’ns què busques: zona, pressupost i calendari. Et proposarem habitatges que puguis visitar primer en 360°.</p>
          <ul className="contact-page__list">
            <li>
              <Icon name="pin" /> Oficina de demostració · Barcelona
            </li>
            <li>
              <Icon name="calendar" /> Dilluns a divendres, de 9 a 19 h
            </li>
            <li>
              <Icon name="info" /> Marca fictícia: no hi ha cap oficina, telèfon ni correu reals.
            </li>
          </ul>
        </header>
        <div className="contact-card">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
