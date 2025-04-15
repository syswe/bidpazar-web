module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    // Add support for import aliases
    ['module-resolver', {
      root: ['.'],
      alias: {
        '@': './src',
      },
    }],
  ],
}; 