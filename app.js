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
        this.outfits = [];
        this.galleryExpanded = false;
        this.currentlySelectedOutfitId = null;

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
        this.allUsedSection = document.getElementById('allUsedSection');
        this.resetFromModalBtn = document.getElementById('resetFromModalBtn');
        this.closeAllUsedModalBtn = document.getElementById('closeAllUsedModalBtn');
    }

    async init() {
        try {
            await this.store.init();
            await this.loadOutfits();
            this.setupEventListeners();
            this.registerServiceWorker();
        } catch (error) {
            console.error('Erreur initialisation:', error);
        }
    }

    setupEventListeners() {
        // Upload
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.addMoreBtn.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

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
    }

    async handleFiles(files) {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = async (e) => {
                    try {
                        await this.store.add(e.target.result);
                        await this.loadOutfits();
                    } catch (error) {
                        console.error('Erreur ajout image:', error);
                    }
                };

                reader.readAsDataURL(file);
            }
        }

        // Réinitialiser l'input pour permettre de réajouter les mêmes fichiers
        this.fileInput.value = '';
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

            // Ajouter un badge si la tenue est utilisée
            const badge = outfit.used ? '<span class="used-badge">Portée</span>' : '';

            item.innerHTML = `
                <img src="${outfit.data}" alt="Tenue">
                ${badge}
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
