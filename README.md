# Passkey Demo

A React + TypeScript demo app built with [Vite](https://vite.dev), configured for deployment to [GitHub Pages](https://pages.github.com/).

## Tech stack

- React 19
- TypeScript
- Vite 6

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This project is configured with `base: '/passkey-demo/'` in `vite.config.ts`. If your repository name differs, update that value to match.

### Option 1: GitHub Actions (recommended)

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or `master`) — the workflow in `.github/workflows/deploy.yml` builds and deploys automatically.

Your site will be available at:

`https://<username>.github.io/passkey-demo/`

### Option 2: Manual deploy with gh-pages

```bash
npm run deploy
```

This runs `npm run build` and publishes the `dist` folder to the `gh-pages` branch.

Then in **Settings → Pages**, set **Source** to deploy from the `gh-pages` branch.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build and publish to GitHub Pages |
