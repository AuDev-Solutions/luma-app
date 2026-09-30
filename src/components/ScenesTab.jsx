import { useEffect, useState } from 'react';
import { ArrowUpRight, Trash2, Play, Pencil, Power, Clock, Repeat, MapPin, Sunset } from 'lucide-react';
import { themes } from '../lib/themes.js';
import { readSchedule, clockStatus, APPLIED_PRESET } from '../lib/controller.js';

const swatch = colors => ({ background: `linear-gradient(135deg, ${colors.join(',')})` });

function AutoMode({ poleScenes, busy, startAuto, stopAuto }) {
  const [ids, setIds] = useState([]);
  const [minutes, setMinutes] = useState(5);
  const toggle = id => setIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <section className="scenes-section" aria-labelledby="auto-title">
    <h3 id="auto-title"><Repeat size={16} />Modo automático</h3>
    <p className="segment-help">El poste cambia solo entre las escenas que elijas, aunque no haya ningún teléfono conectado.</p>
    {poleScenes.length < 2 ? <p className="empty-note">Guarda al menos dos escenas en el poste para usarlo.</p> : <>
      <div className="pick-list">{poleScenes.map(item => <label key={item.id} className="pick-row"><input type="checkbox" checked={ids.includes(item.id)} onChange={() => toggle(item.id)} /><span>{item.name}</span></label>)}</div>
      <label className="inline-number">Cambiar cada<input type="number" min="1" max="120" value={minutes} onChange={event => setMinutes(Math.max(1, Math.min(120, Number(event.target.value) || 1)))} />minutos</label>
      <div className="segment-actions"><button className="primary-button" disabled={busy || ids.length < 2} onClick={() => startAuto(ids, minutes)}><Play size={16} />Activar</button><button className="secondary-button" disabled={busy} onClick={stopAuto}>Detener</button></div>
    </>}
  </section>;
}

