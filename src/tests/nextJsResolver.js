/**
 * Custom resolver for Jest to handle Next.js modules
 */
module.exports = (path, options) => {
  // Call the default resolver
  return options.defaultResolver(path, {
    ...options,
    // Add support for Next.js module resolution
    packageFilter: pkg => {
      // Replace 'module' with 'main' for Next.js packages
      if (pkg.name === 'next' || pkg.name.startsWith('@next/')) {
        delete pkg.exports;
        delete pkg.module;
        delete pkg.browser;
      }
      return pkg;
    },
  });
}; 