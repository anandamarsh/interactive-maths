# See Maths

See Maths is a host app for a collection of individual maths mini-apps. It does not contain the learning activities themselves. Instead, it discovers them, displays them in a searchable library, and opens each one inside the shell app.

The goal of this project is to give students and teachers a single entry point into multiple interactive maths experiences without needing a separate launcher for every app.

The production site is hosted at [https://www.seemaths.com](https://www.seemaths.com).

## What This App Does

- Loads a list of child app URLs from JSON files in `public/`
- Fetches each child app's `manifest.json`
- Builds a game/app library from that metadata
- Lets users search by name, tags, skills, and description
- Launches the selected app inside a full-screen iframe
- Supports installable PWA behavior for the shell itself

In short: this repo is the platform shell. The actual maths experiences live in separate apps.

## Current App GitHub Repos

- [Ripple Touch](https://github.com/anandamarsh/maths-game-template)
- [Trail Distances](https://github.com/anandamarsh/maths-distance-calculator)
- [Angle Explorer](https://github.com/anandamarsh/maths-angle-explorer)

## How It Works

At startup, the app chooses which source list to load:

- Development uses `public/games-local.json`
- Production uses `public/games.json`

Each file contains an array of base URLs for the individual maths apps. For every URL, the shell requests:

```text
<app-url>/manifest.json
```

That manifest is expected to provide the metadata used by the launcher UI, including:

- `id`
- `name`
- `icon`
- `tags`
- `subjects`
- `skills`
- `description`

Once loaded, the shell renders those apps as cards in the library and opens the selected app in an iframe.

## Architecture

This project is intentionally simple. The main parts are:

- `src/App.tsx`: main shell UI, data loading, search, and iframe launcher
- `src/main.tsx`: React entry point and service worker registration
- `public/games.json`: production list of hosted maths apps
- `public/games-local.json`: local development list for testing against localhost apps
- `public/manifest.webmanifest`: PWA metadata for the shell
- `public/sw.js`: minimal service worker used for installability

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Static JSON configuration for app discovery
- Browser `fetch` + iframe embedding
- Web App Manifest + service worker for PWA support

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs on:

```text
http://localhost:4000
```

By default, development reads from `public/games-local.json`, which is useful when some child apps are running locally on other ports.

## Building For Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Production uses `public/games.json`, which should point at deployed child app URLs.

## Child App Contract

Each individual maths app should:

- Be deployed at its own URL
- Expose a `manifest.json` at the app root
- Return the metadata needed by this shell
- Be embeddable in an iframe

If a child app cannot provide a valid manifest, it will not appear correctly in the launcher.

## Why This Repo Exists

Without this shell, every maths activity would need to be opened independently. This app creates a clearer product experience:

- one homepage
- one searchable catalogue
- one installable wrapper
- many separate maths apps behind it

That makes the overall system easier to present, test, and extend as the library grows.
