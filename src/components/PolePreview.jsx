import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Power, Maximize2 } from 'lucide-react';
import { effectById } from '../lib/scenes.js';
import Modal from './Modal.jsx';
import { createPoleRenderer } from '../lib/pole-renderer.js';

function PreviewPanel({ scene, count, faceCount = 2, faceBFromTop, view, setView, onPower, playing, onToggle, onExpand, expandRef, connected, liveFrame, liveStatus, retryLive }) {
  const live = connected;
  const canvasRef = useRef(null);
  const backgroundRef = useRef(null);
  const rendererRef = useRef(null);
  useEffect(() => {
    const renderer = createPoleRenderer(canvasRef.current, backgroundRef.current);
    rendererRef.current = renderer;
    return () => { renderer.destroy(); rendererRef.current = null; };
  }, []);
  useEffect(() => { rendererRef.current?.update({ scene, count, faceCount, faceBFromTop, view, playing, live, liveFrame }); }, [scene, count, faceCount, faceBFromTop, view, playing, live, liveFrame, liveStatus]);

  const name = scene.faces.some(face => face.effect !== scene.faces[0].effect) ? 'Escena por segmentos' : effectById(scene.faces[0].effect).name;
  return <section className="preview panel" aria-label={live ? 'Salida del poste' : 'Simulación del poste'}>
    <div className="panel-heading"><h2>Vista</h2>{faceCount === 1 ? <span className="single-strip-label">{count === 100 ? 'Una cara' : 'Una tira'} · {count} píxeles</span> : <div className="segmented compact" aria-label="Cara visible">{[['both', 'Ambas'], ['a', 'Cara A'], ['b', 'Cara B']].map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>}</div>
    <div className="viewport"><canvas className="preview-background" ref={backgroundRef} aria-hidden="true" /><canvas className="preview-lights" ref={canvasRef} role="img" aria-label={`${live ? 'Colores recibidos del poste:' : 'Vista aproximada de'} ${count} píxeles ${faceCount === 1 ? 'en una tira' : 'por cara'}, ${live ? 'salida actual' : name}, ${live ? liveStatus : scene.on ? 'encendidos' : 'apagados'}`} /><div className="viewport-tools">{<button className={`icon-button ${!scene.on ? 'muted' : ''}`} aria-label={live ? scene.on ? 'Apagar poste' : 'Encender poste' : scene.on ? 'Apagar vista previa' : 'Encender vista previa'} aria-pressed={scene.on} onClick={onPower}><Power size={17} /></button>}{onExpand && <button ref={expandRef} className="icon-button expand" aria-label="Ampliar vista previa" onClick={onExpand}><Maximize2 size={16} /></button>}</div>{live && liveStatus !== 'live' && <div className="live-message" role="status"><strong>{liveStatus === 'waiting' ? 'Recibiendo la vista del poste…' : 'Sin señal de vista en vivo'}</strong><span>{liveStatus === 'waiting' ? 'Los colores aparecerán al recibir datos.' : 'Revisa la conexión. Otro celular o PC puede estar usando esta vista.'}</span>{liveStatus !== 'waiting' && <button className="secondary-button" onClick={retryLive}>Reconectar vista</button>}</div>}<div className="preview-caption">{count * faceCount} PÍXELES <span /> SEPARACIÓN 4 CM</div></div>
    <div className="playback"><button className="play-button" aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} onClick={onToggle}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div><strong>{live ? 'Salida del poste' : scene.on ? name : 'Apagado'}</strong><span>{live ? 'Datos de la ESP32' : 'Simulación'}</span></div><span className="preview-note">{playing && (live || scene.on) ? <><i className="pulse-dot" /> {live ? liveStatus === 'live' ? 'En vivo' : 'Sin señal' : 'Simulación'}</> : 'En pausa'}</span></div>
  </section>;
}

export default function PolePreview({ expanded, openPreview, closePreview, ...props }) {
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const expandRef = useRef(null);
  const toggle = () => setPlaying(value => !value);
  return <>
    <PreviewPanel {...props} playing={playing && !expanded} onToggle={toggle} expandRef={expandRef} onExpand={openPreview} />
    {expanded && <Modal title="Vista ampliada" className="preview-dialog" close={closePreview}>
      <PreviewPanel {...props} playing={playing} onToggle={toggle} />
      <p className="detail-note">{props.connected ? 'Colores recibidos del poste. La pantalla y los LED pueden percibirse con distinto brillo.' : 'Simulación aproximada. Conecta el poste para ver su salida real.'}</p>
    </Modal>}
  </>;
}
