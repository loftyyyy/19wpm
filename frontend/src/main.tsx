import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Routings from './Routings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Routings />
  </StrictMode>
)