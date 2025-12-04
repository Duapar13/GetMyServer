const API_BASE_URL = 'http://localhost:3000';

// Fonction pour parser et formater récursivement les strings JSON échappées
function parseNestedJSON(obj) {
    if (typeof obj === 'string') {
        // Essayer de parser si c'est une string JSON
        try {
            const parsed = JSON.parse(obj);
            // Si c'est un objet ou un array, le parser récursivement
            if (typeof parsed === 'object' && parsed !== null) {
                return parseNestedJSON(parsed);
            }
            return parsed;
        } catch (e) {
            // Ce n'est pas du JSON, retourner la string telle quelle
            return obj;
        }
    } else if (Array.isArray(obj)) {
        return obj.map(item => parseNestedJSON(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = parseNestedJSON(obj[key]);
            }
        }
        return result;
    }
    return obj;
}

// Fonction pour colorer le JSON avec syntax highlighting
function highlightJSON(jsonString) {
    try {
        // Parser le JSON pour s'assurer qu'il est valide
        let parsed = JSON.parse(jsonString);
        
        // Parser récursivement les strings JSON échappées
        parsed = parseNestedJSON(parsed);
        
        // Formater avec une indentation propre
        const formatted = JSON.stringify(parsed, null, 2);
        
        // Échapper les caractères HTML
        let html = formatted
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Traiter ligne par ligne pour une meilleure précision
        const lines = html.split('\n');
        const processedLines = lines.map(line => {
            // Colorer les booléens et null d'abord
            line = line.replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>');
            line = line.replace(/\bnull\b/g, '<span class="json-null">null</span>');
            
            // Colorer les nombres (seulement ceux qui ne sont pas dans des strings)
            // On vérifie qu'on n'est pas dans une string en comptant les guillemets avant
            const numberRegex = /(:\s*)(-?\d+\.?\d*)([,}\s]*)/g;
            line = line.replace(numberRegex, (match, prefix, number, suffix, offset) => {
                // Compter les guillemets avant le match pour savoir si on est dans une string
                const beforeMatch = line.substring(0, offset);
                const quoteCount = (beforeMatch.match(/"/g) || []).length;
                // Si le nombre de guillemets est pair, on n'est pas dans une string
                if (quoteCount % 2 === 0) {
                    return prefix + '<span class="json-number">' + number + '</span>' + suffix;
                }
                return match;
            });
            
            // Colorer les valeurs string (après les deux-points)
            line = line.replace(/(:\s*)("(?:[^"\\]|\\.)*")/g, '$1<span class="json-string">$2</span>');
            
            // Colorer les clés JSON (avant les deux-points)
            line = line.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="json-key">$1</span>$2');
            
            return line;
        });
        
        return processedLines.join('\n');
    } catch (e) {
        // Si ce n'est pas du JSON valide, retourner le texte échappé
        return jsonString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

const methodSelect = document.getElementById('method');
const urlInput = document.getElementById('url');
const bearerTokenInput = document.getElementById('bearer-token');
const basicAuthInput = document.getElementById('basic-auth');
const bodyTextarea = document.getElementById('body');
const bodyGroup = document.getElementById('body-group');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const responseStatus = document.getElementById('response-status');
const responseContent = document.getElementById('response-content');
const responseContainer = document.querySelector('.response-container');
const copyResponseBtn = document.getElementById('copy-response-btn');
const toggleExpandBtn = document.getElementById('toggle-expand-btn');

// Stocker la réponse complète pour la copie
let fullResponseText = '';
const saveBtn = document.getElementById('save-btn');
const createFolderBtn = document.getElementById('create-folder-btn');
const folderNameInput = document.getElementById('folder-name-input');
const refreshRoutesBtn = document.getElementById('refresh-routes-btn');
const foldersList = document.getElementById('folders-list');

// Afficher/masquer le champ body selon la méthode
methodSelect.addEventListener('change', () => {
    const method = methodSelect.value;
    if (method === 'POST' || method === 'PUT') {
        bodyGroup.style.display = 'block';
    } else {
        bodyGroup.style.display = 'none';
    }
});

// Envoyer la requête
sendBtn.addEventListener('click', async () => {
    const method = methodSelect.value;
    let url = urlInput.value.trim();
    
    // Détecter si c'est une URL complète (http:// ou https://) ou un chemin relatif
    let fullUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // URL complète - utiliser directement
        fullUrl = url;
    } else {
        // Chemin relatif - ajouter le préfixe si nécessaire
        if (!url.startsWith('/')) {
            url = '/' + url;
        }
        fullUrl = API_BASE_URL + url;
    }
    
    let options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    
    // Ajouter Basic Auth si fourni (priorité sur Bearer Token)
    const basicAuth = basicAuthInput.value.trim();
    if (basicAuth) {
        let basicAuthValue = basicAuth;
        // Si ce n'est pas déjà en base64, convertir username:password en base64
        if (basicAuth.includes(':')) {
            // Convertir username:password en base64
            basicAuthValue = btoa(basicAuth);
        }
        // Sinon, utiliser tel quel (déjà en base64)
        options.headers['Authorization'] = `Basic ${basicAuthValue}`;
    } else {
        // Ajouter le Bearer token si fourni (seulement si Basic Auth n'est pas utilisé)
        const bearerToken = bearerTokenInput.value.trim();
        if (bearerToken) {
            options.headers['Authorization'] = `Bearer ${bearerToken}`;
        }
    }
    
    if (method === 'POST' || method === 'PUT') {
        const bodyValue = bodyTextarea.value.trim();
        if (bodyValue) {
            try {
                // Valider que c'est du JSON valide
                const parsed = JSON.parse(bodyValue);
                
                // Détecter si c'est une URL Nakama RPC (contient /rpc/)
                // Les APIs Nakama RPC attendent le body comme une string JSON échappée
                const isNakamaRPC = fullUrl.includes('/rpc/');
                
                if (isNakamaRPC) {
                    // Pour Nakama RPC, envoyer le JSON comme une string échappée
                    // Format: "{\"key\": \"value\"}" au lieu de {"key": "value"}
                    options.body = JSON.stringify(bodyValue);
                } else {
                    // Pour les autres APIs, envoyer le JSON normalement
                    options.body = JSON.stringify(parsed);
                }
            } catch (e) {
                responseStatus.textContent = 'Erreur: JSON invalide dans le body';
                responseStatus.className = 'status-badge error';
                responseContent.textContent = `Erreur de validation JSON: ${e.message}`;
                responseContent.classList.remove('json-highlighted');
                return;
            }
        } else {
            // Si le body est vide, envoyer un objet vide
            options.body = JSON.stringify({});
        }
    }
    
    try {
        responseStatus.textContent = 'Envoi...';
        responseStatus.className = 'status-badge info';
        
        const response = await fetch(fullUrl, options);
        const contentType = response.headers.get('content-type');
        
        let data;
        let responseText;
        
        // Vérifier si la réponse est du JSON
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
                responseText = JSON.stringify(data, null, 2);
            } catch (jsonError) {
                responseText = await response.text();
            }
        } else {
            // Si ce n'est pas du JSON, lire comme texte
            responseText = await response.text();
        }
        
        const statusClass = response.ok ? 'success' : 'error';
        responseStatus.textContent = `Status: ${response.status} ${response.statusText}`;
        responseStatus.className = `status-badge ${statusClass}`;
        
        // Stocker la réponse complète pour la copie
        fullResponseText = responseText;
        
        // Vérifier si c'est du JSON pour appliquer la coloration
        let displayText = responseText;
        let isJSON = false;
        
        if (contentType && contentType.includes('application/json')) {
            try {
                JSON.parse(responseText);
                isJSON = true;
            } catch (e) {
                // Ce n'est pas du JSON valide
            }
        }
        
        // Limiter l'affichage si la réponse est très longue (réduit à 30KB pour éviter les problèmes)
        const maxDisplayLength = 30000; // ~30KB de texte
        if (responseText.length > maxDisplayLength) {
            const truncated = responseText.substring(0, maxDisplayLength);
            displayText = truncated + `\n\n... (${(responseText.length - maxDisplayLength).toLocaleString('fr-FR')} caractères supplémentaires)\n💡 Utilisez le bouton 📋 pour copier le contenu complet`;
            isJSON = false; // Ne pas colorer si tronqué
        }
        
        // Appliquer la coloration si c'est du JSON
        if (isJSON) {
            responseContent.innerHTML = highlightJSON(displayText);
            responseContent.classList.add('json-highlighted');
        } else {
            responseContent.textContent = displayText;
            responseContent.classList.remove('json-highlighted');
        }
        
        // Réduire la taille de la police si la réponse est très longue
        if (responseText.length > 10000) {
            responseContent.style.fontSize = '0.7em';
        } else {
            responseContent.style.fontSize = '';
        }
        
        // Réinitialiser l'état d'expansion
        if (responseContainer) {
            responseContainer.classList.remove('expanded');
        }
    } catch (error) {
        responseStatus.textContent = 'Erreur de connexion';
        responseStatus.className = 'status-badge error';
        
        let errorMessage = `Erreur: ${error.message}`;
        if (fullUrl.startsWith(API_BASE_URL)) {
            errorMessage += '\n\nAssurez-vous que le serveur Express est démarré sur le port 3000.';
        } else {
            errorMessage += '\n\nVérifiez que l\'URL est correcte et que le serveur est accessible.';
        }
        
        // Limiter aussi les messages d'erreur
        const maxDisplayLength = 50000;
        let errorDisplay = errorMessage;
        if (errorMessage.length > maxDisplayLength) {
            errorDisplay = errorMessage.substring(0, maxDisplayLength) + `\n\n... (${(errorMessage.length - maxDisplayLength).toLocaleString('fr-FR')} caractères supplémentaires)`;
        }
        
        responseContent.textContent = errorDisplay;
        responseContent.classList.remove('json-highlighted');
        
        if (responseContainer) {
            responseContainer.classList.remove('expanded');
        }
    }
});

