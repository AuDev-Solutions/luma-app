import { useEffect, useRef, useState } from 'react';
import { Link2, SlidersHorizontal, Check, Radio, Unplug, Bookmark, ArrowRight } from 'lucide-react';
import PolePreview from './components/PolePreview.jsx';
import SegmentEditor from './components/SegmentEditor.jsx';
import { prepareScene, segmentError } from './lib/segments.js';
import SceneControls from './components/SceneControls.jsx';
import Modal from './components/Modal.jsx';
import { effectById, initialScene, readSavedScenes, presetFace } from './lib/scenes.js';
import { applyWled, connectWled, sceneFromDevice, setLedCount } from './lib/wled.js';
import { subscribeLivePreview } from './lib/live-preview.js';
import { mounts, mountById, mountFor, supportedTotals } from './lib/mounts.js';

const readSetting = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writeSetting = (key, value) => { try { localStorage.setItem(key, value); } catch { /* per-browser convenience only */ } };

export default function App() {
  const [mountId, setMountId] = useState(() => mountById(readSetting('luma-mount', 'face-100')) ? readSetting('luma-mount', 'face-100') : 'face-100');
  const mount = mountById(mountId);
  const { count, faceCount, total: mountTotal } = mount;
  const [faceBFromTop, setFaceBFromTop] = useState(() => readSetting('luma-face-b-top', 'true') === 'true');
  const [scene, setScene] = useState(() => prepareScene(initialScene, mount.total, mount.faceCount));
  // Like WLED, edits go to the selected segment; «Todos los segmentos» is an explicit choice.
  const [target, setTarget] = useState(0);
  const [view, setView] = useState('both');
  const [device, setDevice] = useState(null);
  const liveFrame = useRef(null);
  const [liveStatus, setLiveStatus] = useState('waiting');
  const [previewMode, setPreviewMode] = useState('draft');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const previewTrigger = useRef(null);
  function openPreview(event) { previewTrigger.current = event.currentTarget; setPreviewExpanded(true); }
  function closePreview() { setPreviewExpanded(false); requestAnimationFrame(() => previewTrigger.current?.focus({ preventScroll: true })); }
  const [liveAttempt, setLiveAttempt] = useState(0);
  useEffect(() => {
    liveFrame.current = null;
    if (!device) return;
    return subscribeLivePreview(device.address, device.count, frame => { liveFrame.current = frame; }, setLiveStatus);
  }, [device?.address, device?.count, liveAttempt]);
  const [modal, setModal] = useState(null);
  const [address, setAddress] = useState('4.3.2.1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [savedScenes, setSavedScenes] = useState(readSavedScenes);
  const [sceneName, setSceneName] = useState('');
  const timerRef = useRef(null);
  const connectAttempt = useRef(0);
  const targetIndex = scene.segments.findIndex(item => item.id === target);
  const face = scene.faces[Math.max(0, targetIndex)];
  // With a single segment there is nothing to choose: hide segment wording entirely.
  const targetName = scene.segments.length === 1 ? null : target === 'all' || targetIndex < 0 ? 'Todos los segmentos' : scene.segments[targetIndex].name || `Segmento ${target + 1}`;
  const layoutError = segmentError(scene, mountTotal, device?.maxSegments);
  function updateScene(next) { setPreviewMode('draft'); setScene(next); }
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const notify = (message, type = 'success') => { clearTimeout(timerRef.current); setToast({ message, type }); if (type !== 'error') timerRef.current = setTimeout(() => setToast(null), 6000); };
  const openModal = (name) => { setError(''); setModal(name); };
  const closeModal = () => { connectAttempt.current++; setModal(null); setError(''); setBusy(false); };
  function selectMount(id, nextScene) {
    const selected = mountById(id);
    const next = nextScene || prepareScene({ ...scene, segments: undefined }, selected.total, selected.faceCount);
    setMountId(id); writeSetting('luma-mount', id); setTarget(next.segments[0].id); setView(selected.faceCount === 1 ? 'a' : 'both'); setScene(next);
  }
  function adopt(connected) {
    const detected = mountFor(connected.count, mountId);
    if (!detected) throw new Error(`El controlador tiene ${connected.count} píxeles configurados. Este proyecto admite ${supportedTotals.join(', ')}.`);
    setDevice(connected); setPreviewMode('live');
    selectMount(detected.id, sceneFromDevice(connected) || prepareScene(initialScene, connected.count, detected.faceCount));
  }
  async function redetect() {
    setBusy(true); setError('');
    try { const connected = await connectWled(device.address); adopt(connected); notify(`El poste tiene ${connected.count} LEDs configurados.`); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function changeLedCount(total) {
    setBusy(true); setError('');
    try { await setLedCount(device.address, total); adopt(await connectWled(device.address)); setModal(null); notify(`El poste ahora controla ${total} LEDs en el mismo pin de datos.`); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function updateFace(patch) { setPreviewMode('draft'); setScene(current => ({ ...current, faces: current.faces.map((item, index) => (target === 'all' || current.segments[index].id === target) ? { ...item, ...patch } : item) })); }
  // Editing every part at once changes the movement, not the colours each part was given.
  function selectDesign(effect) {
    const { colors, ...design } = presetFace(effect);
    updateFace(target === 'all' && scene.segments.length > 1 && !effect.spectrum ? design : { ...design, colors });
  }
  async function connect(event) {
    event.preventDefault(); setBusy(true); setError(''); const attempt = ++connectAttempt.current;
    try {
      const connected = await connectWled(address.trim());
      if (attempt !== connectAttempt.current) return;
      adopt(connected); setModal(null); notify(`Conectado a ${connected.name}. Tu escena está lista para aplicar.`);
    } catch (failure) { if (attempt === connectAttempt.current) setError(failure.message); }
    finally { if (attempt === connectAttempt.current) setBusy(false); }
  }
  async function apply() {
    if (layoutError) { notify(layoutError, 'error'); return; }
    if (!device) { notify('Escena probada en el simulador. Conecta tu poste para enviarla a las luces.'); return; }
    setBusy(true);
    try { await applyWled(scene, device, count, faceCount, target); setPreviewMode('live'); notify('Escena aplicada y confirmada por el poste.'); }
    catch (failure) { notify(failure.message, 'error'); }
    finally { setBusy(false); }
  }
  function save(event) {
    event.preventDefault();
    if (layoutError) { setError(layoutError); return; }
    const name = sceneName.trim(); if (!name) return;
    if (savedScenes.length >= 12) { setError('Ya tienes 12 escenas guardadas. Elimina una desde Mis escenas para guardar otra.'); return; }
    const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, name, scene: structuredClone(scene) };
    try { const next = [item, ...savedScenes]; localStorage.setItem('luma-scenes', JSON.stringify(next)); setSavedScenes(next); setModal(null); notify(`“${name}” guardada en este navegador.`); }
    catch { setError('El navegador no permitió guardar. Revisa que el almacenamiento local esté disponible.'); }
  }
  function removeScene(id) {
    try { const next = savedScenes.filter(item => item.id !== id); localStorage.setItem('luma-scenes', JSON.stringify(next)); setSavedScenes(next); notify('Escena eliminada de este navegador.'); }
    catch { notify('No se pudo actualizar el almacenamiento del navegador.', 'error'); }
  }
  return <div className="app-shell">
    <header className="header"><a className="brand" href="./" aria-label="Luma, inicio"><span className="brand-mark"><i /><i /><i /></span>LUMA</a><span className="brand-description">Control de iluminación</span><div className="header-actions"><span className={`connection-state ${device ? 'connected' : ''}`}><i />{device ? device.name : 'Modo demostración'}</span><button className="connect-button" onClick={() => openModal('connect')}><Link2 size={17} /><span>{device ? 'Conexión' : 'Conectar poste'}</span></button></div></header>
    <main><div className="intro"><div><h1>Dale vida a la luz<span>.</span></h1><p>Diseña una escena. Visualízala en tu poste.</p></div><button className="settings-button" onClick={() => openModal('settings')} aria-label="Configurar montaje"><SlidersHorizontal size={17} /><span>Mi montaje</span></button></div>
      <div className="workspace"><PolePreview expanded={previewExpanded} openPreview={openPreview} closePreview={closePreview} connected={!!device} mode={previewMode} setMode={setPreviewMode} liveFrame={liveFrame} liveStatus={liveStatus} retryLive={() => setLiveAttempt(value => value + 1)} scene={scene} count={count} faceCount={faceCount} faceBFromTop={faceBFromTop} view={view} setView={setView} onPower={() => { setPreviewMode('draft'); setScene({ ...scene, on: !scene.on }); }} /><SceneControls openPreview={openPreview} segmentEditor={<SegmentEditor scene={scene} total={mountTotal} target={target} setTarget={setTarget} updateScene={updateScene} limit={device?.maxSegments} />} invalid={!!layoutError} deviceEffects={device?.effects} targetName={targetName} selectDesign={selectDesign} face={face} faceCount={faceCount} updateFace={updateFace} scene={scene} target={target} setTarget={setTarget} apply={apply} save={() => { setSceneName(`${effectById(face.effect).name} ${savedScenes.length + 1}`); openModal('save'); }} busy={busy} connected={!!device} savedScenes={savedScenes} removeScene={removeScene} loadScene={saved => { const total = saved.total || mountTotal; if (device && total !== mountTotal) { notify(`Esta escena tiene ${total} LEDs y el poste ${mountTotal}.`, 'error'); return; } setPreviewMode('draft'); const fit = mountFor(total, mountId); selectMount(fit.id, prepareScene(structuredClone(saved), total, fit.faceCount)); notify('Escena cargada en la vista previa.'); }} /></div>
    </main>
    <footer><div className="pole-symbol" /><strong>{device?.name || 'Poste 01'}</strong><span className="footer-divider" /><span>{mount.name} · {mountTotal} píxeles</span><span className="footer-divider" /><span>{faceCount === 1 ? 'Una cara' : `${count} por cara`}</span><span className="footer-right">Diseñado para brillar.</span></footer>
    {toast && <div role={toast.type === 'error' ? 'alert' : 'status'} className={`toast ${toast.type}`}><Check size={18} /><span>{toast.message}</span><button aria-label="Cerrar notificación" onClick={() => setToast(null)}>×</button></div>}
    {modal === 'connect' && <Modal title={device ? 'Tu conexión' : 'Conecta tu poste'} close={closeModal}>{device ? <><div className="connection-card"><Radio size={25} /><div><strong>{device.name}</strong><p>{device.address} · {device.count} píxeles</p></div></div><p className="modal-copy">Los cambios de la vista previa se envían al pulsar «Aplicar al poste». «Poste en vivo» recibe los colores de la ESP32. «Borrador» simula los ajustes antes de enviarlos.</p><button className="secondary-button full" onClick={() => { setDevice(null); setPreviewMode('draft'); closeModal(); notify('Modo demostración activado. El poste conserva su último estado.'); }}><Unplug size={18} />Desconectar esta app</button></> : <form onSubmit={connect}><p className="modal-copy">Conecta tu teléfono al Wi-Fi del poste. Después, introduce su dirección local.</p><label className="text-field">Dirección del poste<input autoFocus required value={address} onChange={event => setAddress(event.target.value)} placeholder="192.168.4.1" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label><div className="connection-help"><Radio size={18} /><p>No necesitas internet. El teléfono y el poste deben estar en la misma red.</p></div>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'Buscando el poste…' : 'Conectar'}<ArrowRight size={18} /></button></form>}</Modal>}
    {modal === 'save' && <Modal title="Guarda esta escena" close={closeModal}><form onSubmit={save}><p className="modal-copy">Guarda los segmentos, colores y transición para volver a ellos cuando quieras.</p><label className="text-field">Nombre de la escena<input autoFocus required maxLength={40} value={sceneName} onChange={event => setSceneName(event.target.value)} /></label><p className="storage-note">Se guarda en este navegador. No cambia la escena de encendido del controlador.</p>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button full"><Bookmark size={18} />Guardar escena</button></form></Modal>}
    {modal === 'settings' && <Modal title="Mi montaje" close={closeModal}>
      <p className="modal-copy">Los LED WS2811 no avisan cuántos hay conectados: la cantidad es la que está configurada en el controlador. {device ? `Este poste tiene ${device.count} LEDs configurados.` : 'Sin conexión, esta opción solo cambia el simulador.'}</p>
      <div className="mount-options">{mounts.map(item => <button key={item.id} disabled={!!device && item.total !== device.count} className={mountId === item.id ? 'active' : ''} onClick={() => selectMount(item.id)}><span><strong>{item.name}</strong><small>{item.description}</small></span>{mountId === item.id && <Check size={20} />}</button>)}</div>
      {faceCount === 2 && <label className="check-row"><input type="checkbox" checked={faceBFromTop} onChange={event => { setFaceBFromTop(event.target.checked); writeSetting('luma-face-b-top', String(event.target.checked)); }} /><span><strong>La cara B empieza arriba</strong><small>Cable continuo: la cara B se conecta al final de la cara A, en lo alto del poste.</small></span></label>}
      {device && <div className="led-count-actions">
        {device.count === 100 && <button className="secondary-button full" disabled={busy} onClick={() => openModal('ledcount-200')}>Ya conecté la segunda cara · usar 200 LEDs</button>}
        {device.count === 200 && <button className="secondary-button full" disabled={busy} onClick={() => openModal('ledcount-100')}>Volver a una sola cara · 100 LEDs</button>}
        <button className="secondary-button full" disabled={busy} onClick={redetect}>{busy ? 'Leyendo el poste…' : 'Volver a detectar'}</button>
      </div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary-button full" onClick={closeModal}>Listo<Check size={18} /></button>
    </Modal>}
    {modal?.startsWith('ledcount-') && <Modal title={modal === 'ledcount-200' ? 'Añadir la segunda cara' : 'Volver a una cara'} close={closeModal}>
      <p className="modal-copy">{modal === 'ledcount-200'
        ? 'Hazlo solo cuando la segunda tira de 100 LEDs esté conectada en serie: la entrada de datos (DI) de la nueva tira va a la salida (DO) del último LED de la cara A, con tierra común y su propia alimentación.'
        : 'El poste dejará de enviar datos a los LEDs 101–200. Si siguen conectados, quedarán con su último color.'}</p>
      <p className="storage-note">Cambia la cantidad de la salida de LEDs del controlador de {device.count} a {modal === 'ledcount-200' ? 200 : 100}. Se conservan el pin de datos, el tipo de LED, el orden de color y el límite de corriente; el cambio se aplica sin reiniciar. Con más LEDs y el mismo límite de corriente, el controlador reducirá el brillo si hace falta: revisa que la fuente soporte el poste completo.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary-button full" disabled={busy} onClick={() => changeLedCount(modal === 'ledcount-200' ? 200 : 100)}>{busy ? 'Cambiando el poste…' : `Configurar ${modal === 'ledcount-200' ? 200 : 100} LEDs`}</button>
    </Modal>}
  </div>;
}
