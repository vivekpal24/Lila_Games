import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Silence noisy luma.gl / deck.gl warnings that don't affect functionality
const SILENCE_STR = 'weightsTexture';
const orgLog = console.log, orgWarn = console.warn, orgErr = console.error;
console.log = (...args) => { if (typeof args[0] === 'string' && args[0].includes(SILENCE_STR)) return; orgLog(...args); };
console.warn = (...args) => { if (typeof args[0] === 'string' && args[0].includes(SILENCE_STR)) return; orgWarn(...args); };
console.error = (...args) => { if (typeof args[0] === 'string' && args[0].includes(SILENCE_STR)) return; orgErr(...args); };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