// Copier la réponse (toujours copier le texte complet même s'il est tronqué)
copyResponseBtn.addEventListener('click', () => {
    const textToCopy = fullResponseText || responseContent.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Feedback visuel temporaire
        const originalText = copyResponseBtn.textContent;
        copyResponseBtn.textContent = '✓';
        setTimeout(() => {
            copyResponseBtn.textContent = originalText;
        }, 1000);
    }).catch(err => {
        alert(`Erreur lors de la copie: ${err.message}`);
    });
});

// Toggle expansion de la réponse
toggleExpandBtn.addEventListener('click', () => {
    if (responseContainer) {
        responseContainer.classList.toggle('expanded');
        toggleExpandBtn.textContent = responseContainer.classList.contains('expanded') ? '⛶ Réduire' : '⛶ Agrandir';
        toggleExpandBtn.title = responseContainer.classList.contains('expanded') ? 'Réduire la réponse' : 'Agrandir la réponse';
    }
});

// Effacer les champs
clearBtn.addEventListener('click', () => {
    urlInput.value = '/api/items';
    bearerTokenInput.value = '';
    basicAuthInput.value = '';
    bodyTextarea.value = '';
    responseStatus.textContent = '';
    responseStatus.className = '';
    responseContent.textContent = '';
    fullResponseText = '';
    if (responseContainer) {
        responseContainer.classList.remove('expanded');
    }
});

// Permettre d'envoyer avec Enter dans les champs
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

bodyTextarea.addEventListener('keypress', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        sendBtn.click();
    }
});

