# GetMyServer - Testeur de Routes HTTP

Application Electron pour tester des routes HTTP (GET, POST, PUT, DELETE) avec une interface moderne et un stockage JSON.

## Installation

1. Installer les dépendances :
```bash
npm install
```

## Utilisation

1. Démarrer l'application :
```bash
npm start
```

2. Pour le mode développement (avec DevTools) :
```bash
npm run dev
```

## Fonctionnalités

- **GET** : Récupérer tous les items (`/api/items`) ou un item spécifique (`/api/items/:id`)
- **POST** : Créer un nouvel item (`/api/items`)
- **PUT** : Mettre à jour un item existant (`/api/items/:id`)
- **DELETE** : Supprimer un item (`/api/items/:id`)

## Exemples de requêtes

### POST - Créer un item
```json
{
  "name": "Mon premier item",
  "description": "Une description",
  "email": "test@example.com"
}
```

### PUT - Mettre à jour un item
URL: `/api/items/1`
```json
{
  "name": "Item modifié",
  "description": "Nouvelle description"
}
```

Les données sont stockées dans le fichier `data.json` à la racine du projet.

