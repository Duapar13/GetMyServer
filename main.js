const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

let mainWindow;
let server;

// Créer le serveur Express
const expressApp = express();
expressApp.use(cors());
expressApp.use(bodyParser.json());

// Gérer les chemins pour le développement et la production
const isDev = !app.isPackaged;
const userDataPath = app.getPath('userData');

const DATA_FILE = isDev 
  ? path.join(__dirname, 'data.json')
  : path.join(userDataPath, 'data.json');

const ROUTES_DIR = isDev
  ? path.join(__dirname, 'saved_routes')
  : path.join(userDataPath, 'saved_routes');

// Initialiser le fichier JSON s'il n'existe pas
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }, null, 2));
}

// Créer le dossier pour les routes sauvegardées s'il n'existe pas
if (!fs.existsSync(ROUTES_DIR)) {
  fs.mkdirSync(ROUTES_DIR, { recursive: true });
}

// Lire les données depuis le fichier JSON
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { items: [] };
  }
}

// Écrire les données dans le fichier JSON
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes API
expressApp.get('/api/items', (req, res) => {
  const data = readData();
  res.json(data.items);
});

expressApp.get('/api/items/:id', (req, res) => {
  const data = readData();
  const item = data.items.find(i => i.id === parseInt(req.params.id));
  if (item) {
    res.json(item);
  } else {
    res.status(404).json({ error: 'Item non trouvé' });
  }
});