// Éléments de la modal
const saveModal = document.getElementById('save-modal');
const closeModal = document.getElementById('close-modal');
const cancelSaveBtn = document.getElementById('cancel-save-btn');
const confirmSaveBtn = document.getElementById('confirm-save-btn');
const routeNameInput = document.getElementById('route-name-input');
const routeFolderSelect = document.getElementById('route-folder-select');
const newFolderInput = document.getElementById('new-folder-input');
const toggleNewFolderBtn = document.getElementById('toggle-new-folder-btn');
const modalTitle = document.getElementById('modal-title');
const editRouteId = document.getElementById('edit-route-id');
const editRouteFolder = document.getElementById('edit-route-folder');

let isCreatingNewFolder = false;
let isEditMode = false;

// Ouvrir la modal de sauvegarde
saveBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('Veuillez entrer une URL');
        return;
    }
    
    // Mode création
    isEditMode = false;
    editRouteId.value = '';
    editRouteFolder.value = '';
    modalTitle.textContent = '💾 Sauvegarder la route';
    confirmSaveBtn.textContent = 'Sauvegarder';
    
    // Charger les dossiers disponibles
    await loadFoldersForSelect();
    
    // Pré-remplir avec les valeurs actuelles
    routeNameInput.value = '';
    routeFolderSelect.value = 'root';
    newFolderInput.style.display = 'none';
    newFolderInput.value = '';
    isCreatingNewFolder = false;
    toggleNewFolderBtn.textContent = '+ Créer un nouveau dossier';
    
    // Afficher la modal
    saveModal.classList.add('show');
    routeNameInput.focus();
});

// Fonction pour fermer et réinitialiser la modal
function closeModalAndReset() {
    saveModal.classList.remove('show');
    isEditMode = false;
    editRouteId.value = '';
    editRouteFolder.value = '';
    modalTitle.textContent = '💾 Sauvegarder la route';
    confirmSaveBtn.textContent = 'Sauvegarder';
}

// Fermer la modal
closeModal.addEventListener('click', closeModalAndReset);

cancelSaveBtn.addEventListener('click', closeModalAndReset);

// Toggle création de nouveau dossier
toggleNewFolderBtn.addEventListener('click', () => {
    isCreatingNewFolder = !isCreatingNewFolder;
    if (isCreatingNewFolder) {
        newFolderInput.style.display = 'block';
        toggleNewFolderBtn.textContent = '✕ Annuler';
        newFolderInput.focus();
    } else {
        newFolderInput.style.display = 'none';
        newFolderInput.value = '';
        toggleNewFolderBtn.textContent = '+ Créer un nouveau dossier';
    }
});

// Charger les dossiers pour le select
async function loadFoldersForSelect() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes/folders`);
        const folders = await response.json();
        
        routeFolderSelect.innerHTML = '<option value="root">📁 Racine</option>';
        folders.forEach(folder => {
            if (folder !== 'root') {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = `📁 ${folder}`;
                routeFolderSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erreur lors du chargement des dossiers:', error);
    }
}

// Confirmer la sauvegarde/modification
confirmSaveBtn.addEventListener('click', async () => {
    const routeName = routeNameInput.value.trim();
    
    if (!routeName) {
        alert('Veuillez entrer un nom pour la route');
        return;
    }
    
    let selectedFolder = routeFolderSelect.value;
    
    // Si création d'un nouveau dossier
    if (isCreatingNewFolder) {
        const newFolderName = newFolderInput.value.trim();
        if (!newFolderName) {
            alert('Veuillez entrer un nom pour le nouveau dossier');
            return;
        }
        
        try {
            const folderResponse = await fetch(`${API_BASE_URL}/api/saved-routes/folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName })
            });
            
            const folderData = await folderResponse.json();
            
            if (!folderResponse.ok) {
                alert(`Erreur: ${folderData.error}`);
                return;
            }
            
            selectedFolder = newFolderName;
        } catch (error) {
            alert(`Erreur lors de la création du dossier: ${error.message}`);
            return;
        }
    }
    
    try {
        let response;
        
        if (isEditMode) {
            // Mode modification
            const method = methodSelect.value;
            const url = urlInput.value.trim();
            const body = bodyTextarea.value.trim();
            
            response = await fetch(`${API_BASE_URL}/api/saved-routes/${editRouteFolder.value}/${editRouteId.value}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: routeName,
                    method: method,
                    url: url,
                    body: body || null,
                    bearerToken: bearerTokenInput.value.trim() || null,
                    basicAuth: basicAuthInput.value.trim() || null,
                    newFolder: selectedFolder
                })
            });
        } else {
            // Mode création
            const method = methodSelect.value;
            const url = urlInput.value.trim();
            const body = bodyTextarea.value.trim();
            
            response = await fetch(`${API_BASE_URL}/api/saved-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: routeName,
                method: method,
                url: url,
                body: body || null,
                bearerToken: bearerTokenInput.value.trim() || null,
                basicAuth: basicAuthInput.value.trim() || null,
                folder: selectedFolder
            })
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            saveModal.classList.remove('show');
            alert(isEditMode ? 'Route modifiée avec succès !' : 'Route sauvegardée avec succès !');
            loadSavedRoutes();
        } else {
            alert(`Erreur: ${data.error}`);
        }
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
});

// Permettre d'appuyer sur Enter dans les champs de la modal
routeNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (isCreatingNewFolder && newFolderInput.value.trim()) {
            newFolderInput.focus();
        } else {
            confirmSaveBtn.click();
        }
    }
});

newFolderInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        confirmSaveBtn.click();
    }
});

// Fermer la modal avec Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && saveModal.classList.contains('show')) {
        closeModalAndReset();
    }
});

