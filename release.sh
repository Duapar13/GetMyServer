#!/bin/bash

# Script de release pour GetMyServer
# Usage: ./release.sh [version] [message]

set -e

# Charger le token depuis .env si disponible
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Vérifier que le token est défini
if [ -z "$GH_TOKEN" ]; then
    echo "❌ Erreur: GH_TOKEN n'est pas défini"
    echo "Créez un fichier .env avec: GH_TOKEN=votre_token"
    exit 1
fi

# Lire la version actuelle
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Version actuelle: $CURRENT_VERSION"

# Demander la nouvelle version si non fournie
if [ -z "$1" ]; then
    echo "Entrez la nouvelle version (ex: 1.0.2) ou appuyez sur Entrée pour incrémenter automatiquement:"
    read NEW_VERSION
    if [ -z "$NEW_VERSION" ]; then
        # Incrémenter automatiquement le patch
        IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
        MAJOR=${VERSION_PARTS[0]}
        MINOR=${VERSION_PARTS[1]}
        PATCH=${VERSION_PARTS[2]}
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    fi
else
    NEW_VERSION=$1
fi

# Message de commit
COMMIT_MSG=${2:-"Release v$NEW_VERSION"}

echo "🚀 Publication de la version $NEW_VERSION"

# Mettre à jour package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit et tag
git add package.json
git commit -m "$COMMIT_MSG" || true
git tag "v$NEW_VERSION" || true

# Push
echo "📤 Push vers GitHub..."
git push origin main || true
git push origin "v$NEW_VERSION" || true

# Build et publier
echo "🔨 Build et publication..."
npm run release

echo "✅ Release $NEW_VERSION publiée avec succès!"
echo "🔗 Vérifiez sur: https://github.com/Duapar13/GetMyServer/releases"

