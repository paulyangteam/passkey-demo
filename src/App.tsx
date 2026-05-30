import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-row">
          <a href="https://vite.dev" target="_blank" rel="noreferrer">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank" rel="noreferrer">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <h1>Passkey Demo</h1>
        <p className="tagline">
          React {import.meta.env.MODE === 'production' ? '' : '(dev) '}
          with TypeScript — ready for GitHub Pages
        </p>
      </header>

      <main className="card">
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          Count is {count}
        </button>
        <p className="hint">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </main>

      <footer className="app-footer">
        <p>
          Deploy with{' '}
          <code>npm run deploy</code>
        </p>
      </footer>
    </div>
  )
}

export default App
