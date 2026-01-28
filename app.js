// Gestion du stockage IndexedDB
class OutfitStore {
    constructor() {
        this.dbName = 'TenuePickerDB';
        this.storeName = 'outfits';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
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
                timestamp: Date.now()
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
}

// Application principale
class TenuePickerApp {
    constructor() {
        this.store = new OutfitStore();
        this.outfits = [];
        this.galleryExpanded = false;

        this.initElements();
        this.init();
    }

    initElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
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
        this.toggleGalleryBtn = document.getElementById('toggleGalleryBtn');
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

        // Mettre à jour compteur
        this.outfitCount.textContent = this.outfits.length;

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
            item.innerHTML = `
                <img src="${outfit.data}" alt="Tenue">
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
        if (this.outfits.length === 0) return;

        const randomIndex = Math.floor(Math.random() * this.outfits.length);
        const selectedOutfit = this.outfits[randomIndex];

        this.selectedOutfit.src = selectedOutfit.data;
        this.resultSection.style.display = 'flex';
    }

    closeResult() {
        this.resultSection.style.display = 'none';
    }

    async deleteOutfit(id) {
        if (confirm('Supprimer cette tenue ?')) {
            await this.store.delete(id);
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
