import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2, SlidersHorizontal, Check } from 'lucide-react';
import PolePreview from './components/PolePreview.jsx';
import SegmentEditor from './components/SegmentEditor.jsx';
import SceneControls from './components/SceneControls.jsx';
import ScenesTab from './components/ScenesTab.jsx';
import ConnectModal from './components/ConnectModal.jsx';
import SaveModal from './components/SaveModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { prepareScene, segmentError } from './lib/segments.js';
import { effectById, initialScene, readSavedScenes, presetFace } from './lib/scenes.js';
import { applyWled, connectWled, sceneFromDevice, setLedCount, sendScene, presetPayload, request, setSettingsPin, PinRequiredError } from './lib/wled.js';
import { readPresets, listScenes, saveScenePreset, deletePreset, applyPreset, saveAutoMode, syncClock, clockStatus, saveSchedule, clearSchedule, setBootPreset, setCurrentLimit, localOffsetSeconds } from './lib/controller.js';
import { subscribeLivePreview } from './lib/live-preview.js';
import { mountById, mountFor, supportedTotals } from './lib/mounts.js';

const readSetting = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writeSetting = (key, value) => { try { localStorage.setItem(key, value); } catch { /* per-browser convenience only */ } };
// Served from the pole itself (http://<pole>/luma.htm): the pole is this page's own origin.
const servedFromPole = () => /luma/i.test(location.pathname) && location.protocol === 'http:';
const HISTORY_LIMIT = 60;