// Créer un dossier
createFolderBtn.addEventListener('click', async () => {
    const folderName = folderNameInput.value.trim();
    
    if (!folderName) {
        alert('Veuillez entrer un nom de dossier');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes/folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: folderName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            folderNameInput.value = '';
            alert('Dossier créé avec succès !');
            loadSavedRoutes();
        } else {
            alert(`Erreur: ${data.error}`);
        }
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
});

// Charger les routes sauvegardées
async function loadSavedRoutes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        
        if (folders.length === 0) {
            foldersList.innerHTML = '<div class="empty-state">Aucune route sauvegardée. Créez un dossier et sauvegardez vos routes.</div>';
            return;
        }
        
        foldersList.innerHTML = folders.map(folder => {
            const routesHtml = folder.routes.map(route => `
                <div class="route-card">
                    <div class="route-card-header">
                        <span class="route-name">${route.name}</span>
                        <span class="route-method ${route.method}">${route.method}</span>
                    </div>
                    <div class="route-url">${route.url}</div>
                    <div class="route-actions">
                        <button class="btn-small btn-load" onclick="loadRoute('${folder.name}', '${route.id}')">Charger</button>
                        <button class="btn-small btn-edit" onclick="editRoute('${folder.name}', '${route.id}')">Modifier</button>
                        <button class="btn-small btn-delete" onclick="deleteRoute('${folder.name}', '${route.id}')">Supprimer</button>
                    </div>
                </div>
            `).join('');
            
            const displayName = folder.displayName || `📁 ${folder.name}`;
            const deleteButtonHtml = folder.name !== 'root' 
                ? `<button class="btn-small btn-delete-folder" onclick="deleteFolder('${folder.name}')" title="Supprimer le dossier et toutes ses routes">🗑️ Supprimer dossier</button>`
                : '';
            const swaggerButtonHtml = folder.routes.length > 0
                ? `<button class="btn-small btn-swagger-folder" onclick="openFolderSwagger('${folder.name}')" title="Voir la documentation Swagger complète du dossier">📖 Swagger</button>`
                : '';
            
            return `
                <div class="folder-card">
                    <div class="folder-header">
                        <h3 onclick="toggleFolder('${folder.name}')" style="cursor: pointer; flex: 1;">${displayName} <span class="folder-toggle" id="toggle-${folder.name}">▼</span></h3>
                        <div style="display: flex; gap: 5px;">
                            ${swaggerButtonHtml}
                            ${deleteButtonHtml}
                        </div>
                    </div>
                    <div class="routes-list" id="routes-${folder.name}">
                        ${routesHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        foldersList.innerHTML = `<div class="empty-state">Erreur: ${error.message}</div>`;
    }
}

// Charger une route
window.loadRoute = async function(folder, id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        const folderData = folders.find(f => f.name === folder);
        const route = folderData?.routes.find(r => r.id === id);
        
        if (route) {
            methodSelect.value = route.method;
            urlInput.value = route.url;
            bearerTokenInput.value = route.bearerToken || '';
            basicAuthInput.value = route.basicAuth || '';
            
            if (route.method === 'POST' || route.method === 'PUT') {
                bodyGroup.style.display = 'block';
                if (route.body) {
                    try {
                        // Essayer de formater le JSON si c'est valide
                        bodyTextarea.value = JSON.stringify(JSON.parse(route.body), null, 2);
                    } catch (e) {
                        // Sinon utiliser tel quel
                        bodyTextarea.value = route.body;
                    }
                } else {
                    bodyTextarea.value = '';
                }
            } else {
                bodyGroup.style.display = 'none';
                bodyTextarea.value = '';
            }
        }
    } catch (error) {
        alert(`Erreur lors du chargement: ${error.message}`);
    }
};

// Modifier une route
window.editRoute = async function(folder, id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        
        let route = null;
        for (const f of folders) {
            const foundRoute = f.routes.find(r => r.id === id && r.folder === folder);
            if (foundRoute) {
                route = foundRoute;
                break;
            }
        }
        
        if (!route) {
            alert('Route non trouvée');
            return;
        }
        
        // Mode modification
        isEditMode = true;
        editRouteId.value = id;
        editRouteFolder.value = folder;
        modalTitle.textContent = '✏️ Modifier la route';
        confirmSaveBtn.textContent = 'Modifier';
        
        // Charger les dossiers disponibles
        await loadFoldersForSelect();
        
        // Pré-remplir avec les valeurs de la route
        routeNameInput.value = route.name;
        routeFolderSelect.value = route.folder;
        methodSelect.value = route.method;
        urlInput.value = route.url;
        bearerTokenInput.value = route.bearerToken || '';
        basicAuthInput.value = route.basicAuth || '';
        
        if (route.method === 'POST' || route.method === 'PUT') {
            bodyGroup.style.display = 'block';
            if (route.body) {
                try {
                    bodyTextarea.value = JSON.stringify(JSON.parse(route.body), null, 2);
                } catch (e) {
                    bodyTextarea.value = route.body;
                }
            } else {
                bodyTextarea.value = '';
            }
        } else {
            bodyGroup.style.display = 'none';
            bodyTextarea.value = '';
        }
        
        newFolderInput.style.display = 'none';
        newFolderInput.value = '';
        isCreatingNewFolder = false;
        toggleNewFolderBtn.textContent = '+ Créer un nouveau dossier';
        
        // Afficher la modal
        saveModal.classList.add('show');
        routeNameInput.focus();
    } catch (error) {
        alert(`Erreur lors du chargement: ${error.message}`);
    }
};

// Supprimer une route
window.deleteRoute = async function(folder, id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette route ?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes/${folder}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadSavedRoutes();
        } else {
            const data = await response.json();
            alert(`Erreur: ${data.error}`);
        }
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
};

// Afficher la documentation Swagger d'une route
window.showSwaggerDoc = async function(folder, id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        
        let route = null;
        for (const f of folders) {
            const foundRoute = f.routes.find(r => r.id === id && r.folder === folder);
            if (foundRoute) {
                route = foundRoute;
                break;
            }
        }
        
        if (!route) {
            alert('Route non trouvée');
            return;
        }
        
        // Générer la documentation Swagger/OpenAPI
        const swaggerDoc = generateSwaggerDoc(route);
        
        // Afficher dans la modal
        const swaggerModal = document.getElementById('swagger-modal');
        const swaggerContent = document.getElementById('swagger-content');
        const swaggerFormat = document.getElementById('swagger-format');
        
        // Stocker la route actuelle pour l'export
        window.currentSwaggerRoute = route;
        window.currentSwaggerDoc = swaggerDoc;
        
        // Afficher selon le format sélectionné
        updateSwaggerDisplay();
        
        // Écouter les changements de format
        swaggerFormat.addEventListener('change', updateSwaggerDisplay);
        
        // Afficher la modal
        swaggerModal.classList.add('show');
    } catch (error) {
        alert(`Erreur lors du chargement: ${error.message}`);
    }
};

// Générer la documentation Swagger/OpenAPI
function generateSwaggerDoc(route) {
    // Extraire l'URL de base et le chemin
    let baseUrl = '';
    let path = route.url;
    
    if (route.url.startsWith('http://') || route.url.startsWith('https://')) {
        const urlObj = new URL(route.url);
        baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        path = urlObj.pathname;
    } else {
        baseUrl = 'http://localhost:3000';
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
    }
    
    // Générer le schéma du body si présent
    let requestBody = null;
    let parameters = [];
    
    if (route.body) {
        try {
            const bodyJson = JSON.parse(route.body);
            requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            example: bodyJson,
                            properties: generateSchemaFromObject(bodyJson)
                        }
                    }
                }
            };
        } catch (e) {
            requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'string',
                            example: route.body
                        }
                    }
                }
            };
        }
    }
    
    // Extraire les paramètres de chemin (ex: /api/items/:id)
    const pathParams = path.match(/:\w+/g);
    if (pathParams) {
        pathParams.forEach(param => {
            const paramName = param.substring(1);
            parameters.push({
                name: paramName,
                in: 'path',
                required: true,
                schema: {
                    type: 'string'
                },
                description: `Paramètre ${paramName}`
            });
        });
    }
    
    // Créer le document Swagger/OpenAPI
    const swaggerDoc = {
        openapi: '3.0.0',
        info: {
            title: route.name || 'API Route',
            description: `Documentation Swagger pour la route ${route.method} ${path}`,
            version: '1.0.0'
        },
        servers: [
            {
                url: baseUrl,
                description: 'Serveur API'
            }
        ],
        paths: {
            [path]: {
                [route.method.toLowerCase()]: {
                    summary: route.name || `${route.method} ${path}`,
                    description: `Route ${route.method} pour ${path}`,
                    operationId: `${route.method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    tags: [route.folder !== 'root' ? route.folder : 'API'],
                    parameters: parameters,
                    requestBody: requestBody,
                    responses: {
                        '200': {
                            description: 'Réponse réussie',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object'
                                    }
                                }
                            }
                        },
                        '400': {
                            description: 'Requête invalide'
                        },
                        '404': {
                            description: 'Ressource non trouvée'
                        },
                        '500': {
                            description: 'Erreur serveur'
                        }
                    }
                }
            }
        }
    };
    
    return swaggerDoc;
}

