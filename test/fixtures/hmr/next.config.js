module.exports = {
  webpack(config, options) {
    config.module.rules.push({
      test: /\.graphql$/,
      exclude: /node_modules/,
      rules: [options.defaultLoaders.babel, { loader: '../../../loader.js' }],
    })

    config.module.rules.push({
      test: /\.graphqls$/,
      exclude: /node_modules/,
      rules: [
        {loader: 'graphql-tag/loader'},
        {loader: '../../../schema/loader.js'},
      ],
    })

    return config
  },
}