export default function App() {
  const [mountId, setMountId] = useState(() => mountById(readSetting('luma-mount', 'face-100')) ? readSetting('luma-mount', 'face-100') : 'face-100');
  const mount = mountById(mountId);
  const { count, faceCount, total: mountTotal } = mount;
  const [faceBFromTop, setFaceBFromTop] = useState(() => readSetting('luma-face-b-top', 'true') === 'true');
  const [scene, setSceneState] = useState(() => prepareScene(initialScene, mount.total, mount.faceCount));
  // Like WLED, edits go to the selected segment; «Todos» is an explicit choice.
  const [target, setTarget] = useState(0);
  const [view, setView] = useState('both');
  const [device, setDevice] = useState(null);
  const [poleScenes, setPoleScenes] = useState([]);
  const [poleConfig, setPoleConfig] = useState(null);
  const liveFrame = useRef(null);
  const [liveStatus, setLiveStatus] = useState('waiting');
  const [previewMode, setPreviewMode] = useState('draft');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const previewTrigger = useRef(null);
  const [liveAttempt, setLiveAttempt] = useState(0);
  const [modal, setModal] = useState(null);
  const [address, setAddress] = useState(() => readSetting('luma-address', '4.3.2.1'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [savedScenes, setSavedScenes] = useState(readSavedScenes);
  const [pin, setPinState] = useState('');
  const [liveEdit, setLiveEdit] = useState(false);
  const timerRef = useRef(null);
  const connectAttempt = useRef(0);

  // ——— Scene history (undo/redo). A ref mirrors the scene so updates stay pure under StrictMode.
  const sceneRef = useRef(scene);
  const history = useRef({ past: [], future: [], last: 0 });
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const setScene = useCallback((next, { record = true } = {}) => {
    const previous = sceneRef.current;
    const resolved = typeof next === 'function' ? next(previous) : next;
    if (resolved === previous) return;
    const now = Date.now();
    // Continuous gestures (colour wheel, sliders) collapse into one undo step.
    if (record && now - history.current.last > 400) {
      history.current.past = [...history.current.past, previous].slice(-HISTORY_LIMIT);
      history.current.future = [];
    }
    if (record) history.current.last = now;
    sceneRef.current = resolved;
    setSceneState(resolved);
    setHistorySize({ past: history.current.past.length, future: history.current.future.length });
  }, []);
  function travel(direction) {
    const { past, future } = history.current;
    const from = direction === 'back' ? past : future;
    if (!from.length) return;
    const target = from[from.length - 1];
    if (direction === 'back') { history.current.past = past.slice(0, -1); history.current.future = [...future, sceneRef.current]; }
    else { history.current.future = future.slice(0, -1); history.current.past = [...past, sceneRef.current]; }
    history.current.last = 0;
    sceneRef.current = target; setSceneState(target); setPreviewMode('draft');
    setTarget(current => current === 'all' || target.segments.some(item => item.id === current) ? current : target.segments[0].id);
    setHistorySize({ past: history.current.past.length, future: history.current.future.length });
  }
  useEffect(() => {
    function onKey(event) {
      if (!(event.ctrlKey || event.metaKey) || event.target.closest('input[type=text], input[type=number], input:not([type]), textarea')) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); travel('back'); }
      else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); travel('forward'); }
    }
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  function openPreview(event) { previewTrigger.current = event.currentTarget; setPreviewExpanded(true); }
  function closePreview() { setPreviewExpanded(false); requestAnimationFrame(() => previewTrigger.current?.focus({ preventScroll: true })); }
  useEffect(() => {
    liveFrame.current = null;
    if (!device) return;
    return subscribeLivePreview(device.address, device.count, frame => { liveFrame.current = frame; }, setLiveStatus);
  }, [device?.address, device?.count, liveAttempt]);

  const targetIndex = scene.segments.findIndex(item => item.id === target);
  const face = scene.faces[Math.max(0, targetIndex)];
  // With a single segment there is nothing to choose: hide segment wording entirely.
  const targetName = scene.segments.length === 1 ? null : target === 'all' || targetIndex < 0 ? 'Todos los segmentos' : scene.segments[targetIndex].name || `Segmento ${target + 1}`;
  const layoutError = segmentError(scene, mountTotal, device?.maxSegments);
  function updateScene(next) { setPreviewMode('draft'); setScene(next); }
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const notify = (message, type = 'success') => { clearTimeout(timerRef.current); setToast({ message, type }); if (type !== 'error') timerRef.current = setTimeout(() => setToast(null), 6000); };
  const openModal = name => { setError(''); setModal(name); };
  const closeModal = () => { connectAttempt.current++; setModal(null); setError(''); setBusy(false); };
  // Pole operations share busy state and error reporting; a missing PIN opens the settings.
  async function run(task, success) {
    setBusy(true); setError('');
    try { const result = await task(); if (success) notify(success); return result ?? true; }
    catch (failure) {
      if (failure instanceof PinRequiredError) { openModal('settings'); setError(failure.message); }
      else if (modal) setError(failure.message); else notify(failure.message, 'error');
      return false;
    }
    finally { setBusy(false); }
  }

  function selectMount(id, nextScene) {
    const selected = mountById(id);
    const next = nextScene || prepareScene({ ...sceneRef.current, segments: undefined }, selected.total, selected.faceCount);
    setMountId(id); writeSetting('luma-mount', id); setTarget(next.segments[0].id); setView(selected.faceCount === 1 ? 'a' : 'both'); setScene(next);
  }
  function loadIntoEditor(saved, message) {
    const total = saved.total || mountTotal;
    if (device && total !== mountTotal) { notify(`Esta escena tiene ${total} LEDs y el poste ${mountTotal}.`, 'error'); return; }
    const fit = mountFor(total, mountId);
    setPreviewMode('draft'); selectMount(fit.id, prepareScene(structuredClone(saved), total, fit.faceCount));
    if (message) notify(message);
  }

  // ——— Connection
  async function refreshPole(address) {
    const [presets, config] = await Promise.all([readPresets(address).catch(() => ({})), request(address, '/json/cfg').catch(() => null)]);
    setPoleScenes(listScenes(presets)); setPoleConfig(config);
    return config;
  }
  function adopt(connected) {
    const detected = mountFor(connected.count, mountId);
    if (!detected) throw new Error(`El controlador tiene ${connected.count} píxeles configurados. Este proyecto admite ${supportedTotals.join(', ')}.`);
    setDevice(connected); setPreviewMode('live');
    selectMount(detected.id, sceneFromDevice(connected) || prepareScene(initialScene, connected.count, detected.faceCount));
  }
  async function connectTo(value, { silent = false } = {}) {
    setBusy(true); setError(''); const attempt = ++connectAttempt.current;
    try {
      const connected = await connectWled(value);
      if (attempt !== connectAttempt.current) return;
      adopt(connected); setModal(null);
      writeSetting('luma-address', value); writeSetting('luma-autoconnect', 'true');
      // No battery-backed clock: give the pole this phone's time so schedules work offline.
      const config = await refreshPole(connected.address);
      if (!clockStatus(connected.info).valid) await syncClock(connected.address, config).catch(() => {});
      notify(`Conectado a ${connected.name}.`);
    } catch (failure) { if (attempt === connectAttempt.current && !silent) setError(failure.message); else if (silent) notify('No se encontró el poste guardado. Conéctalo desde «Conectar poste».', 'error'); }
    finally { if (attempt === connectAttempt.current) setBusy(false); }
  }
  useEffect(() => {
    if (servedFromPole()) { setAddress(location.host); connectTo(location.origin, { silent: true }); }
    else if (readSetting('luma-autoconnect', '') === 'true' && readSetting('luma-address', '')) connectTo(readSetting('luma-address', ''), { silent: true });
  }, []);
  function disconnect() {
    setDevice(null); setPreviewMode('draft'); setLiveEdit(false); setPoleScenes([]); setPoleConfig(null);
    writeSetting('luma-autoconnect', 'false'); closeModal();
    notify('Modo demostración activado. El poste conserva su último estado.');
  }
  const redetect = () => run(async () => { const connected = await connectWled(device.address); adopt(connected); await refreshPole(connected.address); }, 'Lectura del poste actualizada.');
  const changeLedCount = total => run(async () => { await setLedCount(device.address, total); adopt(await connectWled(device.address)); }, `El poste ahora controla ${total} LEDs en el mismo pin de datos.`);
  const changeCurrentLimit = milliamps => run(async () => { await setCurrentLimit(device.address, milliamps); adopt(await connectWled(device.address)); await refreshPole(device.address); }, `Límite de corriente: ${(milliamps / 1000).toLocaleString('es')} A.`);
  function setPin(value) { setPinState(value); setSettingsPin(value); }

  // ——— Editing
  function updateFace(patch) { updateScene(current => ({ ...current, faces: current.faces.map((item, index) => (target === 'all' || current.segments[index].id === target) ? { ...item, ...patch } : item) })); }
  // Editing every part at once changes the movement, not the colours each part was given.
  function selectDesign(effect) {
    const { colors, ...design } = presetFace(effect);
    updateFace(target === 'all' && scene.segments.length > 1 && !effect.spectrum ? design : { ...design, colors });
  }

  // ——— Sending to the pole
  const lastLayout = useRef(null);
  async function apply() {
    if (layoutError) { notify(layoutError, 'error'); return; }
    if (!device) { notify('Escena probada en el simulador. Conecta tu poste para enviarla a las luces.'); return; }
    await run(async () => {
      const confirmed = await applyWled(scene, device, count, faceCount, target);
      lastLayout.current = confirmed; setPreviewMode('live');
    }, 'Escena aplicada y confirmada por el poste.');
  }
  // «En vivo»: first a confirmed apply to fix the layout, then throttled sends of every change.
  useEffect(() => {
    if (!liveEdit || !device || layoutError) return;
    const timer = setTimeout(() => {
      sendScene(scene, { ...device, state: lastLayout.current || device.state }, count, faceCount, target)
        .then(payload => { lastLayout.current = { ...lastLayout.current, seg: payload.seg.filter(item => item.stop !== 0) }; })
        .catch(failure => { setLiveEdit(false); notify(`En vivo desactivado: ${failure.message}`, 'error'); });
    }, 180);
    return () => clearTimeout(timer);
  }, [scene, liveEdit]);
  async function toggleLiveEdit(on) {
    if (!on) { setLiveEdit(false); return; }
    if (layoutError) { notify(layoutError, 'error'); return; }
    await apply();
    setLiveEdit(true);
  }

  // ——— Saving
  async function save(name, onPole) {
    if (layoutError) { setError(layoutError); return; }
    if (savedScenes.length >= 12 && !onPole) { setError('Ya tienes 12 escenas en este teléfono. Elimina una desde Escenas para guardar otra.'); return; }
    const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, name, scene: structuredClone(scene) };
    try { const next = [item, ...savedScenes].slice(0, 12); localStorage.setItem('luma-scenes', JSON.stringify(next)); setSavedScenes(next); }
    catch { if (!onPole) { setError('El navegador no permitió guardar. Revisa que el almacenamiento local esté disponible.'); return; } }
    if (onPole && device) {
      const saved = await run(async () => { await saveScenePreset(device.address, { name, payload: presetPayload(scene, device, count, faceCount), scene }); await refreshPole(device.address); });
      if (!saved) return;
    }
    setModal(null); notify(`“${name}” guardada${onPole && device ? ' en el poste y en este teléfono' : ' en este navegador'}.`);
  }
  function removeScene(id) {
    try { const next = savedScenes.filter(item => item.id !== id); localStorage.setItem('luma-scenes', JSON.stringify(next)); setSavedScenes(next); notify('Escena eliminada de este teléfono.'); }
    catch { notify('No se pudo actualizar el almacenamiento del navegador.', 'error'); }
  }

  const scenesTab = <ScenesTab connected={!!device} busy={busy} device={device} poleScenes={poleScenes} poleConfig={poleConfig}
    loadTheme={theme => loadIntoEditor(theme.build(mountTotal), `Tema «${theme.name}» cargado. Pulsa Aplicar para verlo en el poste.`)}
    savedScenes={savedScenes} loadScene={saved => loadIntoEditor(saved, 'Escena cargada en la vista previa.')} removeScene={removeScene}
    applyPoleScene={item => run(async () => { await applyPreset(device.address, item.id); lastLayout.current = null; setLiveEdit(false); setPreviewMode('live'); }, `«${item.name}» en el poste.`)}
    editPoleScene={item => loadIntoEditor(item.scene, `«${item.name}» cargada en el editor.`)}
    deletePoleScene={item => run(async () => { await deletePreset(device.address, item.id); await refreshPole(device.address); }, `«${item.name}» eliminada del poste.`)}
    setBootScene={id => run(async () => { await setBootPreset(device.address, id); await refreshPole(device.address); }, 'El poste mostrará esa escena al encender.')}
    startAuto={(ids, minutes) => run(async () => { await saveAutoMode(device.address, { ids, minutes }); setLiveEdit(false); setPreviewMode('live'); }, `Modo automático: cambia cada ${minutes} min.`)}
    stopAuto={apply}
    saveSchedule={form => run(async () => { await saveSchedule(device.address, { ...form, utcOffsetSeconds: localOffsetSeconds() }); await refreshPole(device.address); }, 'Horario guardado en el poste.')}
    clearSchedule={() => run(async () => { await clearSchedule(device.address); await refreshPole(device.address); }, 'Horario eliminado.')}
    syncClock={() => run(async () => { await syncClock(device.address, poleConfig); adopt(await connectWled(device.address)); await refreshPole(device.address); }, 'Hora del poste actualizada.')} />;

  return <div className="app-shell">
    <header className="header"><a className="brand" href="./" aria-label="Luma, inicio"><span className="brand-mark"><i /><i /><i /></span>LUMA</a><span className="brand-description">Control de iluminación</span><div className="header-actions"><span className={`connection-state ${device ? 'connected' : ''}`}><i />{device ? device.name : 'Modo demostración'}</span><button className="connect-button" onClick={() => openModal('connect')}><Link2 size={17} /><span>{device ? 'Conexión' : 'Conectar poste'}</span></button></div></header>
    <main>
      <div className="intro"><div><h1>Dale vida a la luz<span>.</span></h1><p>Diseña una escena. Visualízala en tu poste.</p></div><button className="settings-button" onClick={() => openModal('settings')} aria-label="Mi montaje"><SlidersHorizontal size={17} /><span>Mi montaje</span></button></div>
      <div className="workspace">
        <PolePreview expanded={previewExpanded} openPreview={openPreview} closePreview={closePreview} connected={!!device} mode={previewMode} setMode={setPreviewMode} liveFrame={liveFrame} liveStatus={liveStatus} retryLive={() => setLiveAttempt(value => value + 1)} scene={scene} count={count} faceCount={faceCount} faceBFromTop={faceBFromTop} view={view} setView={setView} onPower={() => updateScene({ ...scene, on: !scene.on })} />
        <SceneControls scene={scene} face={face} target={target} setTarget={setTarget} targetName={targetName} selectDesign={selectDesign} openPreview={openPreview} updateFace={updateFace} updateScene={updateScene}
          segmentEditor={<SegmentEditor scene={scene} total={mountTotal} target={target} setTarget={setTarget} updateScene={updateScene} limit={device?.maxSegments} />}
          scenesTab={scenesTab} invalid={!!layoutError} deviceEffects={device?.effects} apply={apply}
          save={() => openModal('save')} busy={busy} connected={!!device}
          liveEdit={liveEdit} setLiveEdit={toggleLiveEdit} undo={() => travel('back')} redo={() => travel('forward')} canUndo={historySize.past > 0} canRedo={historySize.future > 0} />
      </div>
    </main>
    <footer><div className="pole-symbol" /><strong>{device?.name || 'Poste 01'}</strong><span className="footer-divider" /><span>{mount.name} · {mountTotal} píxeles</span><span className="footer-divider" /><span>{faceCount === 1 ? 'Una cara' : `${count} por cara`}</span><span className="footer-right">Diseñado para brillar.</span></footer>
    {toast && <div role={toast.type === 'error' ? 'alert' : 'status'} className={`toast ${toast.type}`}><Check size={18} /><span>{toast.message}</span><button aria-label="Cerrar notificación" onClick={() => setToast(null)}>×</button></div>}
    {modal === 'connect' && <ConnectModal device={device} address={address} setAddress={setAddress} busy={busy} error={error} connect={connectTo} disconnect={disconnect} close={closeModal} />}
    {modal === 'save' && <SaveModal initialName={`${effectById(face.effect).name} ${savedScenes.length + poleScenes.length + 1}`} connected={!!device} busy={busy} error={error} save={save} close={closeModal} />}
    {modal === 'settings' && <SettingsModal device={device} poleConfig={poleConfig} mountId={mountId} selectMount={selectMount} faceCount={faceCount} faceBFromTop={faceBFromTop} setFaceBFromTop={value => { setFaceBFromTop(value); writeSetting('luma-face-b-top', String(value)); }} busy={busy} error={error} redetect={redetect} changeLedCount={changeLedCount} changeCurrentLimit={changeCurrentLimit} pin={pin} setPin={setPin} close={closeModal} />}
  </div>;
}