// Générer un schéma JSON à partir d'un objet
function generateSchemaFromObject(obj) {
    const properties = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (value === null) {
            properties[key] = { type: 'null' };
        } else if (typeof value === 'string') {
            properties[key] = { type: 'string', example: value };
        } else if (typeof value === 'number') {
            properties[key] = { type: Number.isInteger(value) ? 'integer' : 'number', example: value };
        } else if (typeof value === 'boolean') {
            properties[key] = { type: 'boolean', example: value };
        } else if (Array.isArray(value)) {
            properties[key] = { type: 'array', items: value.length > 0 ? generateSchemaFromObject(value[0]) : {} };
        } else if (typeof value === 'object') {
            properties[key] = { type: 'object', properties: generateSchemaFromObject(value) };
        }
    }
    
    return properties;
}

// Convertir JSON en YAML (version simplifiée)
function jsonToYaml(obj, indent = 0) {
    const indentStr = '  '.repeat(indent);
    let yaml = '';
    
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
                yaml += `${indentStr}- `;
                yaml += jsonToYaml(item, indent + 1).trim();
            } else {
                yaml += `${indentStr}- ${item}\n`;
            }
        });
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            if (value === null) {
                yaml += `${indentStr}${key}: null\n`;
            } else if (typeof value === 'string') {
                yaml += `${indentStr}${key}: "${value}"\n`;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                yaml += `${indentStr}${key}: ${value}\n`;
            } else if (Array.isArray(value)) {
                yaml += `${indentStr}${key}:\n`;
                yaml += jsonToYaml(value, indent + 1);
            } else if (typeof value === 'object') {
                yaml += `${indentStr}${key}:\n`;
                yaml += jsonToYaml(value, indent + 1);
            }
        }
    }
    
    return yaml;
}

// Mettre à jour l'affichage Swagger
function updateSwaggerDisplay() {
    const swaggerContent = document.getElementById('swagger-content');
    const swaggerFormat = document.getElementById('swagger-format');
    const format = swaggerFormat.value;
    
    if (window.currentSwaggerDoc) {
        if (format === 'json') {
            swaggerContent.textContent = JSON.stringify(window.currentSwaggerDoc, null, 2);
        } else {
            swaggerContent.textContent = jsonToYaml(window.currentSwaggerDoc);
        }
    }
}

