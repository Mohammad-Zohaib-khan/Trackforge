/**
 * Entry for the static, click-through preview build (npm run build:preview).
 * The real app entry is src/main.tsx; nothing here ships in the product build.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter } from 'react-router';
import '../styles/index.css';
import { App, routes } from '../app/App';
import { installPreviewApi } from './mockApi';

installPreviewApi();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

const banner = document.createElement('div');
banner.setAttribute('role', 'note');
banner.textContent = 'Preview build: example data, runs entirely in your browser and resets on reload. Any email and password signs you in.';
banner.style.cssText =
  'position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:70;max-width:min(92vw,560px);padding:8px 14px;border-radius:999px;font:12px/1.4 system-ui,sans-serif;color:#d7e6df;background:rgba(13,20,18,.92);border:1px solid rgba(190,225,210,.24);text-align:center;pointer-events:none';
document.body.appendChild(banner);

createRoot(root).render(
  <StrictMode>
    <App router={createMemoryRouter(routes, { initialEntries: ['/'] })} />
  </StrictMode>,
);
