#!/bin/bash
set -e

echo "Installing dependencies (skipping native module scripts)..."
npm install --ignore-scripts --legacy-peer-deps

echo "Exporting Expo app for web..."
npx expo export --platform web

echo "Build complete! Output in dist/"
