# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Tenue du Jour" is a Progressive Web App (PWA) that helps users randomly select daily outfits from uploaded photos. The app is entirely client-side with no backend, storing all data locally in the browser using IndexedDB.

### Key Features

- Random outfit selection with worn outfit tracking
- Image compression (1600px max, 82% quality JPEG)
- Export/import backup system (JSON)
- Manual toggle of worn status
- Weather widget integration
- Lazy loading for gallery images
- Offline-first PWA architecture

## Architecture

### Core Components

#### OutfitStore (app.js:177-330)
Handles all IndexedDB operations for storing outfit images.

**Database:**
- Name: `TenuePickerDB`
- Version: 2 (v2 added `used` field)
- Object store: `outfits` with auto-incrementing `id` and `timestamp` index

**Methods:**
- `init()`: Initialize database and handle migrations
- `add(imageData)`: Add new outfit with `used: false` by default
- `getAll()`: Retrieve all outfits
- `delete(id)`: Delete specific outfit
- `update(id, updates)`: Update outfit fields (e.g., toggle `used` status)
- `resetAll()`: Mark all outfits as unworn (`used: false`)
- `deleteAll()`: Clear all outfits from database

#### ImageCompressor (app.js:82-174)
Compresses uploaded images to reduce storage size.

**Configuration:**
- Max dimension: 1600px
- Quality: 82% JPEG
- Timeout: 30 seconds
- Max file size: 50MB

**Features:**
- Preserves aspect ratio
- White background for transparent PNGs
- Estimates compression savings
- Fallback to original if compression fails

#### WeatherService (app.js:2-79)
Fetches weather data for outfit selection context.

**Configuration:**
- API: weatherapi.com
- Cache duration: 30 minutes
- Language: French

#### TenuePickerApp (app.js:332-end)
Main application class managing UI state and user interactions.

**UI States:**
- Upload screen (no outfits)
- Action screen (with gallery and controls)
- Result modal (outfit selection)
- All-used modal (when all outfits worn)

**Key Features:**
- File upload with drag-and-drop
- Gallery with expand/collapse (6 items default)
- Click outfit to toggle worn status
- Export/import backup system
- Weather integration
- Upload progress indicator
- Optimization tool for existing outfits

### PWA Features

#### Service Worker (sw.js)
Implements Cache-First strategy for offline functionality.

**Configuration:**
- Cache name: `tenue-picker-v6`
- Relative paths (works locally and on GitHub Pages)
- Auto-cleans old cache versions on activation

**Cached assets:**
- `./` (root)
- `./index.html`
- `./styles.css`
- `./app.js`
- `./manifest.json`

#### Manifest (manifest.json)
Defines PWA installation metadata with relative paths.

**Configuration:**
- Start URL: `./` (relative)
- Display: standalone
- Orientation: portrait
- Icons: 192x192 and 512x512 (relative paths)

### Data Flow

#### Upload Flow
1. User selects images via file input or drag-and-drop
2. `isProcessingFiles` flag set to prevent duplicate triggers
3. Each image compressed via `ImageCompressor`
4. Compressed data stored in IndexedDB with `used: false`
5. Gallery refreshed to show new outfits
6. Flag reset when complete

#### Selection Flow
1. User clicks "Choisir ma tenue"
2. Filter outfits where `used: false`
3. If none available, show "all used" modal
4. Random selection from available outfits
5. Display in result modal
6. On close ("C'est bon"), mark as `used: true`
7. On re-pick, try again without marking

#### Manual Toggle Flow
1. User clicks outfit in gallery
2. `toggleUsed(id)` inverts `used` status
3. Database updated via `store.update()`
4. Gallery refreshed to show/hide checkmark

#### Export Flow
1. User clicks "Sauvegarder mes tenues"
2. Create JSON with version, exportDate, and outfits array
3. Download as `tenues-backup-YYYY-MM-DD.json`

#### Import Flow
1. User clicks "Restaurer mes tenues" (available even when empty)
2. Parse JSON file
3. Confirm if outfits exist (option to add or cancel)
4. Add each outfit via `store.add(outfit.data)`
5. Refresh gallery

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
- Clear Service Worker cache: DevTools → Application → Service Workers → Unregister

## Key Implementation Details

### Image Storage

Images are stored as base64 data URLs in IndexedDB. Each outfit object has:
- `id`: Auto-incremented primary key
- `data`: Base64-encoded JPEG image (compressed)
- `timestamp`: Creation timestamp
- `used`: Boolean indicating if outfit was worn

**Storage considerations:**
- Base64 increases size by ~33% vs binary
- Compression typically achieves 70-85% size reduction
- Optimization tool available to re-compress existing outfits

### Outfit Tracking System

The `used` field tracks worn outfits:
- Set to `false` on creation/import
- Set to `true` when user confirms outfit selection
- Can be toggled manually by clicking outfit in gallery
- "Réinitialiser" button marks all as unworn
- Green checkmark (✓) displays on worn outfits

### Button Organization

Buttons are organized into logical groups:

**Gestion des tenues:**
- Ajouter (add outfits)
- Réinitialiser (reset all to unworn) - only visible if some worn
- Tout supprimer (delete all with strong confirmation)

**Sauvegarde:**
- Sauvegarder (export JSON backup)
- Restaurer (import JSON backup)

**Optimisation:**
- Optimiser le stockage (re-compress existing outfits)

### Mobile Optimizations

**Click handling:**
- `pointer-events: none` on button icons/labels to prevent event capture
- `isProcessingFiles` flag prevents file selector re-opening
- Flag set before opening selector (not in change handler)
- Proper stopPropagation on delete buttons

**Touch feedback:**
- Cursor pointer on gallery items
- Scale animation on click
- Hover effects with transform

### Gallery Behavior

- Default view: 6 outfits maximum
- "Voir tout" button when >6 outfits
- Click outfit to toggle worn status (except delete button)
- Green checkmark on worn outfits (top-left corner)
- Delete button on each item (top-right corner, always visible on mobile)
- Lazy loading via `loading="lazy"` attribute

### Export/Import Format

**JSON structure:**
```json
{
  "version": 1,
  "exportDate": "2026-01-29T10:30:00.000Z",
  "outfits": [
    {
      "id": 1,
      "data": "data:image/jpeg;base64,...",
      "timestamp": 1706521800000,
      "used": false
    }
  ]
}
```

**Compatibility:**
- Old exports (without `used` field) are compatible
- Import only uses `data` field
- New entries always get `used: false`

### Path Configuration

All paths are relative (no `/tenue-picker/` prefix):
- Works in local development
- Works on GitHub Pages
- Manifest uses `./` for start_url
- Service Worker uses `./` for cached resources
- Icons use relative paths

## File Structure

```
/
├── index.html       # Main HTML structure
├── app.js          # All JavaScript (WeatherService, ImageCompressor, OutfitStore, TenuePickerApp)
├── styles.css      # All styles with responsive design
├── sw.js           # Service Worker for offline functionality
├── manifest.json   # PWA manifest with relative paths
├── icon-192.png    # PWA icon 192x192
├── icon-512.png    # PWA icon 512x512
├── README.md       # French documentation
└── CLAUDE.md       # This file
```

## Language Notes

- All UI text is in French
- Code comments are in French
- Variable names use French terminology (e.g., `tenue` = outfit)
