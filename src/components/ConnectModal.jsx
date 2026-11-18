import { Radio, Unplug, ArrowRight } from 'lucide-react';
import Modal from './Modal.jsx';

export default function ConnectModal({ device, address, setAddress, busy, error, connect, disconnect, close }) {
  if (device)
    return (
      <Modal title="Tu conexión" close={close}>
        <div className="connection-card">
          <Radio size={25} />
          <div>
            <strong>{device.name}</strong>
            <p>
              {device.address} · {device.count} píxeles
            </p>
          </div>
        </div>
        <p className="modal-copy">
          Con el poste conectado, cada cambio se envía al instante y la vista muestra los colores reales del poste. Esta
          app recordará el poste y se conectará sola la próxima vez.
        </p>
        <button className="secondary-button full" onClick={disconnect}>
          <Unplug size={18} />
          Desconectar esta app
        </button>
      </Modal>
    );
  return (
    <Modal title="Conecta tu poste" close={close}>
      <form
        onSubmit={event => {
          event.preventDefault();
          connect(address.trim());
        }}
      >
        <p className="modal-copy">
          Conecta tu teléfono al Wi-Fi del poste o a la misma red de la casa. Después, introduce su dirección.
        </p>
        <label className="text-field">
          Dirección del poste
          <input
            autoFocus
            required
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="192.168.4.1"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
        </label>
        <div className="connection-help">
          <Radio size={18} />
          <p>
            En el Wi-Fi propio del poste la dirección es 4.3.2.1. En la red de casa, la que asigna el router. Si abres
            LUMA desde el propio poste, se conecta sola.
          </p>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button full" disabled={busy}>
          {busy ? 'Buscando el poste…' : 'Conectar'}
          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
