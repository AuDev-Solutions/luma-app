import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

// Installable/offline app where browsers allow service workers (https or localhost).
// Served from the pole over plain http, the manifest still allows adding it to the home screen.
if ('serviceWorker' in navigator && window.isSecureContext && !/luma/i.test(location.pathname)) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
