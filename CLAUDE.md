# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Tenue du Jour" is a Progressive Web App (PWA) that helps users randomly select daily outfits from uploaded photos. The app is entirely client-side with no backend, storing all data locally in the browser using IndexedDB.

### Key Features

- Random outfit selection with worn outfit tracking
- **Season system** (été, mi-saison, hiver, toutes) with filter and per-outfit tagging
- Image compression (1600px max, 82% quality JPEG)
- **Image rotation** (90° clockwise per click, saved to DB)
- Export/import backup system (JSON with season data)
- Manual toggle of worn status
- Weather widget integration
- **Calendar** with outfit history (always visible, no toggle)
- **Tab-based navigation** (Tenue / Paramètres)
- Lazy loading for gallery images
- Offline-first PWA architecture

## Architecture

### UI Layout

The app uses a **tab bar** at the top replacing the traditional header:

**Tab 1 — Tenue** (main view):
- Weather widget
- Season filter pills (été, mi-saison, hiver, toutes)
- "Choisir ma tenue" button
- Calendar (always visible when outfits exist)
- Gallery with season badges and rotate buttons

**Tab 2 — Paramètres**:
- Ajouter des photos
- Réinitialiser / Tout supprimer
- Sauvegarder / Restaurer
- Optimiser le stockage

### Core Components

#### OutfitStore (app.js)
Handles all IndexedDB operations for storing outfit images.

**Database:**
- Name: `TenuePickerDB`
- Version: 4 (v2: `used` field, v3: history store, v4: `season` field)
- Object store: `outfits` with auto-incrementing `id` and `timestamp` index
- Object store: `history` with auto-incrementing `id` and `date` index

**Methods:**
- `init()`: Initialize database and handle migrations
- `add(imageData, season)`: Add new outfit with `used: false` and season tag
- `getAll()`: Retrieve all outfits
- `delete(id)`: Delete specific outfit
- `update(id, updates)`: Update outfit fields (used, season, data)
- `resetAll()`: Mark all outfits as unworn (`used: false`)
- `deleteAll()`: Clear all outfits from database
- `addToHistory(outfitId, date)`: Record outfit worn on date
- `getHistoryForMonth(year, month)`: Get calendar data for a month
- `getAllHistory()`: Get full history
- `getHistoryForDate(dateStr)`: Get outfit for a specific date
- `updateHistoryForDate(dateStr, outfitId)`: Set/update outfit for a date
- `deleteHistoryForDate(dateStr)`: Remove outfit from a date

#### ImageCompressor (app.js)
Compresses uploaded images to reduce storage size.

**Configuration:**
- Max dimension: 1600px
- Quality: 82% JPEG
- Timeout: 30 seconds
- Max file size: 50MB

#### WeatherService (app.js)
Fetches weather data for outfit selection context.

**Configuration:**
- API: weatherapi.com
- Cache duration: 30 minutes
- Language: French

#### TenuePickerApp (app.js)
Main application class managing UI state and user interactions.

**Key Features:**
- Tab navigation (switchTab)
- Season filter with auto-detection and localStorage persistence
- Season cycling on gallery badges
- Image rotation via canvas (rotateOutfit)
- Calendar rendering (always visible, no toggle)
- Calendar delete button shown on thumbnail tap (show-delete pattern)

### PWA Features

#### Service Worker (sw.js)
Implements Cache-First strategy for offline functionality.

**Configuration:**
- Cache name: `tenue-picker-v8`
- Relative paths (works locally and on GitHub Pages)
- Auto-cleans old cache versions on activation

**Cached assets:**
- `./`, `./index.html`, `./styles.css`, `./app.js`, `./manifest.json`, `./icon.png`

#### Manifest (manifest.json)
- Start URL: `./` (relative)
- Display: standalone
- Orientation: portrait
- Icon: `./icon.png` (512x512, used for both 192 and 512 sizes)

### Data Flow

#### Upload Flow
1. User selects images via file input or drag-and-drop
2. `isProcessingFiles` flag set to prevent duplicate triggers
3. Each image compressed via `ImageCompressor`
4. Compressed data stored in IndexedDB with `used: false` and `season: activeSeason`
5. Gallery refreshed to show new outfits
6. Flag reset when complete

#### Selection Flow
1. User clicks "Choisir ma tenue"
2. Filter outfits by active season (`getFilteredOutfits`)
3. Filter remaining by `used: false`
4. If none available, show "all used" modal
5. Random selection from available outfits
6. Display in result modal
7. On close ("C'est bon"), mark as `used: true` and add to history
8. On re-pick, try again without marking