// Éléments de la modal Swagger
const swaggerModal = document.getElementById('swagger-modal');
const closeSwaggerModal = document.getElementById('close-swagger-modal');
const closeSwaggerBtn = document.getElementById('close-swagger-btn');
const copySwaggerBtn = document.getElementById('copy-swagger-btn');
const downloadSwaggerBtn = document.getElementById('download-swagger-btn');
const swaggerFormat = document.getElementById('swagger-format');

// Fermer la modal Swagger
closeSwaggerModal.addEventListener('click', () => {
    swaggerModal.classList.remove('show');
});

closeSwaggerBtn.addEventListener('click', () => {
    swaggerModal.classList.remove('show');
});

// Copier la documentation
copySwaggerBtn.addEventListener('click', () => {
    const swaggerContent = document.getElementById('swagger-content');
    navigator.clipboard.writeText(swaggerContent.textContent).then(() => {
        alert('Documentation copiée dans le presse-papiers !');
    }).catch(err => {
        alert(`Erreur lors de la copie: ${err.message}`);
    });
});

// Télécharger la documentation
downloadSwaggerBtn.addEventListener('click', () => {
    const format = swaggerFormat.value;
    const extension = format === 'json' ? 'json' : 'yaml';
    const route = window.currentSwaggerRoute;
    const filename = `${route.name || 'route'}_swagger.${extension}`;
    
    let content = '';
    if (format === 'json') {
        content = JSON.stringify(window.currentSwaggerDoc, null, 2);
    } else {
        content = jsonToYaml(window.currentSwaggerDoc);
    }
    
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Fermer avec Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && swaggerModal.classList.contains('show')) {
        swaggerModal.classList.remove('show');
    }
});

// Ouvrir la documentation Swagger complète d'un dossier
window.openFolderSwagger = async function(folderName) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        
        const folder = folders.find(f => f.name === folderName);
        if (!folder || folder.routes.length === 0) {
            alert('Aucune route dans ce dossier');
            return;
        }
        
        // Générer la documentation Swagger complète pour le dossier
        const swaggerDoc = generateFolderSwaggerDoc(folder);
        
        // Demander à l'utilisateur ce qu'il veut faire
        const action = confirm('Voulez-vous ouvrir la documentation Swagger dans une nouvelle fenêtre ?\n\nCliquez sur OK pour ouvrir, ou Annuler pour télécharger le fichier JSON.');
        
        if (action) {
            // Ouvrir la page Swagger UI via l'API
            const encodedFolderName = encodeURIComponent(folderName);
            window.open(`${API_BASE_URL}/api/swagger-ui/${encodedFolderName}`, '_blank');
        } else {
            // Télécharger le fichier JSON
            const filename = `${folderName !== 'root' ? folderName : 'api'}_swagger.json`;
            const blob = new Blob([JSON.stringify(swaggerDoc, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        alert(`Erreur lors de la génération: ${error.message}`);
    }
};

// Générer la documentation Swagger complète pour un dossier
function generateFolderSwaggerDoc(folder) {
    // Déterminer l'URL de base à partir de la première route
    let baseUrl = 'http://localhost:3000';
    const firstRoute = folder.routes[0];
    
    if (firstRoute.url.startsWith('http://') || firstRoute.url.startsWith('https://')) {
        const urlObj = new URL(firstRoute.url);
        baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
    
    const paths = {};
    
    // Générer la documentation pour chaque route
    folder.routes.forEach(route => {
        let path = route.url;
        
        // Extraire le chemin si c'est une URL complète
        if (route.url.startsWith('http://') || route.url.startsWith('https://')) {
            const urlObj = new URL(route.url);
            path = urlObj.pathname;
        } else {
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
        }
        
        // Normaliser le chemin pour regrouper les routes similaires
        const normalizedPath = path;
        
        if (!paths[normalizedPath]) {
            paths[normalizedPath] = {};
        }
        
        // Générer le schéma du body si présent
        let requestBody = null;
        let parameters = [];
        
        if (route.body) {
            try {
                const bodyJson = JSON.parse(route.body);
                requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                example: bodyJson,
                                properties: generateSchemaFromObject(bodyJson)
                            }
                        }
                    }
                };
            } catch (e) {
                requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'string',
                                example: route.body
                            }
                        }
                    }
                };
            }
        }
        
        // Extraire les paramètres de chemin
        const pathParams = path.match(/:\w+/g);
        if (pathParams) {
            pathParams.forEach(param => {
                const paramName = param.substring(1);
                if (!parameters.find(p => p.name === paramName)) {
                    parameters.push({
                        name: paramName,
                        in: 'path',
                        required: true,
                        schema: {
                            type: 'string'
                        },
                        description: `Paramètre ${paramName}`
                    });
                }
            });
        }
        
        // Ajouter la méthode HTTP
        paths[normalizedPath][route.method.toLowerCase()] = {
            summary: route.name || `${route.method} ${path}`,
            description: `Route ${route.method} pour ${path}`,
            operationId: `${route.method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${route.id}`,
            tags: [folder.name !== 'root' ? folder.name : 'API'],
            parameters: parameters,
            requestBody: requestBody,
            responses: {
                '200': {
                    description: 'Réponse réussie',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object'
                            }
                        }
                    }
                },
                '400': {
                    description: 'Requête invalide'
                },
                '404': {
                    description: 'Ressource non trouvée'
                },
                '500': {
                    description: 'Erreur serveur'
                }
            }
        };
    });
    
    // Créer le document Swagger/OpenAPI complet
    const swaggerDoc = {
        openapi: '3.0.0',
        info: {
            title: folder.name !== 'root' ? `API - ${folder.name}` : 'API Routes',
            description: `Documentation Swagger complète pour le dossier ${folder.name !== 'root' ? folder.name : 'Racine'}`,
            version: '1.0.0'
        },
        servers: [
            {
                url: baseUrl,
                description: 'Serveur API'
            }
        ],
        paths: paths
    };
    
    return swaggerDoc;
}

