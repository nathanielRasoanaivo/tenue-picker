// Service météo
class WeatherService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.cacheKey = 'weather_cache';
        this.cacheDuration = 30 * 60 * 1000; // 30 minutes
    }

    async getWeather() {
        // Vérifier le cache
        const cached = this.getCachedWeather();
        if (cached) {
            return cached;
        }

        // Obtenir la position
        const position = await this.getPosition();

        // Appeler l'API
        const url = `https://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${position.latitude},${position.longitude}&lang=fr`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Erreur API météo');
        }

        const data = await response.json();

        const weather = {
            temp: Math.round(data.current.temp_c),
            condition: data.current.condition.text,
            icon: data.current.condition.icon,
            timestamp: Date.now()
        };

        // Mettre en cache
        localStorage.setItem(this.cacheKey, JSON.stringify(weather));

        return weather;
    }

    getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Géolocalisation non supportée'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }),
                (error) => reject(error),
                { timeout: 10000 }
            );
        });
    }

    getCachedWeather() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;

            const weather = JSON.parse(cached);
            const age = Date.now() - weather.timestamp;

            if (age < this.cacheDuration) {
                return weather;
            }

            // Cache expiré
            localStorage.removeItem(this.cacheKey);
            return null;
        } catch {
            return null;
        }
    }
}

// Compression d'images
class ImageCompressor {
    constructor(maxDimension = 1600, quality = 0.82) {
        this.maxDimension = maxDimension;
        this.quality = quality;
    }

    async compress(file) {
        return new Promise((resolve, reject) => {
            // Validation
            if (!file.type.startsWith('image/')) {
                reject(new Error('Fichier non-image'));
                return;
            }

            if (file.size > 50 * 1024 * 1024) {
                reject(new Error('Fichier trop volumineux (max 50MB)'));
                return;
            }

            const img = new Image();
            const reader = new FileReader();

            const timeout = setTimeout(() => {
                reject(new Error('Timeout compression'));
            }, 30000);

            reader.onerror = () => reject(reader.error);

            reader.onload = (e) => {
                img.onload = () => {
                    clearTimeout(timeout);
                    try {
                        const compressed = this._compressImage(img);
                        resolve({
                            data: compressed,
                            originalSize: file.size,
                            compressedSize: this._estimateSize(compressed)
                        });
                    } catch (error) {
                        reject(error);
                    }
                };

                img.onerror = () => reject(new Error('Image invalide'));
                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    }

    _compressImage(img) {
        const { width, height } = this._calculateDimensions(img.width, img.height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fond blanc pour PNG avec transparence
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Dessiner image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en JPEG compressé
        return canvas.toDataURL('image/jpeg', this.quality);
    }

    _calculateDimensions(width, height) {
        // Ne pas agrandir les petites images
        if (width <= this.maxDimension && height <= this.maxDimension) {
            return { width, height };
        }

        // Préserver ratio d'aspect
        const ratio = Math.min(
            this.maxDimension / width,
            this.maxDimension / height
        );

        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }

    _estimateSize(dataUrl) {
        const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
        return Math.round(base64Length * 0.75);
    }
}

// Gestion du stockage IndexedDB
class OutfitStore {
    constructor() {
        this.dbName = 'TenuePickerDB';
        this.storeName = 'outfits';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // Si création initiale
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Si migration v1 → v2 : ajouter le champ 'used' aux tenues existantes
                if (event.oldVersion < 2) {
                    const objectStore = transaction.objectStore(this.storeName);
                    objectStore.openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const outfit = cursor.value;
                            if (outfit.used === undefined) {
                                outfit.used = false;
                                cursor.update(outfit);
                            }
                            cursor.continue();
                        }
                    };
                }
            };
        });
    }

    async add(imageData) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.add({
                data: imageData,
                timestamp: Date.now(),
                used: false
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll() {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(id) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async update(id, updates) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const outfit = getRequest.result;
                if (!outfit) {
                    reject(new Error('Tenue non trouvée'));
                    return;
                }

                Object.assign(outfit, updates);
                const updateRequest = store.put(outfit);

                updateRequest.onsuccess = () => resolve(outfit);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async resetAll() {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                const outfits = request.result;
                const updates = outfits.map(outfit => {
                    outfit.used = false;
                    return store.put(outfit);
                });

                Promise.all(updates)
                    .then(() => resolve())
                    .catch(reject);
            };

            request.onerror = () => reject(request.error);
        });
    }
}