#### Season System
- **Filter pills**: été, mi-saison, hiver, toutes — affects gallery, counts, and picker
- **Auto-detection**: Jun-Aug → été, Dec-Feb → hiver, else → mi-saison
- **Persistence**: active season saved in localStorage
- **Gallery badge**: emoji badge (bottom-left) on each outfit, clickable to cycle season
- **Upload tagging**: new photos tagged with the currently active season
- **DB migration**: existing outfits (pre-v4) default to `hiver`
- **Import fallback**: old backups without season field import as `hiver`

#### Rotation Flow
1. User clicks ↻ button on gallery item
2. Image loaded into canvas, rotated 90° clockwise
3. Re-encoded as JPEG at 82% quality
4. Updated in IndexedDB immediately
5. Gallery refreshed

#### Export Flow
1. User clicks "Sauvegarder" in Paramètres tab
2. Retrieve all outfits (including season field) and calendar history
3. Create JSON with version (2), exportDate, outfits array, and history array
4. Download as `tenues-backup-YYYY-MM-DD.json`

#### Import Flow
1. User clicks "Restaurer" in Paramètres tab
2. Parse JSON file
3. Confirm if outfits exist (option to add or cancel)
4. Add each outfit via `store.add(outfit.data, outfit.season || 'hiver')`
5. Create ID mapping (oldId → newId)
6. Import history entries using ID mapping
7. Existing calendar entries are overwritten if same date

## Development

### Running Locally

```bash
python3 -m http.server 8080
```

Access at `http://localhost:8080`

### Testing PWA Features

- Service Worker requires HTTPS (or localhost)
- Test installation on mobile: Chrome → "Install app" or Safari → "Add to Home Screen"
- Test offline mode: DevTools → Application → Service Workers → Offline checkbox

## Key Implementation Details

### Image Storage

Images are stored as base64 data URLs in IndexedDB. Each outfit object has:
- `id`: Auto-incremented primary key
- `data`: Base64-encoded JPEG image (compressed)
- `timestamp`: Creation timestamp
- `used`: Boolean indicating if outfit was worn
- `season`: String — `ete`, `mi-saison`, `hiver`, or `toutes`

### Calendar Behavior

- Always visible when outfits exist (no toggle button)
- Rendered in `updateUI()` automatically
- Delete button hidden by default on thumbnails
- First tap on thumbnail → shows delete button (`.show-delete` class)
- Second tap → opens outfit detail
- Tap elsewhere → hides delete button and opens calendar editor

### Gallery Behavior

- Default view: 6 outfits maximum (filtered by active season)
- "Voir tout" button when >6 filtered outfits
- Click outfit to toggle worn status
- Green checkmark (✓) on worn outfits (top-left)
- Season badge with emoji (bottom-left, clickable to cycle)
- Rotate button ↻ (bottom-right, 90° clockwise)
- Delete button × (top-right)
- Lazy loading via `loading="lazy"` attribute

### Export/Import Format

**JSON structure (version 2):**
```json
{
  "version": 2,
  "exportDate": "2026-01-29T10:30:00.000Z",
  "outfits": [
    {
      "id": 1,
      "data": "data:image/jpeg;base64,...",
      "timestamp": 1706521800000,
      "used": false,
      "season": "hiver"
    }
  ],
  "history": [
    {
      "id": 1,
      "outfitId": 1,
      "date": "2026-01-29",
      "timestamp": 1706521800000
    }
  ]
}
```

**Compatibility:**
- Old exports without `season` field → imported as `hiver`
- Old exports without `history` field → still compatible
- Old exports without `used` field → still compatible

### Icon

**Always use `icon.png`** (512x512). Never reference `icon-192.png` or `icon-512.png` (deleted).

### Path Configuration

All paths are relative (no `/tenue-picker/` prefix):
- Works in local development
- Works on GitHub Pages

## File Structure

```
/
├── index.html       # Main HTML with tab bar layout
├── app.js           # All JavaScript (WeatherService, ImageCompressor, OutfitStore, TenuePickerApp)
├── styles.css       # All styles with responsive design and tab bar
├── sw.js            # Service Worker (cache v8)
├── manifest.json    # PWA manifest
├── icon.png         # App icon (512x512, used for all sizes)
├── README.md        # French documentation
└── CLAUDE.md        # This file
```

## Language Notes

- All UI text is in French
- Code comments are in French
- Variable names use French terminology (e.g., `tenue` = outfit)