// Générer le HTML pour Swagger UI
function generateSwaggerUI(swaggerDoc) {
    // Échapper correctement le JSON pour l'inclure dans le HTML
    const swaggerJson = JSON.stringify(swaggerDoc, null, 2)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/'/g, '\\u0027')
        .replace(/"/g, '\\u0022');
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swagger UI - ${swaggerDoc.info.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            display: none;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            try {
                const spec = JSON.parse('${swaggerJson}');
                const ui = SwaggerUIBundle({
                    spec: spec,
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "StandaloneLayout",
                    tryItOutEnabled: true
                });
            } catch (error) {
                document.getElementById('swagger-ui').innerHTML = '<div style="padding: 20px; color: red;"><h2>Erreur lors du chargement</h2><p>' + error.message + '</p></div>';
                console.error('Erreur Swagger UI:', error);
            }
        };
    </script>
</body>
</html>`;
}

// Supprimer un dossier avec toutes ses routes
window.deleteFolder = async function(folderName) {
    if (folderName === 'root') {
        alert('Impossible de supprimer le dossier racine');
        return;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" et toutes ses routes ? Cette action est irréversible.`)) {
        return;
    }
    
    try {
        // Encoder le nom du dossier pour l'URL
        const encodedFolderName = encodeURIComponent(folderName);
        const response = await fetch(`${API_BASE_URL}/api/saved-routes/folder/${encodedFolderName}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Dossier supprimé avec succès !');
            loadSavedRoutes();
        } else {
            alert(`Erreur: ${data.error || 'Erreur inconnue'}`);
        }
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
};

// Toggle folder
window.toggleFolder = function(folderName) {
    const routesDiv = document.getElementById(`routes-${folderName}`);
    const toggle = document.getElementById(`toggle-${folderName}`);
    
    if (routesDiv.style.display === 'none') {
        routesDiv.style.display = 'grid';
        toggle.textContent = '▼';
    } else {
        routesDiv.style.display = 'none';
        toggle.textContent = '▶';
    }
};

// Actualiser les routes sauvegardées
refreshRoutesBtn.addEventListener('click', loadSavedRoutes);

// Permettre de créer un dossier avec Enter
folderNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createFolderBtn.click();
    }
});

// ==================== SYSTÈME D'EXPORT/IMPORT WORKSPACE ====================

// Exporter le workspace (tous les dossiers et routes)
async function exportWorkspace() {
    try {
        // Récupérer toutes les routes
        const response = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const folders = await response.json();
        
        const workspace = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            folders: folders
        };
        
        // Utiliser l'API Electron pour ouvrir le dialogue de sauvegarde
        if (window.electronAPI && window.electronAPI.exportWorkspace) {
            const result = await window.electronAPI.exportWorkspace(workspace);
            
            if (result.canceled) {
                return; // L'utilisateur a annulé
            }
            
            if (result.error) {
                alert(`❌ Erreur lors de l'export : ${result.error}`);
                return;
            }
            
            // Compter le nombre total de routes
            let totalRoutes = 0;
            folders.forEach(folder => {
                totalRoutes += (folder.routes || []).length;
            });
            
            const fileName = result.filePath.split(/[/\\]/).pop();
            alert(`✅ Workspace exporté avec succès !\n\n📁 Fichier : ${fileName}\n📂 Dossiers : ${folders.length}\n🔗 Routes : ${totalRoutes}\n\n💾 Le fichier a été sauvegardé.`);
        } else {
            // Fallback pour le navigateur (téléchargement direct)
            const defaultFileName = `getmyserver-workspace-${new Date().toISOString().split('T')[0]}.json`;
            const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            let totalRoutes = 0;
            folders.forEach(folder => {
                totalRoutes += (folder.routes || []).length;
            });
            
            alert(`✅ Workspace exporté avec succès !\n\n📁 Fichier : ${defaultFileName}\n📂 Dossiers : ${folders.length}\n🔗 Routes : ${totalRoutes}`);
        }
    } catch (error) {
        alert(`❌ Erreur lors de l'export : ${error.message}`);
    }
}

