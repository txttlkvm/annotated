// No babel.config.js existed before this — Expo injects babel-preset-expo
// implicitly when the file is absent. Made explicit here because pdfjs-dist
// (even its `legacy` build) uses modern class syntax — static class blocks
// and thousands of private fields/methods — that babel-preset-expo's default
// plugin set does not parse, which broke the Vercel build with:
//
//   SyntaxError: node_modules/pdfjs-dist/build/pdf.mjs: Static class blocks
//   are not enabled. Please add `@babel/plugin-transform-class-static-block`.
//
// Verified locally with @babel/core against the exact failing file: fails
// without these four plugins, transforms cleanly with them.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-class-static-block',
      '@babel/plugin-transform-private-methods',
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-private-property-in-object',
    ],
  };
};
