import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import OverlayApp from './components/OverlayApp';

const overlay = new URLSearchParams(location.search).get('overlay');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{overlay !== null ? <OverlayApp index={Number(overlay)} /> : <App />}</StrictMode>
);
