import { useState } from 'react';
import { Check, Zap, ShieldCheck, ShieldAlert, ExternalLink, Wifi } from 'lucide-react';
import Modal from './Modal.jsx';
import { mounts } from '../lib/mounts.js';
import { powerStatus, securityStatus, networkStatus, standaloneNetworkError } from '../lib/controller.js';

// Mount, LED count, current limit and security for the connected pole.
export default function SettingsModal({ device, poleConfig, mountId, selectMount, faceCount, faceBFromTop, setFaceBFromTop, busy, error, redetect, changeLedCount, changeCurrentLimit, changeNetwork, pin, setPin, close }) {
  const [confirmCount, setConfirmCount] = useState(null);
  const power = device && powerStatus(device.info, poleConfig);
  const security = poleConfig && securityStatus(poleConfig);
  const [supplyAmps, setSupplyAmps] = useState('');
  // 85 % of the supply rating leaves headroom for the controller and supply tolerance.
  const proposedLimit = Math.round(Number(supplyAmps) * 1000 * 0.85);
  const network = poleConfig && networkStatus(poleConfig);
  const [wifi, setWifi] = useState(null); // form → confirm → done
  const wifiError = wifi && standaloneNetworkError(wifi);

  if (wifi?.step === 'done') return <Modal title="El poste se está reiniciando" close={close}>
    <p className="modal-copy">En unos segundos el poste emitirá la red <strong>«{wifi.name}»</strong>.</p>
    <ol className="steps-list">
      <li>En los ajustes de Wi-Fi del celular, conéctate a <strong>{wifi.name}</strong> con la contraseña que acabas de poner.</li>
      <li>Si el celular avisa «sin internet», elige <strong>mantener la conexión</strong>.</li>
      <li>Abre <strong>http://4.3.2.1</strong>: LUMA se abre y se conecta sola.</li>
    </ol>
    <button className="primary-button full" onClick={close}>Entendido<Check size={18} /></button>
  </Modal>;
  if (wifi?.step === 'confirm') return <Modal title="Cambiar el Wi-Fi del poste" close={() => setWifi({ ...wifi, step: 'form' })}>
    <p className="modal-copy">El poste se reiniciará y emitirá su propia red <strong>«{wifi.name}»</strong>{wifi.keepHome ? ', además de seguir conectado a la red de casa' : ' sin buscar ninguna otra red'}. Esta app se desconectará hasta que el celular se una a esa red.</p>
    <p className="storage-note">Apunta la contraseña: sin ella, la única forma de recuperar el poste es reinstalar su programa por cable.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-button full" disabled={busy} onClick={async () => { if (await changeNetwork(wifi)) setWifi({ ...wifi, step: 'done' }); }}>{busy ? 'Guardando…' : 'Guardar y reiniciar el poste'}</button>
  </Modal>;

  if (confirmCount) return <Modal title={confirmCount === 200 ? 'Usar 200 LEDs' : 'Volver a 100 LEDs'} close={() => setConfirmCount(null)}>
    <p className="modal-copy">{confirmCount === 200
      ? 'Hazlo cuando la segunda tira de 100 LEDs esté conectada en serie: la entrada de datos (DI) de la nueva tira va a la salida (DO) del último LED de la primera, con tierra común. Después elige si están en fila o como dos caras del poste.'
      : 'El poste dejará de enviar datos a los LEDs 101–200. Si siguen conectados, quedarán con su último color.'}</p>
    <p className="storage-note">Cambia la cantidad de la salida de LEDs del controlador de {device.count} a {confirmCount}. Se conservan el pin de datos, el tipo de LED, el orden de color y el límite de corriente; el cambio se aplica sin reiniciar. Revisa que la fuente soporte el poste completo.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-button full" disabled={busy} onClick={async () => { if (await changeLedCount(confirmCount)) setConfirmCount(null); }}>{busy ? 'Cambiando el poste…' : `Configurar ${confirmCount} LEDs`}</button>
  </Modal>;

  return <Modal title="Mi montaje" close={close}>
    <p className="modal-copy">Los LED WS2811 no avisan cuántos hay conectados: la cantidad es la que está configurada en el controlador. {device ? `Este poste tiene ${device.count} LEDs configurados.` : 'Sin conexión, esta opción solo cambia el simulador.'}</p>
    <div className="mount-options">{mounts.map(item => <button key={item.id} disabled={!!device && item.total !== device.count} className={mountId === item.id ? 'active' : ''} onClick={() => selectMount(item.id)}><span><strong>{item.name}</strong><small>{item.description}</small></span>{mountId === item.id && <Check size={20} />}</button>)}</div>
    {poleConfig?.hw?.led?.ins?.length > 1 && <p className="storage-note">Salidas de datos: {poleConfig.hw.led.ins.map(bus => `GPIO ${bus.pin[0]} (LED ${bus.start + 1}–${bus.start + bus.len})`).join(' · ')}</p>}
    {faceCount === 2 && <label className="check-row"><input type="checkbox" checked={faceBFromTop} onChange={event => setFaceBFromTop(event.target.checked)} /><span><strong>La cara B empieza arriba</strong><small>Cable continuo: la cara B se conecta al final de la cara A, en lo alto del poste.</small></span></label>}
    {device && <div className="led-count-actions">
      {device.count === 100 && <button className="secondary-button full" disabled={busy} onClick={() => setConfirmCount(200)}>Ya conecté 200 LEDs en serie · usar 200 LEDs</button>}
      {device.count === 200 && <button className="secondary-button full" disabled={busy} onClick={() => setConfirmCount(100)}>Volver a 100 LEDs</button>}
      <button className="secondary-button full" disabled={busy} onClick={redetect}>{busy ? 'Leyendo el poste…' : 'Volver a detectar'}</button>
    </div>}

    {device && <section className="settings-section" aria-labelledby="power-title">
      <h3 id="power-title"><Zap size={16} />Consumo</h3>
      <p className="settings-figure"><strong>{(power.estimate / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} A</strong> ahora · límite {power.limit ? <strong>{(power.limit / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} A</strong> : <strong className="warning-text">sin límite</strong>}</p>
      {!power.limit && <p className="form-error">Sin límite de corriente, un blanco a pleno brillo puede superar lo que da la fuente. Indica cuántos amperios entrega tu fuente para proteger el montaje.</p>}
      <form className="inline-form" onSubmit={event => { event.preventDefault(); if (proposedLimit >= 250) changeCurrentLimit(proposedLimit); }}>
        <label>Amperios de la fuente<input type="number" min="0.5" max="100" step="0.5" inputMode="decimal" value={supplyAmps} onChange={event => setSupplyAmps(event.target.value)} placeholder="Ej. 10" /></label>
        <button className="secondary-button" disabled={busy || proposedLimit < 250}>Limitar a {proposedLimit >= 250 ? `${(proposedLimit / 1000).toLocaleString('es')} A` : '…'}</button>
      </form>
      <p className="storage-note">Se deja un 15 % de margen. Si hace falta, el controlador baja el brillo en lugar de sobrecargar la fuente.</p>
    </section>}

    {device && network && <section className="settings-section" aria-labelledby="wifi-title">
      <h3 id="wifi-title"><Wifi size={16} />Wi-Fi del poste</h3>
      <ul className="check-list">
        <li className={network.alwaysOn ? 'ok' : 'warn'}>{network.alwaysOn ? `Su red propia «${network.apName}» está siempre encendida.` : `Su red propia «${network.apName}» solo aparece cuando no encuentra otra red.`}</li>
        <li className={network.homeNetwork ? 'warn' : 'ok'}>{network.homeNetwork ? `Además se conecta a la red «${network.homeNetwork}». En la calle no la tendrá.` : 'Funciona solo: no depende de ninguna otra red.'}</li>
      </ul>
      <p className="segment-help">En la calle no hay router: el celular se conecta a la red del poste y abre http://4.3.2.1.</p>
      {!wifi ? <button className="secondary-button full" disabled={busy} onClick={() => setWifi({ step: 'form', name: network.apName.startsWith('WLED') ? 'LUMA-Poste1' : network.apName, password: '', keepHome: false })}>Configurar para funcionar solo</button>
        : <form className="wifi-form" onSubmit={event => { event.preventDefault(); if (!wifiError) setWifi({ ...wifi, step: 'confirm' }); }}>
          <label className="text-field">Nombre de la red<input value={wifi.name} maxLength={32} onChange={event => setWifi({ ...wifi, name: event.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
          <label className="text-field">Contraseña nueva<input type="text" value={wifi.password} maxLength={63} onChange={event => setWifi({ ...wifi, password: event.target.value })} placeholder="Mínimo 8 caracteres" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="off" /></label>
          <label className="check-row compact"><input type="checkbox" checked={wifi.keepHome} onChange={event => setWifi({ ...wifi, keepHome: event.target.checked })} /><span><strong>Seguir conectado también a la red de casa</strong><small>Solo para pruebas en el taller.</small></span></label>
          {wifi.password && wifiError && <p className="form-error">{wifiError}</p>}
          <div className="segment-actions"><button className="primary-button" disabled={!!wifiError}>Continuar</button><button type="button" className="secondary-button" onClick={() => setWifi(null)}>Cancelar</button></div>
        </form>}
    </section>}

    {device && <section className="settings-section" aria-labelledby="security-title">
      <h3 id="security-title">{security && security.apPassword && !security.apDefault && security.otaLocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}Seguridad</h3>
      {security && <ul className="check-list">
        <li className={security.apPassword && !security.apDefault ? 'ok' : 'warn'}>{!security.apPassword ? 'El Wi-Fi propio del poste no tiene contraseña.' : security.apDefault ? 'El Wi-Fi propio del poste tiene una contraseña de 8 caracteres; si nunca la cambiaste es la de fábrica (wled1234).' : 'El Wi-Fi propio del poste tiene contraseña.'}</li>
        <li className={security.otaLocked ? 'ok' : 'warn'}>{security.otaLocked ? 'Las actualizaciones remotas del programa están bloqueadas.' : 'Cualquiera en la red puede actualizar el programa del poste.'}</li>
      </ul>}
      <p className="storage-note">En un poste en la calle, cambia la contraseña del Wi-Fi propio, pon un PIN de ajustes y bloquea las actualizaciones remotas. Se hace en los ajustes avanzados del poste; LUMA no cambia contraseñas para no dejarte fuera.</p>
      <a className="secondary-button full" href={`${device.address}/settings/sec`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Abrir ajustes avanzados del poste</a>
      <label className="text-field pin-field">PIN de ajustes (si configuraste uno)<input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} placeholder="Sin PIN" autoComplete="off" /></label>
    </section>}

    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-button full" onClick={close}>Listo<Check size={18} /></button>
  </Modal>;
}
