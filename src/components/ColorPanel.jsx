import { useEffect, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';

// HSV colour model as in WLED's colour wheel (iro.js): hue by angle, saturation by radius,
// value on its own slider. h: 0–360, s and v: 0–1.
export function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), delta = max - Math.min(r, g, b);
  const h = delta === 0 ? 0 : max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}
export function hsvToHex({ h, s, v }) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [5, 3, 1].map(n => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('');
}

// WLED's quick-colour buttons, in the same order as its Colors tab.
const quickColors = [['Rojo', '#ff0000'], ['Naranja', '#ffa000'], ['Amarillo', '#ffc800'], ['Blanco cálido', '#ffe0a0'], ['Blanco', '#ffffff'], ['Negro', '#000000'], ['Rosa', '#ff00ff'], ['Azul', '#0000ff'], ['Cian', '#00ffc8'], ['Verde', '#08ff00']];
const SIZE = 232;

function Wheel({ hsv, onChange }) {
  const canvasRef = useRef(null), frame = useRef(0), pending = useRef(null);
  useEffect(() => {
    // Drawn once per mount: every pixel at full value, like WLED's wheel.
    const canvas = canvasRef.current, ratio = Math.min(devicePixelRatio || 1, 2), size = Math.round(SIZE * ratio);
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size), radius = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x - radius, dy = y - radius, distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const color = hsvToHex({ h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: distance / radius, v: 1 });
      const offset = (y * size + x) * 4;
      image.data.set([1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)), offset);
      image.data[offset + 3] = distance > radius - 1.5 ? 255 * (radius - distance) / 1.5 : 255;
    }
    ctx.putImageData(image, 0, 0);
    return () => cancelAnimationFrame(frame.current);
  }, []);
  // Pointer moves are coalesced to one update per animation frame so the pole preview keeps up.
  function pick(event) {
    const box = canvasRef.current.getBoundingClientRect();
    const dx = event.clientX - box.left - box.width / 2, dy = event.clientY - box.top - box.height / 2;
    pending.current = { h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) / (box.width / 2)) };
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; onChange(pending.current); });
  }
  function keys(event) {
    const step = event.shiftKey ? 15 : 5;
    const next = { ArrowLeft: { h: (hsv.h - step + 360) % 360 }, ArrowRight: { h: (hsv.h + step) % 360 }, ArrowUp: { s: Math.min(1, hsv.s + step / 100) }, ArrowDown: { s: Math.max(0, hsv.s - step / 100) } }[event.key];
    if (next) { event.preventDefault(); onChange(next); }
  }
  const angle = hsv.h * Math.PI / 180, x = 50 + Math.cos(angle) * hsv.s * 50, y = 50 + Math.sin(angle) * hsv.s * 50;
  return <div className="color-wheel" role="slider" tabIndex={0} aria-label="Rueda de color: flechas izquierda/derecha cambian el tono, arriba/abajo la saturación" aria-valuetext={`Tono ${Math.round(hsv.h)}°, saturación ${Math.round(hsv.s * 100)}%`} onKeyDown={keys}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pick(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event); }}>
    <canvas ref={canvasRef} style={{ opacity: 0.35 + hsv.v * 0.65 }} aria-hidden="true" />
    <span className="wheel-handle" style={{ left: `${x}%`, top: `${y}%`, background: hsvToHex({ ...hsv, v: Math.max(hsv.v, 0.25) }) }} />
  </div>;
}

export default function ColorPanel({ colors, slots, onChange, disabledNote }) {
  const [slot, setSlot] = useState(0);
  const active = Math.min(slot, slots.length - 1);
  const color = colors[active];
  // Hue and saturation are kept locally so they survive when value goes to 0 (black).
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hex, setHex] = useState(color);
  useEffect(() => {
    setHex(color);
    setHsv(current => hsvToHex(current) === color ? current : { ...hexToHsv(color), ...(hexToHsv(color).v === 0 ? { h: current.h, s: current.s } : {}) });
  }, [color]);
  function commit(next) { onChange(active, next); }
  function updateHsv(patch) { const next = { ...hsv, ...patch }; if (patch.h !== undefined && next.v === 0) next.v = 1; setHsv(next); commit(hsvToHex(next)); }
  if (disabledNote) return disabledNote;
  return <div className="color-panel">
    {slots.length > 1 && <div className="color-slots" role="tablist" aria-label="Color que editas">{slots.map((label, index) => <button key={label} role="tab" aria-selected={active === index} onClick={() => setSlot(index)}><i style={{ background: colors[index] }} />{label}</button>)}</div>}
    <div className="color-picker">
      <Wheel hsv={hsv} onChange={updateHsv} />
      <div className="color-side">
        <label className="slider-field"><span className="slider-label"><span>Luminosidad</span><output>{Math.round(hsv.v * 100)}<small>%</small></output></span><input type="range" min="0" max="100" aria-label="Luminosidad del color" value={Math.round(hsv.v * 100)} style={{ '--value': `${hsv.v * 100}%`, '--track': `linear-gradient(90deg,#000,${hsvToHex({ ...hsv, v: 1 })})` }} className="value-slider" onChange={event => updateHsv({ v: Number(event.target.value) / 100 })} /></label>
        <label className="hex-field">Código<input aria-label="Código hexadecimal del color" value={hex} maxLength={7} spellCheck="false" autoCapitalize="none" onChange={event => { const value = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`; setHex(value); if (/^#[0-9a-f]{6}$/i.test(value)) commit(value.toLowerCase()); }} /></label>
        <span className="current-swatch" style={{ background: color }} aria-hidden="true" />
      </div>
    </div>
    <div className="quick-colors" role="group" aria-label="Colores rápidos">
      {quickColors.map(([name, value]) => <button key={value} aria-label={name} title={name} aria-pressed={color === value} style={{ background: value }} onClick={() => commit(value)} />)}
      <button aria-label="Color aleatorio" title="Aleatorio" className="random-color" onClick={() => commit(hsvToHex({ h: Math.random() * 360, s: 0.7 + Math.random() * 0.3, v: 1 }))}><Shuffle size={15} /></button>
    </div>
  </div>;
}
