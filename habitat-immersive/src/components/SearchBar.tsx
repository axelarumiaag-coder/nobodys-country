import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { municipalities } from '../data/properties';
import { Icon } from './Icon';

const BUDGETS = {
  compra: [
    { v: '', l: 'Sense límit' },
    { v: '400000', l: 'Fins a 400.000 €' },
    { v: '700000', l: 'Fins a 700.000 €' },
    { v: '1200000', l: 'Fins a 1.200.000 €' },
  ],
  lloguer: [
    { v: '', l: 'Sense límit' },
    { v: '1500', l: 'Fins a 1.500 €/mes' },
    { v: '2000', l: 'Fins a 2.000 €/mes' },
    { v: '3000', l: 'Fins a 3.000 €/mes' },
  ],
};

export function SearchBar() {
  const nav = useNavigate();
  const [op, setOp] = useState<'compra' | 'lloguer'>('compra');
  const [town, setTown] = useState('');
  const [max, setMax] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams({ operacio: op });
    if (town) p.set('municipi', town);
    if (max) p.set('max', max);
    nav(`/habitatges?${p.toString()}`);
  };

  return (
    <form className="search" onSubmit={submit} role="search" aria-label="Cerca d'habitatges">
      <div className="search__ops" role="radiogroup" aria-label="Operació">
        {(['compra', 'lloguer'] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={op === o}
            className={`search__op${op === o ? ' is-active' : ''}`}
            onClick={() => {
              setOp(o);
              setMax('');
            }}
          >
            {o === 'compra' ? 'Comprar' : 'Llogar'}
          </button>
        ))}
      </div>
      <div className="search__fields">
        <label className="search__field">
          <span>Ubicació</span>
          <select value={town} onChange={(e) => setTown(e.target.value)}>
            <option value="">Tot Catalunya</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="search__field">
          <span>Pressupost</span>
          <select value={max} onChange={(e) => setMax(e.target.value)}>
            {BUDGETS[op].map((b) => (
              <option key={b.v} value={b.v}>
                {b.l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary search__submit">
          <Icon name="search" size={18} /> Cerca
        </button>
      </div>
    </form>
  );
}
