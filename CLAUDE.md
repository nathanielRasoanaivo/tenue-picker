# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Tenue du Jour" is a Progressive Web App (PWA) that helps users randomly select daily outfits from uploaded photos. The app is entirely client-side with no backend, storing all data locally in the browser using IndexedDB.

## Architecture

### Core Components

- **OutfitStore** (app.js:1-67): Handles all IndexedDB operations for storing outfit images
  - Database: `TenuePickerDB`
  - Object store: `outfits` with auto-incrementing `id` and `timestamp` index
  - Methods: `init()`, `add(imageData)`, `getAll()`, `delete(id)`

- **TenuePickerApp** (app.js:69-251): Main application class managing UI state and user interactions
  - Manages three main UI states: upload screen, action screen (with gallery), and result screen
  - Handles file uploads via both click and drag-and-drop
  - Implements random outfit selection algorithm
  - Gallery with expand/collapse functionality (shows 6 items by default)

### PWA Features

- **Service Worker** (sw.js): Implements Cache-First strategy for offline functionality
  - Cache name: `tenue-picker-v1`
  - Caches all static assets on install
  - Auto-cleans old cache versions on activation

- **Manifest** (manifest.json): Defines PWA installation metadata
  - App name, icons (192x192 and 512x512), theme colors
  - Standalone display mode, portrait orientation

### Data Flow

1. Images uploaded → converted to base64 via FileReader → stored in IndexedDB
2. All images retrieved from IndexedDB → rendered in gallery
3. Random selection picks one outfit from the array
4. No server communication; all data stays in browser

## Development

### Running Locally

The app requires an HTTP server (browsers block some features on `file://` protocol):

```bash
# Option 1: Node.js http-server
npm install -g http-server
http-server -p 8080

# Option 2: Python
python -m http.server 8080
```

Access at `http://localhost:8080`

### Testing PWA Features

- Service Worker requires HTTPS (or localhost)
- Test installation on mobile: Chrome → "Install app" or Safari → "Add to Home Screen"
- Test offline mode: DevTools → Application → Service Workers → Offline checkbox

## Key Implementation Details

### State Management

The app has three mutually exclusive UI states controlled by `updateUI()`:
- **Upload state**: No outfits exist yet
- **Action state**: Outfits exist, user can pick random outfit or view gallery
- **Result state**: Modal overlay showing selected outfit

### Image Storage

Images are stored as base64 data URLs in IndexedDB, not as File objects. This allows offline access but increases storage size. Each outfit object has:
- `id`: Auto-incremented primary key
- `data`: Base64-encoded image data URL
- `timestamp`: Creation timestamp

### Gallery Behavior

- Default view shows maximum 6 outfits
- "Voir tout" button appears only when more than 6 outfits exist
- Gallery item deletion requires confirmation via browser `confirm()` dialog

## File Structure

```
/
├── index.html       # Main HTML structure
├── app.js          # All JavaScript (OutfitStore + TenuePickerApp classes)
├── styles.css      # All styles
├── sw.js           # Service Worker for offline functionality
├── manifest.json   # PWA manifest
└── README.md       # French documentation
```

## Language Notes

- All UI text is in French
- Code comments are in French
- Variable names use French terminology (e.g., `tenue` = outfit)