// Importer un workspace
async function importWorkspace() {
    try {
        let workspace;
        
        // Utiliser l'API Electron pour ouvrir le dialogue de sélection
        if (window.electronAPI && window.electronAPI.importWorkspace) {
            const result = await window.electronAPI.importWorkspace();
            
            if (result.canceled) {
                return; // L'utilisateur a annulé
            }
            
            if (result.error) {
                alert(`❌ Erreur lors de l'import : ${result.error}`);
                return;
            }
            
            workspace = result.workspace;
        } else {
            // Fallback pour le navigateur
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            const file = await new Promise((resolve, reject) => {
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) resolve(file);
                    else reject(new Error('Aucun fichier sélectionné'));
                };
                input.oncancel = () => reject(new Error('Import annulé'));
                input.click();
            });
            
            const text = await file.text();
            workspace = JSON.parse(text);
        }
        
        if (!workspace.folders || !Array.isArray(workspace.folders)) {
            alert('❌ Fichier invalide : format de workspace incorrect');
            return;
        }
        
        if (!confirm(`Voulez-vous importer ce workspace ?\n\n${workspace.folders.length} dossier(s) trouvé(s)\n\n⚠️ Attention : Cela remplacera toutes vos routes actuelles.`)) {
            return;
        }
        
        // Vider toutes les routes locales
        const localResponse = await fetch(`${API_BASE_URL}/api/saved-routes`);
        const localFolders = await localResponse.json();
        
        for (const folder of localFolders) {
            for (const route of folder.routes) {
                try {
                    await fetch(`${API_BASE_URL}/api/saved-routes/${folder.name}/${route.id}`, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.error('Erreur suppression route:', e);
                }
            }
            // Supprimer les dossiers (sauf root)
            if (folder.name !== 'root') {
                try {
                    await fetch(`${API_BASE_URL}/api/saved-routes/folder/${encodeURIComponent(folder.name)}`, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.error('Erreur suppression dossier:', e);
                }
            }
        }
        
        // Importer les dossiers et routes
        for (const folder of workspace.folders) {
            // Créer le dossier s'il n'existe pas
            if (folder.name !== 'root') {
                try {
                    await fetch(`${API_BASE_URL}/api/saved-routes/folder`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: folder.name })
                    });
                } catch (e) {
                    // Dossier existe peut-être déjà
                }
            }
            
            // Créer les routes
            for (const route of folder.routes || []) {
                try {
                    await fetch(`${API_BASE_URL}/api/saved-routes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: route.name,
                            method: route.method,
                            url: route.url,
                            body: route.body || null,
                            bearerToken: route.bearerToken || null,
                            basicAuth: route.basicAuth || null,
                            folder: folder.name === 'root' ? 'root' : folder.name
                        })
                    });
                } catch (e) {
                    console.error(`Erreur import route ${route.name}:`, e);
                }
            }
        }
        
        alert('✅ Workspace importé avec succès !');
        loadSavedRoutes();
    } catch (error) {
        alert(`❌ Erreur lors de l'import : ${error.message}`);
    }
}

// Éléments pour export/import
const exportWorkspaceBtn = document.getElementById('export-workspace-btn');
const importWorkspaceBtn = document.getElementById('import-workspace-btn');

// Bouton Export
if (exportWorkspaceBtn) {
    exportWorkspaceBtn.addEventListener('click', exportWorkspace);
}

// Bouton Import
if (importWorkspaceBtn) {
    importWorkspaceBtn.addEventListener('click', importWorkspace);
}

// ==================== SYSTÈME DE MISE À JOUR ====================

const checkUpdatesBtn = document.getElementById('check-updates-btn');
const updateModal = document.getElementById('update-modal');
const closeUpdateModal = document.getElementById('close-update-modal');
const updateStatus = document.getElementById('update-status');
const updateMessage = document.getElementById('update-message');
const updateProgress = document.getElementById('update-progress');
const updateProgressBar = document.getElementById('update-progress-bar');
const updateProgressText = document.getElementById('update-progress-text');
const updateActions = document.getElementById('update-actions');
const downloadUpdateBtn = document.getElementById('download-update-btn');
const installUpdateBtn = document.getElementById('install-update-btn');
const cancelUpdateBtn = document.getElementById('cancel-update-btn');

// Écouter les événements de mise à jour depuis le main process
if (window.electronAPI) {
    // Écouter les événements de mise à jour (sera implémenté via preload si nécessaire)
    // Pour l'instant, on utilise directement les handlers IPC
}

// Ouvrir la modal de mise à jour
if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
        updateModal.classList.add('show');
        updateMessage.textContent = 'Vérification des mises à jour...';
        updateStatus.style.background = '#f0f4ff';
        updateProgress.style.display = 'none';
        updateActions.style.display = 'none';
        
        if (window.electronAPI && window.electronAPI.checkForUpdates) {
            const result = await window.electronAPI.checkForUpdates();
            if (!result.success) {
                updateMessage.textContent = `Erreur : ${result.error}`;
                updateStatus.style.background = '#fee';
            }
        }
    });
}

// Fermer la modal
if (closeUpdateModal) {
    closeUpdateModal.addEventListener('click', () => {
        updateModal.classList.remove('show');
    });
}

if (cancelUpdateBtn) {
    cancelUpdateBtn.addEventListener('click', () => {
        updateModal.classList.remove('show');
    });
}

// Télécharger la mise à jour
if (downloadUpdateBtn) {
    downloadUpdateBtn.addEventListener('click', async () => {
        downloadUpdateBtn.disabled = true;
        updateProgress.style.display = 'block';
        updateMessage.textContent = 'Téléchargement en cours...';
        
        if (window.electronAPI && window.electronAPI.downloadUpdate) {
            const result = await window.electronAPI.downloadUpdate();
            if (!result.success) {
                updateMessage.textContent = `Erreur : ${result.error}`;
                updateStatus.style.background = '#fee';
                downloadUpdateBtn.disabled = false;
            }
        }
    });
}

// Installer la mise à jour
if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.installUpdate) {
            await window.electronAPI.installUpdate();
        }
    });
}

// Écouter les messages de mise à jour depuis le main process
if (window.electronAPI && window.electronAPI.onUpdateStatus) {
    window.electronAPI.onUpdateStatus((data) => {
        updateMessage.textContent = data.message;
        
        if (data.status === 'available') {
            updateStatus.style.background = '#d4edda';
            updateActions.style.display = 'block';
            downloadUpdateBtn.style.display = 'block';
            installUpdateBtn.style.display = 'none';
        } else if (data.status === 'not-available') {
            updateStatus.style.background = '#d1ecf1';
            updateActions.style.display = 'none';
        } else if (data.status === 'downloaded') {
            updateStatus.style.background = '#d4edda';
            updateActions.style.display = 'block';
            downloadUpdateBtn.style.display = 'none';
            installUpdateBtn.style.display = 'block';
            updateProgress.style.display = 'none';
        } else if (data.status === 'error') {
            updateStatus.style.background = '#f8d7da';
            updateActions.style.display = 'none';
        }
    });
    
    window.electronAPI.onUpdateProgress((data) => {
        updateProgressBar.style.width = `${data.percent}%`;
        updateProgressText.textContent = `${data.percent}% (${formatBytes(data.transferred)} / ${formatBytes(data.total)})`;
    });
}

// Fonction pour formater les bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Charger les routes sauvegardées au démarrage
loadSavedRoutes();

