# Guide de Build pour GetMyServer

## Installation des dépendances

```bash
npm install
```

## Build pour macOS

Pour créer une application macOS (.dmg et .zip) :

```bash
npm run build
```

Les fichiers seront générés dans le dossier `dist/` :
- `GetMyServer-1.0.0.dmg` - Installateur DMG pour macOS
- `GetMyServer-1.0.0-mac.zip` - Archive ZIP pour distribution

## Build pour toutes les plateformes

```bash
npm run build:all
```

## Structure après build

L'application packagée :
- Les données utilisateur (routes sauvegardées, data.json) seront stockées dans `~/Library/Application Support/GetMyServer/`
- L'application elle-même sera dans le bundle .app

## Notes importantes

1. **Premier build** : Le premier build peut prendre plusieurs minutes car electron-builder télécharge les dépendances nécessaires.

2. **Icône** : Pour ajouter une icône personnalisée :
   - Créez une image PNG 1024x1024 pixels
   - Convertissez-la en .icns (utilisez `iconutil` sur macOS ou un outil en ligne)
   - Placez le fichier `icon.icns` dans le dossier `build/`

3. **Code signing** : Pour distribuer l'application, vous devrez signer le code avec un certificat Apple Developer (optionnel pour usage personnel).

4. **Notarisation** : Pour macOS Catalina et plus récent, vous devrez notariser l'application si vous la distribuez (non nécessaire pour usage personnel).

## Installation sur votre Mac

1. Double-cliquez sur le fichier `.dmg`
2. Glissez l'application GetMyServer dans le dossier Applications
3. Lancez l'application depuis Applications

## Dépannage

Si le build échoue :
- Vérifiez que vous avez Node.js et npm installés
- Vérifiez que toutes les dépendances sont installées (`npm install`)
- Sur macOS, vous pourriez avoir besoin d'accepter les certificats de sécurité