function Schedule({ poleScenes, poleConfig, device, busy, saveSchedule, clearSchedule, syncClock }) {
  const [form, setForm] = useState(() => readSchedule(poleConfig));
  useEffect(() => { setForm(readSchedule(poleConfig)); }, [poleConfig]);
  const patch = value => setForm(current => ({ ...current, ...value }));
  const clock = clockStatus(device?.info);
  const needsLocation = form.onMode === 'sunset' && !(form.latitude || form.longitude);
  // Geolocation requires a secure context (https or localhost); served from the pole it is typed in.
  const canLocate = typeof navigator !== 'undefined' && !!navigator.geolocation && window.isSecureContext;
  function locate() { navigator.geolocation.getCurrentPosition(position => patch({ latitude: Number(position.coords.latitude.toFixed(4)), longitude: Number(position.coords.longitude.toFixed(4)) }), () => {}); }
  return <section className="scenes-section" aria-labelledby="schedule-title">
    <h3 id="schedule-title"><Clock size={16} />Horario</h3>
    <p className={`clock-status ${clock.valid ? 'ok' : 'warn'}`}>{clock.valid ? `Hora del poste: ${clock.text}` : 'El poste no sabe la hora (no tiene internet ni pila de reloj).'} <button className="link-button" onClick={syncClock} disabled={busy}>Poner la hora de este teléfono</button></p>
    <>
      <label className="field-row">Escena al encender<select value={form.onPreset ?? APPLIED_PRESET} onChange={event => patch({ onPreset: Number(event.target.value) })}><option value={APPLIED_PRESET}>La última aplicada</option>{poleScenes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="choice-row" role="radiogroup" aria-label="Cuándo encender">
        <button role="radio" aria-checked={form.onMode === 'sunset'} onClick={() => patch({ onMode: 'sunset' })}><Sunset size={15} />Al anochecer</button>
        <button role="radio" aria-checked={form.onMode === 'time'} onClick={() => patch({ onMode: 'time' })}><Clock size={15} />A una hora</button>
      </div>
      {form.onMode === 'time' ? <label className="field-row">Encender a las<input type="time" value={form.onTime} onChange={event => patch({ onTime: event.target.value })} /></label>
        : <>
          <label className="field-row">Minutos respecto al anochecer<input type="number" min="-120" max="120" step="5" value={form.sunsetOffset} onChange={event => patch({ sunsetOffset: Number(event.target.value) })} /></label>
          <div className="location-fields"><label>Latitud<input type="number" step="0.0001" min="-90" max="90" value={form.latitude} onChange={event => patch({ latitude: Number(event.target.value) })} /></label><label>Longitud<input type="number" step="0.0001" min="-180" max="180" value={form.longitude} onChange={event => patch({ longitude: Number(event.target.value) })} /></label></div>
          {canLocate ? <button className="link-button" onClick={locate}><MapPin size={14} />Usar la ubicación de este teléfono</button> : <p className="segment-help">Escribe la ubicación del poste (por ejemplo, desde un mapa). El anochecer se calcula con ella.</p>}
        </>}
      <label className="check-row compact"><input type="checkbox" checked={form.offEnabled} onChange={event => patch({ offEnabled: event.target.checked })} /><span><strong>Apagar a una hora</strong></span></label>
      {form.offEnabled && <label className="field-row">Apagar a las<input type="time" value={form.offTime} onChange={event => patch({ offTime: event.target.value })} /></label>}
      <div className="segment-actions"><button className="primary-button" disabled={busy || needsLocation} onClick={() => saveSchedule({ ...form, onPreset: form.onPreset ?? APPLIED_PRESET })}>Guardar horario</button>{form.enabled && <button className="secondary-button" disabled={busy} onClick={clearSchedule}>Quitar horario</button>}</div>
      {needsLocation && <p className="segment-help">Indica la ubicación para calcular el anochecer.</p>}
      <p className="storage-note">Usa la hora local de este teléfono ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Con internet en el Wi-Fi del poste, la hora se mantiene sola tras un corte de luz; sin internet, ábrelo desde LUMA para ponerla en hora.</p>
    </>
  </section>;
}

export default function ScenesTab({ connected, busy, loadTheme, savedScenes, loadScene, removeScene, poleScenes, poleConfig, device, applyPoleScene, editPoleScene, deletePoleScene, setBootScene, startAuto, stopAuto, saveSchedule, clearSchedule, syncClock }) {
  const bootId = poleConfig?.def?.ps;
  return <div className="scenes-tab">
    {connected && <Schedule poleScenes={poleScenes} poleConfig={poleConfig} device={device} busy={busy} saveSchedule={saveSchedule} clearSchedule={clearSchedule} syncClock={syncClock} />}

    <section className="scenes-section" aria-labelledby="themes-title">
      <h3 id="themes-title">Temas</h3>
      <div className="theme-grid">{themes.map(theme => <button key={theme.id} className="theme-card" onClick={() => loadTheme(theme)}><span className="theme-swatch" style={swatch(theme.swatch)} /><strong>{theme.name}</strong><small>{theme.description}</small></button>)}</div>
    </section>

    {connected && <section className="scenes-section" aria-labelledby="pole-title">
      <h3 id="pole-title">En el poste <span className="count-chip">{poleScenes.length}</span></h3>
      {bootId === APPLIED_PRESET && <p className="segment-help">Al encenderse, el poste muestra la última escena que aplicaste.</p>}
      {poleScenes.length === 0 ? <p className="empty-note">Aún no hay escenas guardadas en el poste. Usa «Guardar escena» y deja marcada la opción «Guardar también en el poste».</p>
        : <ul className="pole-scenes">{poleScenes.map(item => <li key={item.id}>
          <span className="pole-scene-name"><strong>{item.name}</strong>{bootId === item.id && <small>Al encender</small>}</span>
          <button className="icon-button" aria-label={`Mostrar ${item.name} en el poste`} title="Mostrar en el poste" disabled={busy} onClick={() => applyPoleScene(item)}><Play size={15} /></button>
          {item.scene && <button className="icon-button" aria-label={`Editar ${item.name}`} title="Editar" onClick={() => editPoleScene(item)}><Pencil size={15} /></button>}
          <button className="icon-button" aria-pressed={bootId === item.id} aria-label={`Usar ${item.name} al encender`} title="Al encender el poste" disabled={busy} onClick={() => setBootScene(item.id)}><Power size={15} /></button>
          <button className="icon-button" aria-label={`Eliminar ${item.name} del poste`} title="Eliminar" disabled={busy} onClick={() => deletePoleScene(item)}><Trash2 size={15} /></button>
        </li>)}</ul>}
    </section>}

    {connected && <AutoMode poleScenes={poleScenes} busy={busy} startAuto={startAuto} stopAuto={stopAuto} />}

    <section className="scenes-section" aria-labelledby="browser-title">
      <h3 id="browser-title">En este teléfono <span className="count-chip">{savedScenes.length}</span></h3>
      {savedScenes.length === 0 ? <p className="empty-note">Las escenas que guardes aparecerán aquí.</p>
        : savedScenes.map(item => <div className="saved-row" key={item.id}><button className="saved-scene" onClick={() => loadScene(item.scene)}><span className="saved-colors" style={swatch(item.scene.faces[0].colors)} /><span>{item.name}</span><ArrowUpRight size={16} /></button><button className="delete-scene icon-button" aria-label={`Eliminar escena ${item.name}`} onClick={() => removeScene(item.id)}><Trash2 size={14} /></button></div>)}
    </section>
  </div>;
}
