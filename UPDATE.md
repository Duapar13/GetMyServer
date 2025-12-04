# Guide de Mise à Jour Automatique - GetMyServer

## Configuration

L'application utilise `electron-updater` pour les mises à jour automatiques via GitHub Releases.

## Publier une nouvelle version

### 1. Mettre à jour la version

Éditez `package.json` et incrémentez la version :
```json
{
  "version": "1.0.2"  // Incrémentez ici
}
```

### 2. Créer un tag Git et publier

```bash
# Commit les changements
git add .
git commit -m "Release v1.0.2"

# Créer un tag
git tag v1.0.2

# Push le code et les tags
git push origin main
git push origin v1.0.2
```

### 3. Build et publier sur GitHub

**Option A : Publier automatiquement (recommandé)**

```bash
# macOS uniquement
npm run release

# Toutes les plateformes
npm run release:all
```

Cette commande va :
1. Builder l'application
2. Créer automatiquement une release GitHub
3. Uploader les fichiers de build
4. Publier la release

**Option B : Build manuel puis upload**

```bash
# Build sans publier
npm run build

# Puis créez manuellement une release sur GitHub et uploadez les fichiers depuis dist/
```

### 4. Configuration GitHub Token

Pour publier automatiquement, vous devez configurer un token GitHub :

1. Allez sur https://github.com/settings/tokens
2. Créez un nouveau token avec les permissions :
   - `repo` (accès complet aux repositories)
3. Configurez la variable d'environnement :

```bash
export GH_TOKEN=ghp_votre_token_ici
```

Ou créez un fichier `.env` dans le projet (ne le commitez pas !).

## Utilisation côté utilisateur

### Vérification manuelle

Les utilisateurs peuvent cliquer sur le bouton "🔄 Mise à jour" dans l'interface pour vérifier les mises à jour.

### Vérification automatique

L'application vérifie automatiquement les mises à jour :
- Au démarrage (après 5 secondes)
- En arrière-plan périodiquement

### Processus de mise à jour

1. L'application détecte une nouvelle version
2. L'utilisateur peut télécharger la mise à jour
3. Une fois téléchargée, l'utilisateur peut installer et redémarrer
4. L'application redémarre avec la nouvelle version

## Notes importantes

- Les mises à jour ne fonctionnent que pour les versions compilées (pas en mode développement)
- Le repository GitHub doit être public OU vous devez utiliser un token avec accès au repo privé
- Les releases doivent suivre le format de version (semver)
- Les fichiers de build doivent être uploadés sur GitHub Releases

## Dépannage

### L'application ne détecte pas les mises à jour

1. Vérifiez que la release GitHub existe
2. Vérifiez que les fichiers `.zip` ou `.dmg` sont bien uploadés
3. Vérifiez que le `package.json` a la bonne version
4. Vérifiez les logs dans la console (DevTools)

### Erreur de publication

1. Vérifiez que le token GitHub est correct
2. Vérifiez que vous avez les permissions sur le repository
3. Vérifiez que le repository existe et est accessible