expressApp.post('/api/items', (req, res) => {
  const data = readData();
  const newItem = {
    id: data.items.length > 0 ? Math.max(...data.items.map(i => i.id)) + 1 : 1,
    ...req.body,
    createdAt: new Date().toISOString()
  };
  data.items.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

expressApp.put('/api/items/:id', (req, res) => {
  const data = readData();
  const index = data.items.findIndex(i => i.id === parseInt(req.params.id));
  if (index !== -1) {
    data.items[index] = {
      ...data.items[index],
      ...req.body,
      id: parseInt(req.params.id),
      updatedAt: new Date().toISOString()
    };
    writeData(data);
    res.json(data.items[index]);
  } else {
    res.status(404).json({ error: 'Item non trouvé' });
  }
});

expressApp.delete('/api/items/:id', (req, res) => {
  const data = readData();
  const index = data.items.findIndex(i => i.id === parseInt(req.params.id));
  if (index !== -1) {
    const deletedItem = data.items.splice(index, 1)[0];
    writeData(data);
    res.json({ message: 'Item supprimé', item: deletedItem });
  } else {
    res.status(404).json({ error: 'Item non trouvé' });
  }
});

// Routes pour gérer les routes sauvegardées
expressApp.get('/api/saved-routes', (req, res) => {
  try {
    const folders = [];
    
    // Routes à la racine
    const rootFiles = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR) : [];
    const rootRoutes = rootFiles
      .filter(f => f.endsWith('.json'))
      .map(file => {
        const filePath = path.join(ROUTES_DIR, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              id: file.replace('.json', ''),
              name: content.name || file.replace('.json', ''),
              method: content.method,
              url: content.url,
              body: content.body || null,
              bearerToken: content.bearerToken || null,
              basicAuth: content.basicAuth || null,
              folder: 'root'
            };
      });
    
    if (rootRoutes.length > 0) {
      folders.push({
        name: 'root',
        displayName: '📁 Racine',
        routes: rootRoutes
      });
    }
    
    // Routes dans les dossiers
    const dirs = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR, { withFileTypes: true }) : [];
    
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const folderPath = path.join(ROUTES_DIR, dir.name);
        const files = fs.readdirSync(folderPath);
        const routes = files
          .filter(f => f.endsWith('.json'))
          .map(file => {
            const filePath = path.join(folderPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              id: file.replace('.json', ''),
              name: content.name || file.replace('.json', ''),
              method: content.method,
              url: content.url,
              body: content.body || null,
              bearerToken: content.bearerToken || null,
              basicAuth: content.basicAuth || null,
              folder: dir.name
            };
          });
        
        folders.push({
          name: dir.name,
          displayName: `📁 ${dir.name}`,
          routes: routes
        });
      }
    }
    
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

expressApp.get('/api/saved-routes/folders', (req, res) => {
  try {
    const folders = ['root'];
    if (fs.existsSync(ROUTES_DIR)) {
      const dirs = fs.readdirSync(ROUTES_DIR, { withFileTypes: true });
      const dirNames = dirs
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name);
      folders.push(...dirNames);
    }
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

expressApp.post('/api/saved-routes/folder', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Le nom du dossier est requis' });
    }
    
    const folderPath = path.join(ROUTES_DIR, name.trim());
    if (fs.existsSync(folderPath)) {
      return res.status(400).json({ error: 'Ce dossier existe déjà' });
    }
    
    fs.mkdirSync(folderPath, { recursive: true });
    res.status(201).json({ message: 'Dossier créé', name: name.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

expressApp.post('/api/saved-routes', (req, res) => {
  try {
    const { name, method, url, body, folder } = req.body;
    
    if (!name || !method || !url || folder === undefined) {
      return res.status(400).json({ error: 'Les champs name, method, url et folder sont requis' });
    }
    
    let folderPath;
    if (folder === 'root' || folder === '') {
      // Sauvegarder à la racine
      folderPath = ROUTES_DIR;
    } else {
      // Sauvegarder dans un dossier
      folderPath = path.join(ROUTES_DIR, folder);
      if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: 'Dossier non trouvé' });
      }
    }
    
    const routeId = Date.now().toString();
    const routeFile = path.join(folderPath, `${routeId}.json`);
    const routeData = {
      id: routeId,
      name: name.trim(),
      method: method,
      url: url,
      body: body || null,
      bearerToken: req.body.bearerToken || null,
      basicAuth: req.body.basicAuth || null,
      folder: folder === 'root' || folder === '' ? 'root' : folder,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(routeFile, JSON.stringify(routeData, null, 2));
    res.status(201).json(routeData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

expressApp.put('/api/saved-routes/:folder/:id', (req, res) => {
  try {
    const { folder, id } = req.params;
    const { name, method, url, body, newFolder } = req.body;
    
    let oldRouteFile;
    if (folder === 'root') {
      oldRouteFile = path.join(ROUTES_DIR, `${id}.json`);
    } else {
      oldRouteFile = path.join(ROUTES_DIR, folder, `${id}.json`);
    }
    
    if (!fs.existsSync(oldRouteFile)) {
      return res.status(404).json({ error: 'Route non trouvée' });
    }
    
    // Lire les données existantes
    const oldData = JSON.parse(fs.readFileSync(oldRouteFile, 'utf8'));
    
    // Déterminer le nouveau dossier (ou garder l'ancien)
    const targetFolder = newFolder !== undefined ? (newFolder === 'root' || newFolder === '' ? 'root' : newFolder) : folder;
    
    // Si le dossier change, déplacer le fichier
    if (targetFolder !== folder) {
      let newFolderPath;
      if (targetFolder === 'root') {
        newFolderPath = ROUTES_DIR;
      } else {
        newFolderPath = path.join(ROUTES_DIR, targetFolder);
        if (!fs.existsSync(newFolderPath)) {
          return res.status(404).json({ error: 'Nouveau dossier non trouvé' });
        }
      }
      
      const newRouteFile = path.join(newFolderPath, `${id}.json`);
      
      // Mettre à jour les données
      const updatedData = {
        ...oldData,
        name: name !== undefined ? name.trim() : oldData.name,
        method: method !== undefined ? method : oldData.method,
        url: url !== undefined ? url : oldData.url,
        body: body !== undefined ? body : oldData.body,
        bearerToken: req.body.bearerToken !== undefined ? req.body.bearerToken : oldData.bearerToken,
        basicAuth: req.body.basicAuth !== undefined ? req.body.basicAuth : oldData.basicAuth,
        folder: targetFolder,
        updatedAt: new Date().toISOString()
      };
      
      // Écrire dans le nouveau fichier
      fs.writeFileSync(newRouteFile, JSON.stringify(updatedData, null, 2));
      
      // Supprimer l'ancien fichier
      fs.unlinkSync(oldRouteFile);
      
      res.json(updatedData);
    } else {
      // Même dossier, juste mettre à jour
      const updatedData = {
        ...oldData,
        name: name !== undefined ? name.trim() : oldData.name,
        method: method !== undefined ? method : oldData.method,
        url: url !== undefined ? url : oldData.url,
        body: body !== undefined ? body : oldData.body,
        bearerToken: req.body.bearerToken !== undefined ? req.body.bearerToken : oldData.bearerToken,
        basicAuth: req.body.basicAuth !== undefined ? req.body.basicAuth : oldData.basicAuth,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(oldRouteFile, JSON.stringify(updatedData, null, 2));
      res.json(updatedData);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMPORTANT: Cette route doit être définie AVANT /api/saved-routes/:folder/:id
// pour éviter que "folder" soit interprété comme le paramètre :folder
expressApp.delete('/api/saved-routes/folder/:folderName', (req, res) => {
  try {
    // Décoder le nom du dossier (au cas où il contient des caractères spéciaux)
    let folderName = decodeURIComponent(req.params.folderName);
    
    if (folderName === 'root') {
      return res.status(400).json({ error: 'Impossible de supprimer le dossier racine' });
    }
    
    const folderPath = path.join(ROUTES_DIR, folderName);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }
    
    // Vérifier que c'est bien un dossier
    if (!fs.statSync(folderPath).isDirectory()) {
      return res.status(400).json({ error: 'Ce n\'est pas un dossier' });
    }
    
    // Supprimer récursivement le dossier et tout son contenu
    fs.rmSync(folderPath, { recursive: true, force: true });
    
    res.json({ message: 'Dossier supprimé avec toutes ses routes' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

expressApp.delete('/api/saved-routes/:folder/:id', (req, res) => {
  try {
    const { folder, id } = req.params;
    
    // Vérifier que ce n'est pas une tentative d'accès à la route de suppression de dossier
    if (folder === 'folder') {
      return res.status(404).json({ error: 'Route non trouvée' });
    }
    
    let routeFile;
    if (folder === 'root') {
      routeFile = path.join(ROUTES_DIR, `${id}.json`);
    } else {
      routeFile = path.join(ROUTES_DIR, folder, `${id}.json`);
    }
    
    if (!fs.existsSync(routeFile)) {
      return res.status(404).json({ error: 'Route non trouvée' });
    }
    
    fs.unlinkSync(routeFile);
    res.json({ message: 'Route supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route pour servir la documentation Swagger d'un dossier
expressApp.get('/api/swagger-ui/:folderName', (req, res) => {
  try {
    const { folderName } = req.params;
    const decodedFolderName = decodeURIComponent(folderName);
    
    const folders = [];
    
    // Routes à la racine
    const rootFiles = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR) : [];
    const rootRoutes = rootFiles
      .filter(f => f.endsWith('.json'))
      .map(file => {
        const filePath = path.join(ROUTES_DIR, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: file.replace('.json', ''),
          name: content.name || file.replace('.json', ''),
          method: content.method,
          url: content.url,
          body: content.body || null,
          bearerToken: content.bearerToken || null,
          folder: 'root'
        };
      });
    
    if (rootRoutes.length > 0) {
      folders.push({
        name: 'root',
        displayName: '📁 Racine',
        routes: rootRoutes
      });
    }
    
    // Routes dans les dossiers
    const dirs = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR, { withFileTypes: true }) : [];
    
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const folderPath = path.join(ROUTES_DIR, dir.name);
        const files = fs.readdirSync(folderPath);
        const routes = files
          .filter(f => f.endsWith('.json'))
          .map(file => {
            const filePath = path.join(folderPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              id: file.replace('.json', ''),
              name: content.name || file.replace('.json', ''),
              method: content.method,
              url: content.url,
              body: content.body || null,
              bearerToken: content.bearerToken || null,
              basicAuth: content.basicAuth || null,
              folder: dir.name
            };
          });
        
        folders.push({
          name: dir.name,
          displayName: `📁 ${dir.name}`,
          routes: routes
        });
      }
    }
    
    const folder = folders.find(f => f.name === decodedFolderName);
    if (!folder || folder.routes.length === 0) {
      return res.status(404).send('<html><body><h1>Dossier non trouvé ou vide</h1></body></html>');
    }
    
    // Générer le JSON Swagger (on va le faire côté client avec une route API séparée)
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swagger UI - ${folder.name !== 'root' ? folder.name : 'API'}</title>
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
            fetch('/api/swagger-spec/${encodeURIComponent(decodedFolderName)}')
                .then(response => response.json())
                .then(spec => {
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
                })
                .catch(error => {
                    document.getElementById('swagger-ui').innerHTML = '<div style="padding: 20px; color: red;"><h2>Erreur lors du chargement</h2><p>' + error.message + '</p></div>';
                    console.error('Erreur Swagger UI:', error);
                });
        };
    </script>
</body>
</html>`);
  } catch (error) {
    res.status(500).send(`<html><body><h1>Erreur</h1><p>${error.message}</p></body></html>`);
  }
});

// Route pour obtenir le JSON Swagger d'un dossier
expressApp.get('/api/swagger-spec/:folderName', (req, res) => {
  try {
    const { folderName } = req.params;
    const decodedFolderName = decodeURIComponent(folderName);
    
    // Code similaire pour obtenir le dossier et générer le JSON Swagger
    // Pour simplifier, on va utiliser une fonction helper
    const swaggerDoc = generateSwaggerDocForFolder(decodedFolderName);
    res.json(swaggerDoc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fonction helper pour générer le Swagger doc
function generateSwaggerDocForFolder(folderName) {
  const folders = [];
  
  // Routes à la racine
  const rootFiles = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR) : [];
  const rootRoutes = rootFiles
    .filter(f => f.endsWith('.json'))
    .map(file => {
      const filePath = path.join(ROUTES_DIR, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        id: file.replace('.json', ''),
        name: content.name || file.replace('.json', ''),
        method: content.method,
        url: content.url,
        body: content.body || null,
        bearerToken: content.bearerToken || null,
        basicAuth: content.basicAuth || null,
        folder: 'root'
      };
    });
  
  if (rootRoutes.length > 0) {
    folders.push({
      name: 'root',
      routes: rootRoutes
    });
  }
  
  // Routes dans les dossiers
  const dirs = fs.existsSync(ROUTES_DIR) ? fs.readdirSync(ROUTES_DIR, { withFileTypes: true }) : [];
  
  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const folderPath = path.join(ROUTES_DIR, dir.name);
      const files = fs.readdirSync(folderPath);
      const routes = files
        .filter(f => f.endsWith('.json'))
        .map(file => {
          const filePath = path.join(folderPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            id: file.replace('.json', ''),
            name: content.name || file.replace('.json', ''),
            method: content.method,
            url: content.url,
            body: content.body || null,
        bearerToken: content.bearerToken || null,
        basicAuth: content.basicAuth || null,
        folder: dir.name
          };
        });
      
      folders.push({
        name: dir.name,
        routes: routes
      });
    }
  }
  
  const folder = folders.find(f => f.name === folderName);
  if (!folder || folder.routes.length === 0) {
    throw new Error('Dossier non trouvé ou vide');
  }
  
  // Déterminer l'URL de base
  let baseUrl = 'http://localhost:3000';
  const firstRoute = folder.routes[0];
  
  if (firstRoute.url.startsWith('http://') || firstRoute.url.startsWith('https://')) {
    const urlObj = new URL(firstRoute.url);
    baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  }
  
  const paths = {};
  
  // Générer la documentation pour chaque route
  folder.routes.forEach(route => {
    let pathStr = route.url;
    
    if (route.url.startsWith('http://') || route.url.startsWith('https://')) {
      const urlObj = new URL(route.url);
      pathStr = urlObj.pathname;
    } else {
      if (!pathStr.startsWith('/')) {
        pathStr = '/' + pathStr;
      }
    }
    
    if (!paths[pathStr]) {
      paths[pathStr] = {};
    }
    
    // Générer le schéma du body
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
    const pathParams = pathStr.match(/:\w+/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const paramName = param.substring(1);
        if (!parameters.find(p => p.name === paramName)) {
          parameters.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: `Paramètre ${paramName}`
          });
        }
      });
    }
    
    paths[pathStr][route.method.toLowerCase()] = {
      summary: route.name || `${route.method} ${pathStr}`,
      description: `Route ${route.method} pour ${pathStr}`,
      operationId: `${route.method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}_${route.id}`,
      tags: [folder.name !== 'root' ? folder.name : 'API'],
      parameters: parameters,
      requestBody: requestBody,
      responses: {
        '200': {
          description: 'Réponse réussie',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        },
        '400': { description: 'Requête invalide' },
        '404': { description: 'Ressource non trouvée' },
        '500': { description: 'Erreur serveur' }
      }
    };
  });
  
  return {
    openapi: '3.0.0',
    info: {
      title: folder.name !== 'root' ? `API - ${folder.name}` : 'API Routes',
      description: `Documentation Swagger complète pour le dossier ${folder.name !== 'root' ? folder.name : 'Racine'}`,
      version: '1.0.0'
    },
    servers: [{
      url: baseUrl,
      description: 'Serveur API'
    }],
    paths: paths
  };
}

// Fonction helper pour générer un schéma JSON à partir d'un objet
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
      properties[key] = { 
        type: 'array', 
        items: value.length > 0 ? generateSchemaFromObject(value[0]) : {} 
      };
    } else if (typeof value === 'object') {
      properties[key] = { 
        type: 'object', 
        properties: generateSchemaFromObject(value) 
      };
    }
  }
  
  return properties;
}

// Gestion des routes non trouvées - toujours renvoyer du JSON
expressApp.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée', path: req.path });
});

// Démarrer le serveur Express
const PORT = 3000;
server = expressApp.listen(PORT, () => {
  console.log(`Serveur Express démarré sur le port ${PORT}`);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Ouvrir les DevTools en développement
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Handlers IPC pour export/import workspace (doivent être définis avant app.whenReady)
ipcMain.handle('export-workspace', async (event, data) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exporter le workspace',
      defaultPath: `getmyserver-workspace-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { canceled: false, filePath };
  } catch (error) {
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle('import-workspace', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importer un workspace',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    const workspace = JSON.parse(content);
    
    return { canceled: false, workspace };
  } catch (error) {
    return { canceled: true, error: error.message };
  }
});

// Configuration de l'auto-updater
autoUpdater.setAutoDownload(false);
autoUpdater.setAutoInstallOnAppQuit(true);

// Gérer les événements de mise à jour
autoUpdater.on('checking-for-update', () => {
  console.log('Vérification des mises à jour...');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'checking', message: 'Vérification des mises à jour...' });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Mise à jour disponible:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'available', 
      message: `Mise à jour disponible : v${info.version}`,
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Aucune mise à jour disponible');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'not-available', 
      message: 'Vous utilisez la dernière version' 
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('Erreur lors de la vérification des mises à jour:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'error', 
      message: `Erreur : ${err.message}` 
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', {
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Mise à jour téléchargée:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'downloaded', 
      message: 'Mise à jour téléchargée. L\'application va redémarrer...',
      version: info.version
    });
    
    // Proposer de redémarrer maintenant ou plus tard
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Mise à jour prête',
      message: 'La mise à jour a été téléchargée.',
      detail: 'L\'application va redémarrer pour appliquer la mise à jour.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }
});

// Handler IPC pour vérifier les mises à jour
ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler IPC pour télécharger la mise à jour
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler IPC pour installer la mise à jour
ipcMain.handle('install-update', async () => {
  try {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  
  // Vérifier les mises à jour au démarrage (après 5 secondes)
  setTimeout(() => {
    if (!app.isPackaged) {
      console.log('Mode développement : pas de vérification des mises à jour');
    } else {
      autoUpdater.checkForUpdates();
    }
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

