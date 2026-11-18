import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import Modal from './Modal.jsx';

export default function SaveModal({ initialName, connected, busy, error, save, close }) {
  const [name, setName] = useState(initialName);
  const [onPole, setOnPole] = useState(connected);
  return (
    <Modal title="Guarda esta escena" close={close}>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (name.trim()) save(name.trim(), onPole);
        }}
      >
        <p className="modal-copy">
          Guarda los segmentos, colores, efectos y fundido para volver a ellos cuando quieras.
        </p>
        <label className="text-field">
          Nombre de la escena
          <input autoFocus required maxLength={32} value={name} onChange={event => setName(event.target.value)} />
        </label>
        {connected && (
          <label className="check-row">
            <input type="checkbox" checked={onPole} onChange={event => setOnPole(event.target.checked)} />
            <span>
              <strong>Guardar también en el poste</strong>
              <small>
                Queda disponible desde cualquier teléfono y se puede usar en el modo automático y el horario.
              </small>
            </span>
          </label>
        )}
        <p className="storage-note">
          {connected
            ? 'Siempre se guarda también en este navegador.'
            : 'Se guarda en este navegador. Conecta el poste para guardarla también en él.'}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button full" disabled={busy}>
          <Bookmark size={18} />
          {busy ? 'Guardando…' : 'Guardar escena'}
        </button>
      </form>
    </Modal>
  );
}
