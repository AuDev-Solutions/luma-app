import { useState } from 'react';
import { Plus, Trash2, Merge, Scissors } from 'lucide-react';
import { effectById } from '../lib/scenes.js';
import {
  segmentError,
  carveSegment,
  removeSegment,
  mergeSegments,
  splitEqual,
  bandColors,
  MAX_SEGMENTS,
} from '../lib/segments.js';

// Ranges are shown inclusive and 1-based ("LED 51 a 100"); WLED stores [start, stop).
function RangeForm({ scene, total, source, limit, onCreate, onCancel }) {
  const half = Math.floor((source.start + source.stop) / 2);
  const [from, setFrom] = useState(source.stop - source.start > 1 ? half + 1 : source.start + 1);
  const [to, setTo] = useState(source.stop);
  const result = from >= 1 && to <= total && from <= to ? carveSegment(scene, from - 1, to, limit) : null;
  const message =
    from > to
      ? 'El LED inicial debe ser menor o igual al final.'
      : !result
        ? `Usa LEDs del 1 al ${total} y como máximo ${limit} segmentos.`
        : '';
  return (
    <form
      className="range-form"
      onSubmit={event => {
        event.preventDefault();
        if (result) onCreate(result);
      }}
    >
      <strong>Nuevo segmento</strong>
      <div className="segment-fields">
        <label>
          Desde LED
          <input
            aria-label="Desde LED"
            type="number"
            min="1"
            max={total}
            value={from}
            onChange={event => setFrom(Number(event.target.value))}
          />
        </label>
        <label>
          Hasta LED
          <input
            aria-label="Hasta LED"
            type="number"
            min="1"
            max={total}
            value={to}
            onChange={event => setTo(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="segment-help">
        {message || `Los LEDs ${from}–${to} tendrán su propio diseño. El resto conserva el actual.`}
      </p>
      <div className="segment-actions">
        <button className="primary-button" disabled={!result}>
          <Scissors size={16} />
          Crear segmento
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function SegmentEditor({ scene, total, target, setTarget, updateScene, limit = MAX_SEGMENTS }) {
  const [creating, setCreating] = useState(false);
  const error = segmentError(scene, total, limit);
  const single = scene.segments.length === 1;
  const selected = target === 'all' ? -1 : scene.segments.findIndex(item => item.id === target);
  const segment = scene.segments[selected];
  const source =
    segment || scene.segments.reduce((best, item) => (item.stop - item.start > best.stop - best.start ? item : best));
  function update(patch) {
    updateScene({
      ...scene,
      segments: scene.segments.map((item, i) => (i === selected ? { ...item, ...patch } : item)),
    });
  }
  function create({ scene: next, id }) {
    updateScene(next);
    setTarget(id);
    setCreating(false);
  }
  function remove() {
    const next = removeSegment(scene, selected);
    updateScene(next);
    setTarget(next.segments[Math.max(0, selected - 1)].id);
  }
  function merge() {
    const next = mergeSegments(scene, Math.max(0, selected));
    updateScene(next);
    setTarget(next.segments[0].id);
    setCreating(false);
  }
  // After an equal split, «Todos los segmentos» is selected so one design animates every part in its own colour.
  function split(parts) {
    const next = splitEqual({ ...scene, total }, parts, Math.max(0, selected), limit);
    if (next) {
      updateScene(next);
      setTarget('all');
      setCreating(false);
    }
  }
  const partButtons = (
    <div className="equal-parts" role="group" aria-label="Partir en partes iguales">
      <span>Partir en partes iguales, un color cada una</span>
      <div>
        {[2, 3, 4, 5, 6]
          .filter(parts => parts <= Math.min(limit, bandColors.length))
          .map(parts => (
            <button key={parts} onClick={() => split(parts)} aria-label={`Partir en ${parts}`}>
              {parts}
            </button>
          ))}
      </div>
    </div>
  );
  const gaps =
    total -
    new Set(
      scene.segments.flatMap(item =>
        item.stop > item.start && item.stop - item.start <= total
          ? Array.from({ length: item.stop - item.start }, (_, i) => item.start + i)
          : [],
      ),
    ).size;
  const form = creating && (
    <RangeForm
      scene={{ ...scene, total }}
      total={total}
      source={source}
      limit={limit}
      onCreate={create}
      onCancel={() => setCreating(false)}
    />
  );
  const transition = (
    <>
      <label className="slider-field transition-control">
        <span className="slider-label">
          <span>Fundido al aplicar</span>
          <output>{scene.transition === 0 ? 'Inmediata' : `${scene.transition.toLocaleString('es')} s`}</output>
        </span>
        <input
          aria-label="Fundido al aplicar en segundos"
          type="range"
          min="0"
          max={Math.max(10, scene.transition)}
          step="0.1"
          value={scene.transition}
          style={{ '--value': `${(scene.transition / Math.max(10, scene.transition)) * 100}%` }}
          onChange={event => updateScene({ ...scene, transition: Number(event.target.value) })}
        />
      </label>
      <div className="transition-presets">
        {[0, 0.4, 1, 2, 5].map(value => (
          <button
            key={value}
            aria-pressed={scene.transition === value}
            onClick={() => updateScene({ ...scene, transition: value })}
          >
            {value === 0 ? 'Sin fundido' : `${value.toLocaleString('es')} s`}
          </button>
        ))}
      </div>
      <p className="segment-help">
        Es el paso suave del diseño anterior al nuevo cuando pulsas «Aplicar». El movimiento lo da el diseño y su
        velocidad.
      </p>
    </>
  );

  if (single)
    return (
      <div className="segment-editor">
        <div className="section-heading">
          <h2>Todo el poste</h2>
          <span>{total} LEDs · un diseño</span>
        </div>
        {form || (
          <>
            <p className="segment-help">
              El diseño que elijas se aplica a los {total} LEDs. Si quieres un tramo con otro color o efecto, segméntalo
              indicando desde qué LED hasta cuál.
            </p>
            <div className="segment-actions">
              <button className="secondary-button" disabled={limit < 2} onClick={() => setCreating(true)}>
                <Scissors size={16} />
                Segmentar por tramos
              </button>
            </div>
            {limit >= 2 && partButtons}
          </>
        )}
        {transition}
      </div>
    );

  return (
    <div className="segment-editor">
      <div className="section-heading">
        <h2>
          Segmentos <span className="segment-count">{scene.segments.length}</span>
        </h2>
        <span>{total} LEDs</span>
      </div>
      <p className="segment-help">
        Elige qué parte editas en la barra «Editando». Con «Todos», al elegir un efecto cada parte conserva su color y
        todas se mueven igual.
      </p>
      <div className="segment-track" aria-label="Distribución de segmentos">
        {scene.segments.map((item, i) => (
          <button
            key={item.id}
            title={`${item.name}: LEDs ${item.start + 1}–${item.stop}`}
            aria-label={`Editar ${item.name}`}
            aria-pressed={target === item.id}
            style={{
              left: `${(Math.max(0, item.start) / total) * 100}%`,
              width: `${(Math.max(0, Math.min(total, item.stop) - Math.max(0, item.start)) / total) * 100}%`,
              '--segment-color': scene.faces[i].colors[0],
            }}
            onClick={() => setTarget(item.id)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <ol className="segment-summary">
        {scene.segments.map((item, i) => (
          <li key={item.id}>
            <i style={{ background: scene.faces[i].colors[0] }} />
            <strong>{item.name || `Segmento ${item.id + 1}`}</strong>
            <span>
              LED {item.start + 1}–{item.stop} · {effectById(scene.faces[i].effect).name}
            </span>
          </li>
        ))}
      </ol>
      {!segment && !creating && (
        <p className="segment-help">
          Para cambiar el nombre o los LEDs de una parte, selecciónala en «Editando» o en la barra.
        </p>
      )}
      {segment && !creating && (
        <div className="segment-fields">
          <label>
            Nombre
            <input
              aria-label="Nombre del segmento"
              maxLength={32}
              value={segment.name}
              onChange={event => update({ name: event.target.value })}
            />
          </label>
          <label>
            Desde LED
            <input
              aria-label="LED inicial"
              type="number"
              min="1"
              max={total}
              value={segment.start + 1}
              onChange={event => update({ start: Number(event.target.value) - 1 })}
            />
          </label>
          <label>
            Hasta LED
            <input
              aria-label="LED final"
              type="number"
              min="1"
              max={total}
              value={segment.stop}
              onChange={event => update({ stop: Number(event.target.value) })}
            />
          </label>
        </div>
      )}
      {form || (
        <div className="segment-actions">
          <button
            className="secondary-button"
            disabled={!!error || scene.segments.length >= limit}
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
            Nuevo segmento
          </button>
          <button className="secondary-button" onClick={merge}>
            <Merge size={16} />
            Unir en uno
          </button>
          {segment && (
            <button className="icon-button" aria-label="Eliminar segmento" onClick={remove}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      )}
      {!form && partButtons}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        gaps > 0 && <p className="segment-help">{gaps} LEDs sin segmento quedarán apagados al aplicar.</p>
      )}
      {transition}
    </div>
  );
}
