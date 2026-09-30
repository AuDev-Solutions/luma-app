import { useState } from 'react';
import { Bookmark, Sun, Gauge, Eye, Sparkles, Palette, Droplet, Wand2, Rows3, LayoutGrid, Undo2, Redo2 } from 'lucide-react';
import { effectById, faceIntensity, paletteKey, previewStops, usesColors, usesWheel } from '../lib/scenes.js';
import { palettes, paletteById } from '../lib/palettes.js';
import EffectGallery from './EffectGallery.jsx';
import ColorPanel from './ColorPanel.jsx';

const gradient = stops => `linear-gradient(90deg, ${stops.map(color => `rgb(${color})`).join(',')})`;
// Same organisation as WLED's interface: colours, effects and segments each have their own tab.
const tabs = [['colors', 'Colores', Droplet], ['effects', 'Efectos', Wand2], ['segments', 'Segmentos', Rows3], ['scenes', 'Escenas', LayoutGrid]];

function Slider({ label, Icon, value, disabled, onChange }) {
  return <label className="slider-field"><span className="slider-label"><span><Icon size={15} />{label}</span><output>{value}<small>%</small></output></span><input type="range" min="0" max="100" aria-label={label} disabled={disabled} value={value} style={{ '--value': `${value}%` }} onChange={event => onChange(Number(event.target.value))} /></label>;
}

export default function SceneControls({ scene, face, target, setTarget, targetName, selectDesign, openPreview, updateFace, updateScene, segmentEditor, scenesTab, invalid, apply, save, busy, connected, deviceEffects, undo, redo, canUndo, canRedo }) {
  const [tab, setTab] = useState('colors');
  const effect = effectById(face.effect);
  const slots = effect.singleColor || paletteKey(face) === 'color1' ? ['Principal'] : paletteById(paletteKey(face))?.threeColors ? ['Principal', 'Fondo', 'Acento'] : ['Principal', 'Fondo'];
  const colors = slots.length === 3 && face.colors.length < 3 ? [...face.colors, '#ffffff'] : face.colors;
  const paletteNote = !usesColors(face) && <div className="palette-note">
    <span style={{ background: gradient(previewStops(face)) }} />
    <p><strong>{usesWheel(face) ? 'Este diseño usa todo el arcoíris.' : `Los colores vienen de la paleta «${palettes.find(item => item.id === paletteKey(face))?.name}».`}</strong> Para elegir tus propios colores, toca «Elegir colores».</p>
    <button className="secondary-button" onClick={() => updateFace({ palette: 'colors' })}>Elegir colores</button>
  </div>;
  return <section className="controls panel" aria-label="Editor de escenas">
    {scene.segments.length > 1 && <div className="segment-bar" role="group" aria-label="Segmento que editas">
      <span>Editando</span>
      <div>
        <button aria-pressed={target === 'all'} onClick={() => setTarget('all')}>Todos</button>
        {scene.segments.map((item, i) => <button key={item.id} aria-pressed={target === item.id} onClick={() => setTarget(item.id)}><i style={{ background: scene.faces[i].colors[0] }} />{item.name || `Segmento ${item.id + 1}`}</button>)}
      </div>
    </div>}
    <div className="master-bar">
      <label className="master-brightness"><Sun size={16} /><span>Brillo general</span><input type="range" min="1" max="100" aria-label="Brillo general del poste" value={scene.bri ?? 100} style={{ '--value': `${scene.bri ?? 100}%` }} onChange={event => updateScene({ ...scene, bri: Number(event.target.value) })} /><output>{scene.bri ?? 100}%</output></label>
      <div className="master-actions">
        <button className="icon-button" aria-label="Deshacer (Ctrl+Z)" title="Deshacer" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button>
        <button className="icon-button" aria-label="Rehacer (Ctrl+Y)" title="Rehacer" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button>
      </div>
    </div>
    <div className="editor-tabs" role="tablist" aria-label="Editor">{tabs.map(([id, label, Icon]) => <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>

    {tab === 'colors' && <div role="tabpanel" id="panel-colors" aria-labelledby="tab-colors" className="tab-panel">
      <ColorPanel colors={colors} slots={slots} disabledNote={paletteNote} onChange={(index, value) => updateFace({ colors: colors.map((color, i) => i === index ? value : color) })} />
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
        {!effect.static && <label className="palette-field"><span><Palette size={15} />Paleta</span><select aria-label="Paleta" value={paletteKey(face)} onChange={event => updateFace({ palette: event.target.value })}>{palettes.filter(item => !item.hidden || item.id === paletteKey(face)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {!effect.static && <div className="direction-options" role="group" aria-label="Dirección del efecto">
          <button aria-pressed={!!face.reverse} onClick={() => updateFace({ reverse: !face.reverse })}>Invertir dirección</button>
          <button aria-pressed={!!face.mirror} onClick={() => updateFace({ mirror: !face.mirror })}>Espejo desde el centro</button>
        </div>}
      </div>
      <EffectGallery face={face} targetName={targetName} selectDesign={selectDesign} deviceEffects={deviceEffects} />
    </div>}

    {tab === 'segments' && <div role="tabpanel" id="panel-segments" aria-labelledby="tab-segments" className="tab-panel">{segmentEditor}</div>}
    {tab === 'scenes' && <div role="tabpanel" id="panel-scenes" aria-labelledby="tab-scenes" className="tab-panel">{scenesTab}</div>}

    <div className="action-dock"><div className="dock-scene"><strong>{target !== 'all' && scene.segments.length > 1 ? `${targetName} · ${effect.name}` : effect.name}</strong><button className="dock-preview" onClick={openPreview}><Eye size={17} />Ver poste</button></div><div className="actions"><button className="secondary-button" disabled={invalid} onClick={save}><Bookmark size={18} />Guardar escena</button></div></div><p className="action-hint">{!connected ? 'Modo demostración. Explora antes de conectar tu poste.' : 'Cada cambio llega al poste al instante y queda como su escena de encendido.'}</p>
  </section>;
}
