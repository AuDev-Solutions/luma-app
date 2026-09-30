import { useState } from 'react';
import { Bookmark, Play, Sun, Gauge, ArrowUpRight, Trash2, Eye, Sparkles, Palette, Droplet, Wand2, Rows3 } from 'lucide-react';
import { effectById, faceIntensity, paletteKey, previewStops, usesColors } from '../lib/scenes.js';
import { palettes } from '../lib/palettes.js';
import EffectGallery from './EffectGallery.jsx';
import ColorPanel from './ColorPanel.jsx';

const gradient = stops => `linear-gradient(90deg, ${stops.map(color => `rgb(${color})`).join(',')})`;
// Same organisation as WLED's interface: colours, effects and segments each have their own tab.
const tabs = [['colors', 'Colores', Droplet], ['effects', 'Efectos', Wand2], ['segments', 'Segmentos', Rows3]];

function Slider({ label, Icon, value, disabled, onChange }) {
  return <label className="slider-field"><span className="slider-label"><span><Icon size={15} />{label}</span><output>{value}<small>%</small></output></span><input type="range" min="0" max="100" aria-label={label} disabled={disabled} value={value} style={{ '--value': `${value}%` }} onChange={event => onChange(Number(event.target.value))} /></label>;
}

export default function SceneControls({ scene, face, target, setTarget, targetName, selectDesign, openPreview, updateFace, segmentEditor, invalid, apply, save, busy, connected, savedScenes, loadScene, removeScene, deviceEffects }) {
  const [tab, setTab] = useState('colors');
  const effect = effectById(face.effect);
  const autoName = palettes.find(item => item.id === paletteKey({ ...face, palette: 'auto' }))?.name;
  const slots = effect.singleColor || paletteKey(face) === 'color1' ? ['Principal'] : ['Principal', 'Fondo'];
  const paletteNote = !usesColors(face) && <div className="palette-note">
    <span style={{ background: gradient(previewStops(face)) }} />
    <p><strong>{effect.spectrum && (face.palette || 'auto') === 'auto' ? 'Este diseño usa todo el arcoíris.' : `Los colores vienen de la paleta «${palettes.find(item => item.id === paletteKey(face))?.name}».`}</strong> Para elegir tus propios colores, cambia la paleta a «Tus dos colores».</p>
    <button className="secondary-button" onClick={() => updateFace({ palette: 'colors' })}>Usar mis colores</button>
  </div>;
  return <section className="controls panel" aria-label="Editor de escenas">
    {scene.segments.length > 1 && <div className="segment-bar" role="group" aria-label="Segmento que editas">
      <span>Editando</span>
      <div>
        <button aria-pressed={target === 'all'} onClick={() => setTarget('all')}>Todos</button>
        {scene.segments.map((item, i) => <button key={item.id} aria-pressed={target === item.id} onClick={() => setTarget(item.id)}><i style={{ background: scene.faces[i].colors[0] }} />{item.name || `Segmento ${item.id + 1}`}</button>)}
      </div>
    </div>}
    <div className="editor-tabs" role="tablist" aria-label="Editor">{tabs.map(([id, label, Icon]) => <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>

    {tab === 'colors' && <div role="tabpanel" id="panel-colors" aria-labelledby="tab-colors" className="tab-panel">
      <ColorPanel colors={face.colors} slots={slots} disabledNote={paletteNote} onChange={(index, value) => updateFace({ colors: face.colors.map((color, i) => i === index ? value : color) })} />
      <div className="tab-section"><Slider label="Brillo" Icon={Sun} value={face.brightness} onChange={value => updateFace({ brightness: value })} /></div>
      {target === 'all' && scene.segments.length > 1 && <p className="segment-help">Un color elegido aquí se aplica a todos los segmentos. Para dar un color a cada parte, selecciónala arriba.</p>}
    </div>}

    {tab === 'effects' && <div role="tabpanel" id="panel-effects" aria-labelledby="tab-effects" className="tab-panel">
      <div className="effect-settings">
        <div className="section-heading"><h2>{effect.name}</h2><span>Ajustes del efecto</span></div>
        <div className="sliders">
          <Slider label={effect.speedLabel || 'Velocidad'} Icon={Gauge} value={face.speed} disabled={effect.static} onChange={value => updateFace({ speed: value })} />
          {effect.intensityLabel !== null && <Slider label={effect.intensityLabel || 'Intensidad'} Icon={Sparkles} value={faceIntensity(face)} onChange={value => updateFace({ intensity: value })} />}
        </div>
        {!effect.static && <label className="palette-field"><span><Palette size={15} />Paleta</span><select aria-label="Paleta" value={face.palette || 'auto'} onChange={event => updateFace({ palette: event.target.value })}>{palettes.map(item => <option key={item.id} value={item.id}>{item.id === 'auto' ? `Del diseño (${autoName})` : item.name}</option>)}</select></label>}
        {!effect.static && <div className="direction-options" role="group" aria-label="Dirección del efecto">
          <button aria-pressed={!!face.reverse} onClick={() => updateFace({ reverse: !face.reverse })}>Invertir dirección</button>
          <button aria-pressed={!!face.mirror} onClick={() => updateFace({ mirror: !face.mirror })}>Espejo desde el centro</button>
        </div>}
      </div>
      <EffectGallery face={face} targetName={targetName} selectDesign={selectDesign} deviceEffects={deviceEffects} />
    </div>}

    {tab === 'segments' && <div role="tabpanel" id="panel-segments" aria-labelledby="tab-segments" className="tab-panel">{segmentEditor}</div>}

    <div className="action-dock"><div className="dock-scene"><strong>{target !== 'all' && scene.segments.length > 1 ? `${targetName} · ${effect.name}` : effect.name}</strong><button className="dock-preview" onClick={openPreview}><Eye size={17} />Ver poste</button></div><div className="actions"><button className="primary-button" disabled={busy || invalid} onClick={apply}><Play size={17} fill="currentColor" />{busy ? 'Aplicando…' : connected ? 'Aplicar al poste' : 'Probar escena'}</button><button className="secondary-button" disabled={invalid} onClick={save}><Bookmark size={18} />Guardar escena</button></div></div><p className="action-hint">{connected ? 'Los cambios se envían al pulsar Aplicar al poste.' : 'Modo demostración. Explora antes de conectar tu poste.'}</p>
    {savedScenes.length > 0 && <div className="saved-scenes"><h3>Mis escenas <span>{savedScenes.length}</span></h3>{savedScenes.map(item => <div className="saved-row" key={item.id}><button className="saved-scene" onClick={() => loadScene(item.scene)}><span className="saved-colors" style={{ background: `linear-gradient(135deg, ${item.scene.faces[0].colors.join(',')})` }} /><span>{item.name}</span><ArrowUpRight size={16} /></button><button className="delete-scene icon-button" aria-label={`Eliminar escena ${item.name}`} onClick={() => removeScene(item.id)}><Trash2 size={14} /></button></div>)}</div>}
  </section>;
}
