#!/bin/bash
set -e

echo "Installing dependencies (skipping native module scripts)..."
npm install --ignore-scripts --legacy-peer-deps

# --ignore-scripts above also skips patch-package's normal automatic
# postinstall hook, so it has to run as its own explicit step. It applies
# patches/pdfjs-dist+*.patch (a Metro/RN-bundler incompatibility fix — see
# that file's header comment).
echo "Applying dependency patches..."
npx patch-package

# Same category of Metro incompatibility as the patch-package step above,
# but as a direct fixup script instead of a patch file -- see that file's
# header comment for why (kokoro.web.js is one 2MB+ minified line, so a
# line-granularity diff is unusable as a patch).
echo "Patching kokoro-js for Metro..."
node scripts/patch-kokoro.js

echo "Exporting Expo app for web..."
npx expo export --platform web

echo "Build complete! Output in dist/"
