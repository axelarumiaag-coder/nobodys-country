import type { Ref } from 'react';
import type { FloorPlanData } from '../data/types';

interface Props {
  plan: FloorPlanData;
  /** Estança activa de la visita */
  active?: string;
  /** Punts de captura de les panoràmiques */
  points?: { id: string; x: number; z: number; label: string }[];
  onSelect?: (sceneId: string) => void;
  /** Grup SVG que el visor rota segons la direcció de la mirada */
  coneRef?: Ref<SVGGElement>;
  className?: string;
  title?: string;
  showAreas?: boolean;
  /** 'top' situa el nom a dalt de l'estança perquè no tapi els punts de captura */
  labelAt?: 'center' | 'top';
}

const fmt = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 1 });

/** Plànol esquemàtic en SVG generat a partir de dades (metres). */
export function FloorPlan({ plan, active, points, onSelect, coneRef, className = '', title = 'Plànol esquemàtic', showAreas = true, labelAt = 'center' }: Props) {
  const pad = 0.5;
  const { x, z, w, h } = plan.bounds;
  const vb = `${x - pad} ${z - pad} ${w + pad * 2} ${h + pad * 2}`;
  const wall = 0.14;
  const activePoint = points?.find((p) => p.id === active);

  return (
    <svg className={`plan ${className}`} viewBox={vb} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <pattern id="plan-hatch" width="0.35" height="0.35" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.35" stroke="var(--plan-hatch)" strokeWidth="0.05" />
        </pattern>
      </defs>
      {plan.rooms.map((r, i) => {
        const [x0, z0, x1, z1] = r.rect;
        const isActive = !!r.sceneId && r.sceneId === active;
        const clickable = !!(onSelect && r.sceneId);
        const area = (x1 - x0) * (z1 - z0);
        const small = Math.min(x1 - x0, z1 - z0) < 2.2;
        return (
          <g
            key={i}
            className={`plan__room plan__room--${r.kind ?? 'room'}${isActive ? ' is-active' : ''}${clickable ? ' is-clickable' : ''}`}
            {...(clickable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Ves a ${r.name}`,
                  'aria-pressed': isActive,
                  onClick: () => onSelect!(r.sceneId!),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect!(r.sceneId!);
                    }
                  },
                }
              : {})}
          >
            <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} className="plan__fill" fill={r.kind === 'outdoor' ? 'url(#plan-hatch)' : undefined} />
            <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} className="plan__wall" strokeWidth={r.kind === 'outdoor' ? wall * 0.4 : wall} />
            <text
              x={(x0 + x1) / 2}
              y={labelAt === 'top' && r.kind !== 'outdoor' ? z0 + 0.55 : (z0 + z1) / 2 - (showAreas && !small ? 0.15 : -0.1)}
              className="plan__label"
              fontSize={small ? 0.32 : 0.42}
            >
              {r.name}
            </text>
            {showAreas && !small && r.kind !== 'outdoor' && (
              <text x={(x0 + x1) / 2} y={(z0 + z1) / 2 + 0.45} className="plan__area" fontSize={0.32}>
                {fmt(area)} m²
              </text>
            )}
          </g>
        );
      })}
      {plan.openings?.map((o, i) => (
        <rect key={`o${i}`} className="plan__gap" {...gapRect(o, wall)} />
      ))}
      {plan.doors?.map((d, i) => (
        <g key={`d${i}`} className="plan__door">
          <rect className="plan__gap" {...gapRect(d, wall)} />
          {d.axis === 'x' ? (
            <path d={`M ${d.x} ${d.z} L ${d.x} ${d.z + d.w} A ${d.w} ${d.w} 0 0 0 ${d.x + d.w} ${d.z}`} />
          ) : (
            <path d={`M ${d.x} ${d.z} L ${d.x + d.w} ${d.z} A ${d.w} ${d.w} 0 0 1 ${d.x} ${d.z + d.w}`} />
          )}
        </g>
      ))}
      {plan.windows?.map((wd, i) => (
        <g key={`w${i}`} className="plan__window">
          <rect {...gapRect(wd, wall)} />
          {wd.axis === 'x' ? <line x1={wd.x} x2={wd.x + wd.w} y1={wd.z} y2={wd.z} /> : <line x1={wd.x} x2={wd.x} y1={wd.z} y2={wd.z + wd.w} />}
        </g>
      ))}
      {points?.map((p) => (
        <g
          key={p.id}
          className={`plan__point${p.id === active ? ' is-active' : ''}`}
          transform={`translate(${p.x} ${p.z})`}
          {...(onSelect ? { onClick: () => onSelect(p.id), style: { cursor: 'pointer' } } : {})}
        >
          <circle r={0.22} />
        </g>
      ))}
      {activePoint && coneRef && (
        <g transform={`translate(${activePoint.x} ${activePoint.z})`} className="plan__viewer" pointerEvents="none">
          <g ref={coneRef}>
            <path d="M 0 0 L 2.1 -1.25 A 2.45 2.45 0 0 1 2.1 1.25 Z" className="plan__cone" />
          </g>
          <circle r={0.3} className="plan__me" />
        </g>
      )}
    </svg>
  );
}

function gapRect(o: { x: number; z: number; w: number; axis: 'x' | 'z' }, wall: number) {
  const t = wall * 1.6;
  return o.axis === 'x' ? { x: o.x, y: o.z - t / 2, width: o.w, height: t } : { x: o.x - t / 2, y: o.z, width: t, height: o.w };
}
