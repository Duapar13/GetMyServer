# Configuration GitHub pour les Mises à Jour

## 1. Configuration du Token

Créez un fichier `.env` à la racine du projet avec votre token GitHub :

```bash
GH_TOKEN=ghp_votre_token_ici
```

**⚠️ IMPORTANT :** Ne commitez JAMAIS le fichier `.env` ! Il est déjà dans `.gitignore`.

## 2. Première Publication

### Initialiser le repository (si pas déjà fait)

```bash
git init
git remote add origin https://github.com/Duapar13/GetMyServer.git
```

### Premier commit et push

```bash
# Ajouter tous les fichiers
git add .

# Commit initial
git commit -m "Initial commit - GetMyServer v1.0.1"

# Push vers GitHub
git push -u origin main
```

### Créer la première release

```bash
# Créer un tag
git tag v1.0.1

# Push le tag
git push origin v1.0.1

# Build et publier automatiquement
export GH_TOKEN=ghp_votre_token_ici
npm run release
```

## 3. Publications Futures

Pour chaque nouvelle version :

```bash
# 1. Mettre à jour la version dans package.json (ex: 1.0.2)

# 2. Commit et tag
git add package.json
git commit -m "Release v1.0.2"
git tag v1.0.2
git push origin main
git push origin v1.0.2

# 3. Build et publier (le token doit être dans .env ou exporté)
npm run release
```

## 4. Vérification

Après publication, vérifiez sur GitHub :
- https://github.com/Duapar13/GetMyServer/releases

Vous devriez voir la release avec les fichiers `.dmg` et `.zip` uploadés automatiquement.

## 5. Test des Mises à Jour

Pour tester que les mises à jour fonctionnent :

1. Installez la version 1.0.1
2. Publiez une version 1.0.2
3. Lancez l'app 1.0.1
4. Cliquez sur "🔄 Mise à jour"
5. L'app devrait détecter la version 1.0.2

