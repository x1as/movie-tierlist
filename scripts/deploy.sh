#!/usr/bin/env bash
# Сборка и публикация в ветку gh-pages (GitHub Pages).
set -e
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="x1as" -c user.email="x1as@users.noreply.github.com" commit -qm "deploy $(date +%F)"
git push -qf "$REMOTE" gh-pages
rm -rf .git
echo "deployed"
