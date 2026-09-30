import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, close, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }} aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={close} aria-label="Cerrar"><X size={20} /></button></div>{children}</dialog>;
}
