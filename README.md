# Tenue du Jour

Application PWA pour choisir aléatoirement votre tenue du jour parmi vos photos.

## Fonctionnalités

- Upload de photos de tenues (drag & drop ou sélection)
- Stockage local sécurisé (IndexedDB)
- Sélection aléatoire d'une tenue
- Galerie de toutes vos tenues
- Suppression de tenues
- Fonctionne hors ligne
- Installable sur téléphone

## Utilisation Locale

### Option 1 : Avec un serveur local

```bash
# Installer un serveur HTTP simple
npm install -g http-server

# Lancer le serveur
http-server -p 8080

# Ouvrir http://localhost:8080 dans votre navigateur
```

### Option 2 : Avec Python

```bash
# Python 3
python -m http.server 8080

# Ouvrir http://localhost:8080 dans votre navigateur
```

### Option 3 : Hébergement gratuit

1. Créer un compte GitHub
2. Créer un nouveau repository
3. Pousser ces fichiers
4. Activer GitHub Pages dans les paramètres
5. Accéder à `https://votre-username.github.io/tenue-picker`

## Installation sur téléphone

### Android (Chrome)
1. Ouvrir l'application dans Chrome
2. Menu (3 points) → "Installer l'application"
3. L'icône apparaît sur votre écran d'accueil

### iOS (Safari)
1. Ouvrir l'application dans Safari
2. Bouton "Partager" → "Sur l'écran d'accueil"
3. L'icône apparaît sur votre écran d'accueil

## Technologies

- HTML5 / CSS3 / JavaScript vanilla
- IndexedDB pour stockage local
- Service Worker pour fonctionnement hors ligne
- PWA (Progressive Web App)

## Notes

- Les images sont stockées localement sur votre appareil
- Aucune donnée n'est envoyée sur Internet
- Fonctionne complètement hors ligne après première visite
- Pas de compte nécessaire, tout est privé
