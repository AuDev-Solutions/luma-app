import { memo, useState } from 'react';
import { Check, Heart, Search, X } from 'lucide-react';
import { categories, effects, presetFace, pixelColor, effectById } from '../lib/scenes.js';
import { resolveEffect } from '../lib/wled.js';

const EffectArt = memo(function EffectArt({ effect }) {
  const face = presetFace(effect);
  return <svg className="design-art" viewBox="0 0 160 92" aria-hidden="true">
    <defs><linearGradient id={`wash-${effect.id}`} x2="1" y2="1"><stop stopColor={effect.colors[0]} stopOpacity=".15" /><stop offset="1" stopColor={effect.colors[1]} stopOpacity=".02" /></linearGradient></defs>
    <rect width="160" height="92" fill={`url(#wash-${effect.id})`} />
    {[57, 99].map((x, column) => <g key={x}>
      <rect x={x - 5} y="9" width="10" height="75" rx="4" fill="#0a1218" stroke="#ffffff17" />
      {Array.from({ length: 24 }, (_, i) => {
        const { color, intensity } = pixelColor(face, i / 23, 3.4 + column * .5, i);
        return <g key={i} opacity={Math.max(.12, intensity)}><circle cx={x} cy={79 - i * 2.8} r="5" fill={`rgb(${color})`} opacity=".13" /><circle cx={x} cy={79 - i * 2.8} r="1.5" fill={`rgb(${color})`} /></g>;
      })}
    </g>)}
    <path d="M39 85h36m7 0h36" stroke="#ffffff14" />
  </svg>;
});

function readFavorites() {
  try { const stored = JSON.parse(localStorage.getItem('luma-favorites') || '[]'); return Array.isArray(stored) ? stored.filter(id => effects.some(effect => effect.id === id)) : []; }
  catch { return []; }
}
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function EffectGallery({ face, targetName, selectDesign, deviceEffects }) {
  const [category, setCategory] = useState('Selección');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(readFavorites);
  const [storageError, setStorageError] = useState('');
  const visible = effects.filter(effect => (query ? normalize(`${effect.name} ${effect.description} ${effect.category}`).includes(normalize(query)) : category === 'Todos' || (category === 'Selección' ? effect.featured : category === 'Favoritos' ? favorites.includes(effect.id) : effect.category === category)));
  function toggleFavorite(id) {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem('luma-favorites', JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Favoritos disponibles en esta sesión; el navegador no permitió guardarlos.'); }
  }
  return <div className="design-library">
    <div className="section-heading"><div><span className="eyebrow">COLECCIÓN LUMA</span><h2>Encuentra tu luz</h2></div><span className="catalog-count">{effects.length} diseños</span></div>
    <label className="design-search"><Search size={17} /><input type="search" aria-label="Buscar diseños" placeholder="Busca un color, efecto o ambiente" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={16} /></button>}</label>
    <div className="design-filters" role="group" aria-label="Filtrar diseños">{categories.map(item => <button key={item} aria-pressed={!query && category === item} onClick={() => { setCategory(item); setQuery(''); }}>{item === 'Favoritos' && <Heart size={13} />}{item}</button>)}</div>
    <div className="library-caption"><span aria-live="polite">{query ? `${visible.length} resultados` : category === 'Selección' ? 'Nuestros favoritos para tu poste' : `${visible.length} diseños · ${category.toLowerCase()}`}</span><span>{targetName ? `Se aplica a: ${targetName}` : 'Selecciona para previsualizar'}</span></div>
    <div className="design-grid">{visible.map(effect => {
      const active = face.effect === effect.id;
      const supported = !deviceEffects || resolveEffect(effect, deviceEffects) >= 0;
      return <div className={`design-tile ${active ? 'is-selected' : ''}`} key={effect.id}>
        <button className="design-select" aria-label={`Seleccionar ${effect.name}`} aria-pressed={active} disabled={!supported} onClick={() => selectDesign(effect)}>
          <EffectArt effect={effect} /><span className="design-copy"><strong>{effect.name}</strong><span>{supported ? effect.description : 'No disponible en este poste'}</span></span>
          {active && <span className="design-check"><Check size={12} /> En vista previa</span>}
        </button>
        <button className="favorite-toggle" aria-label={`${favorites.includes(effect.id) ? 'Quitar' : 'Añadir'} ${effect.name} ${favorites.includes(effect.id) ? 'de' : 'a'} favoritos`} aria-pressed={favorites.includes(effect.id)} onClick={() => toggleFavorite(effect.id)}><Heart size={16} fill={favorites.includes(effect.id) ? 'currentColor' : 'none'} /></button>
      </div>;
    })}</div>
    {!visible.length && <div className="empty-designs"><Search size={23} /><strong>{category === 'Favoritos' && !query ? 'Tus favoritos, a un toque' : 'No encontramos ese diseño'}</strong><p>{category === 'Favoritos' && !query ? 'Toca el corazón de un diseño para guardarlo aquí.' : 'Prueba con aurora, ondas, azul o destellos.'}</p><button className="secondary-button" onClick={() => { setCategory('Todos'); setQuery(''); }}>Ver los {effects.length} diseños</button></div>}
    {storageError && <p className="storage-note" role="status">{storageError}</p>}
  </div>;
}
