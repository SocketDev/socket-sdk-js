'use strict'

module.exports = {
  presets: ['@babel/preset-typescript'],
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: false,
        corejs: false,
        helpers: true,
        regenerator: false,
        version: '^7.27.1',
      },
    ],
  ],
}
