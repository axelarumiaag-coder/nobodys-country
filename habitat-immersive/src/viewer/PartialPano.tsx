// Panoràmica 360° recreada a partir del vídeo: reutilitza el visor Three.js amb límits perquè
// la mirada no surti de la zona realment gravada.
import { forwardRef, useMemo } from 'react';
import type { FrameStop } from '../data/realHouse';
import type { TourScene } from '../data/tours';
import { asset } from '../lib/asset';
import { clamp, wrapDeg } from '../lib/sphere';
import { PanoramaViewer, type ViewerHandle, type ViewerStatus } from './PanoramaViewer';

interface Props {
  stop: FrameStop;
  reducedMotion: boolean;
  onStatus: (s: ViewerStatus) => void;
  onFirstInteraction?: () => void;
}

/** Marge (graus) que es deixa a les vores perquè el centre de la vista no arribi a la zona difuminada */
const EDGE = 22;

const PartialPano = forwardRef<ViewerHandle, Props>(function PartialPano({ stop, reducedMotion, onStatus, onFirstInteraction }, ref) {
  const p = stop.pano!;
  const { scene, limits } = useMemo(() => {
    const centre = (p.yaw[0] + p.yaw[1]) / 2;
    const half = Math.max(0, (p.yaw[1] - p.yaw[0]) / 2 - EDGE);
    const pMid = (p.pitch[0] + p.pitch[1]) / 2;
    const pLo = Math.min(pMid, p.pitch[0] + 12);
    const pHi = Math.max(pMid, p.pitch[1] - 12);
    const scene: TourScene = {
      id: stop.id,
      name: stop.name,
      preview: asset(p.preview),
      full: asset(p.full),
      // una mica per sota del centre: el terra i el mobiliari són més nítids que el sostre
      initialView: { yaw: wrapDeg(centre), pitch: clamp(pMid - 8, pLo, pHi) },
      links: [],
      planPoint: [0, 0],
    };
    return { scene, limits: { yaw: [centre - half, centre + half] as [number, number], pitch: [pLo, pHi] as [number, number] } };
  }, [p, stop.id, stop.name]);

  return <PanoramaViewer ref={ref} scene={scene} onNavigate={() => {}} onStatus={onStatus} onFirstInteraction={onFirstInteraction} reducedMotion={reducedMotion} limits={limits} />;
});

export default PartialPano;