// Application principale
class TenuePickerApp {
    constructor() {
        this.store = new OutfitStore();
        this.compressor = new ImageCompressor(1600, 0.82);
        this.weather = new WeatherService('0b4aecf33e6148749b390920262901');
        this.outfits = [];
        this.galleryExpanded = false;
        this.currentlySelectedOutfitId = null;
        this.isProcessingFiles = false;

        this.initElements();
        this.init();
    }

    initElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.addMoreBtn = document.getElementById('addMoreBtn');
        this.uploadSection = document.getElementById('uploadSection');
        this.actionSection = document.getElementById('actionSection');
        this.pickOutfitBtn = document.getElementById('pickOutfitBtn');
        this.resultSection = document.getElementById('resultSection');
        this.selectedOutfit = document.getElementById('selectedOutfit');
        this.rePickBtn = document.getElementById('rePickBtn');
        this.closeResultBtn = document.getElementById('closeResultBtn');
        this.gallerySection = document.getElementById('gallerySection');
        this.gallery = document.getElementById('gallery');
        this.outfitCount = document.getElementById('outfitCount');
        this.availableCount = document.getElementById('availableCount');
        this.toggleGalleryBtn = document.getElementById('toggleGalleryBtn');
        this.resetAllBtn = document.getElementById('resetAllBtn');
        this.optimizeBtn = document.getElementById('optimizeBtn');
        this.allUsedSection = document.getElementById('allUsedSection');
        this.resetFromModalBtn = document.getElementById('resetFromModalBtn');
        this.closeAllUsedModalBtn = document.getElementById('closeAllUsedModalBtn');
        this.weatherWidget = document.getElementById('weatherWidget');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importInput = document.getElementById('importInput');
    }

    async init() {
        try {
            await this.store.init();
            await this.loadOutfits();
            this.setupEventListeners();
            this.registerServiceWorker();
            this.loadWeather();
        } catch (error) {
            console.error('Erreur initialisation:', error);
        }
    }

    setupEventListeners() {
        // Upload
        this.uploadBtn.addEventListener('click', () => {
            if (!this.isProcessingFiles) {
                this.isProcessingFiles = true;
                this.fileInput.click();
            }
        });
        this.addMoreBtn.addEventListener('click', () => {
            if (!this.isProcessingFiles) {
                this.isProcessingFiles = true;
                this.fileInput.click();
            }
        });
        this.uploadArea.addEventListener('click', () => {
            if (!this.isProcessingFiles) {
                this.isProcessingFiles = true;
                this.fileInput.click();
            }
        });
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFiles(e.target.files);
            } else {
                // L'utilisateur a annulé la sélection
                this.isProcessingFiles = false;
            }
        });

        // Drag & Drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Actions
        this.pickOutfitBtn.addEventListener('click', () => this.pickRandomOutfit());
        this.rePickBtn.addEventListener('click', () => this.pickRandomOutfit());
        this.closeResultBtn.addEventListener('click', () => this.closeResult());
        this.toggleGalleryBtn.addEventListener('click', () => this.toggleGallery());
        this.resetAllBtn.addEventListener('click', () => this.resetAllOutfits());
        this.resetFromModalBtn.addEventListener('click', () => {
            this.resetAllOutfits();
            this.allUsedSection.style.display = 'none';
        });
        this.closeAllUsedModalBtn.addEventListener('click', () => {
            this.allUsedSection.style.display = 'none';
        });
        this.optimizeBtn.addEventListener('click', () => this.optimizeExistingOutfits());
        this.exportBtn.addEventListener('click', () => this.exportOutfits());
        this.importBtn.addEventListener('click', () => this.importInput.click());
        this.importInput.addEventListener('change', (e) => this.importOutfits(e));
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    async handleFiles(files) {
        if (!files || files.length === 0) {
            this.isProcessingFiles = false;
            return;
        }

        const fileArray = Array.from(files);

        if (fileArray.length > 1) {
            this.showUploadProgress(0, fileArray.length);
        }

        let processed = 0;

        for (const file of fileArray) {
            if (file.type.startsWith('image/')) {
                try {
                    // Compression
                    const result = await this.compressor.compress(file);

                    // Stockage
                    await this.store.add(result.data);

                    // Log compression
                    const ratio = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
                    console.log(`Compression: ${(result.originalSize / 1024).toFixed(0)}KB → ${(result.compressedSize / 1024).toFixed(0)}KB (${ratio}% réduction)`);

                    processed++;

                    if (fileArray.length > 1) {
                        this.updateUploadProgress(processed, fileArray.length);
                    }

                } catch (error) {
                    console.error('Erreur compression:', error);

                    // Fallback: stockage sans compression
                    try {
                        const imageData = await this.readFileAsDataURL(file);
                        await this.store.add(imageData);
                        console.warn('Image ajoutée sans compression');
                        processed++;

                        if (fileArray.length > 1) {
                            this.updateUploadProgress(processed, fileArray.length);
                        }
                    } catch (storeError) {
                        console.error('Erreur ajout fichier:', storeError);
                        this.showError(`Impossible d'ajouter ${file.name}`);
                    }
                }
            }
        }

        await this.loadOutfits();
        this.hideUploadProgress();
        this.fileInput.value = '';
        this.isProcessingFiles = false;
    }

    async loadOutfits() {
        this.outfits = await this.store.getAll();
        this.updateUI();
    }

    updateUI() {
        const hasOutfits = this.outfits.length > 0;

        // Afficher/masquer sections
        this.uploadSection.style.display = hasOutfits ? 'none' : 'block';
        this.actionSection.style.display = hasOutfits ? 'block' : 'none';
        this.gallerySection.style.display = hasOutfits ? 'block' : 'none';

        // Calculer les tenues disponibles
        const availableOutfits = this.outfits.filter(outfit => !outfit.used);
        const availableCount = availableOutfits.length;

        // Mettre à jour les compteurs
        this.outfitCount.textContent = this.outfits.length;
        this.availableCount.textContent = availableCount;

        // Afficher/masquer le bouton reset (seulement si des tenues sont utilisées)
        const hasUsedOutfits = this.outfits.some(outfit => outfit.used);
        this.resetAllBtn.style.display = hasUsedOutfits ? 'block' : 'none';

        // Afficher galerie
        this.renderGallery();
    }

    renderGallery() {
        this.gallery.innerHTML = '';

        const displayCount = this.galleryExpanded ? this.outfits.length : Math.min(6, this.outfits.length);
        const outfitsToShow = this.outfits.slice(0, displayCount);

        if (outfitsToShow.length === 0) {
            this.gallery.innerHTML = '<div class="empty-state"><span>👔</span><p>Aucune tenue</p></div>';
            return;
        }

        outfitsToShow.forEach(outfit => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            // Ajouter une encoche verte si la tenue est utilisée
            const checkmark = outfit.used ? '<span class="used-checkmark">✓</span>' : '';

            item.innerHTML = `
                <img src="${outfit.data}" alt="Tenue" loading="lazy">
                ${checkmark}
                <button class="delete-btn" data-id="${outfit.id}">×</button>
            `;

            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteOutfit(outfit.id);
            });

            this.gallery.appendChild(item);
        });

        // Mettre à jour bouton toggle
        if (this.outfits.length > 6) {
            this.toggleGalleryBtn.textContent = this.galleryExpanded ? 'Voir moins' : 'Voir tout';
        } else {
            this.toggleGalleryBtn.style.display = 'none';
        }
    }

    toggleGallery() {
        this.galleryExpanded = !this.galleryExpanded;
        this.renderGallery();
    }

    pickRandomOutfit() {
        // Filtrer les tenues disponibles
        const availableOutfits = this.outfits.filter(outfit => !outfit.used);

        // Si toutes les tenues sont utilisées
        if (availableOutfits.length === 0) {
            this.showAllUsedModal();
            return;
        }

        // Sélection aléatoire parmi les disponibles
        const randomIndex = Math.floor(Math.random() * availableOutfits.length);
        const selectedOutfit = availableOutfits[randomIndex];

        // Stocker l'ID pour le marquer plus tard
        this.currentlySelectedOutfitId = selectedOutfit.id;

        // Afficher le résultat
        this.selectedOutfit.src = selectedOutfit.data;
        this.resultSection.style.display = 'flex';
    }

    showAllUsedModal() {
        this.allUsedSection.style.display = 'flex';
    }

    async closeResult() {
        // Marquer la tenue comme utilisée
        if (this.currentlySelectedOutfitId) {
            await this.store.update(this.currentlySelectedOutfitId, { used: true });
            await this.loadOutfits();
            this.currentlySelectedOutfitId = null;
        }

        // Fermer le modal
        this.resultSection.style.display = 'none';
    }

    async deleteOutfit(id) {
        if (confirm('Supprimer cette tenue ?')) {
            await this.store.delete(id);
            await this.loadOutfits();
        }
    }

    async resetAllOutfits() {
        if (confirm('Réinitialiser toutes les tenues comme non portées ?')) {
            await this.store.resetAll();
            await this.loadOutfits();
        }
    }

    async optimizeExistingOutfits() {
        const message = `Optimiser toutes les tenues existantes?\n\nCela peut prendre quelques instants mais réduira significativement l'espace de stockage.`;

        if (!confirm(message)) return;

        this.showOptimizationProgress(0, this.outfits.length);
        let optimized = 0;
        let totalSaved = 0;

        for (const outfit of this.outfits) {
            try {
                const response = await fetch(outfit.data);
                const blob = await response.blob();
                const file = new File([blob], 'outfit.jpg', { type: blob.type });

                const result = await this.compressor.compress(file);

                // Mise à jour si gain >20%
                const saved = result.originalSize - result.compressedSize;
                if (saved > result.originalSize * 0.2) {
                    await this.store.update(outfit.id, { data: result.data });
                    totalSaved += saved;
                    optimized++;
                }

                this.updateOptimizationProgress(
                    this.outfits.indexOf(outfit) + 1,
                    this.outfits.length
                );

            } catch (error) {
                console.error(`Erreur optimisation tenue ${outfit.id}:`, error);
            }
        }

        this.hideOptimizationProgress();
        await this.loadOutfits();

        alert(`✓ Optimisation terminée!\n\n${optimized} tenues optimisées\n~${(totalSaved / 1024 / 1024).toFixed(1)}MB économisés`);
    }

    exportOutfits() {
        // Créer l'objet JSON avec les métadonnées
        const exportData = {
            version: 1,
            exportDate: new Date().toISOString(),
            outfits: this.outfits
        };

        // Convertir en JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Créer un nom de fichier avec la date
        const date = new Date().toISOString().split('T')[0];
        const filename = `tenues-backup-${date}.json`;

        // Télécharger le fichier
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`✓ Sauvegarde créée!\n\n${this.outfits.length} tenues sauvegardées\nFichier: ${filename}`);
    }

    async importOutfits(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // Vérifier la structure du JSON
            if (!importData.outfits || !Array.isArray(importData.outfits)) {
                throw new Error('Format de fichier invalide');
            }

            // Demander confirmation si des tenues existent déjà
            if (this.outfits.length > 0) {
                const message = `Vous avez déjà ${this.outfits.length} tenue(s).\n\nVoulez-vous :\n- OK : Ajouter les tenues du fichier (${importData.outfits.length} tenues)\n- Annuler : Ne rien faire`;

                if (!confirm(message)) {
                    this.importInput.value = '';
                    return;
                }
            }

            // Importer les tenues
            let imported = 0;
            for (const outfit of importData.outfits) {
                // Vérifier que la tenue a les champs requis
                if (outfit.data && outfit.timestamp !== undefined) {
                    await this.store.add(outfit.data);
                    imported++;
                }
            }

            // Recharger les tenues
            await this.loadOutfits();

            alert(`✓ Restauration réussie!\n\n${imported} tenues importées`);

        } catch (error) {
            console.error('Erreur import:', error);
            alert(`❌ Erreur lors de l'importation\n\n${error.message}`);
        } finally {
            // Réinitialiser l'input
            this.importInput.value = '';
        }
    }

    showUploadProgress(current, total) {
        const overlay = document.getElementById('uploadProgress');
        document.getElementById('uploadCurrent').textContent = current;
        document.getElementById('uploadTotal').textContent = total;
        overlay.style.display = 'flex';
    }

    updateUploadProgress(current, total) {
        document.getElementById('uploadCurrent').textContent = current;
    }

    hideUploadProgress() {
        document.getElementById('uploadProgress').style.display = 'none';
    }

    showOptimizationProgress(current, total) {
        const overlay = document.getElementById('optimizationProgress');
        document.getElementById('optCurrent').textContent = current;
        document.getElementById('optTotal').textContent = total;
        document.getElementById('optProgressBar').style.width = '0%';
        overlay.style.display = 'flex';
    }

    updateOptimizationProgress(current, total) {
        document.getElementById('optCurrent').textContent = current;
        const percent = (current / total * 100).toFixed(0);
        document.getElementById('optProgressBar').style.width = percent + '%';
    }

    hideOptimizationProgress() {
        document.getElementById('optimizationProgress').style.display = 'none';
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async loadWeather() {
        try {
            const weather = await this.weather.getWeather();
            this.displayWeather(weather);
        } catch (error) {
            console.error('Erreur météo:', error);
            // Ne pas afficher le widget si erreur
            this.weatherWidget.style.display = 'none';
        }
    }

    displayWeather(weather) {
        this.weatherWidget.innerHTML = `
            <img src="https:${weather.icon}" alt="${weather.condition}">
            <div class="weather-info">
                <div class="weather-temp">${weather.temp}°C</div>
                <div class="weather-condition">${weather.condition}</div>
            </div>
        `;
        this.weatherWidget.style.display = 'flex';
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker enregistré'))
                .catch(err => console.error('Erreur Service Worker:', err));
        }
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new TenuePickerApp();
});
