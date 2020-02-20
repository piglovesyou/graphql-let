module.exports = {
  context: __dirname,
  entry: './src/main',
  output: {
    filename: 'main.js',
    libraryTarget: 'commonjs'
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.graphql$/,
        exclude: /node_modules/,
        rules: [
          {loader: 'raw-loader'},
          {loader: '../../../loader.js'}
        ]
      },
      {
        test: /\.graphqls$/,
        exclude: /node_modules/,
        rules: [
          {loader: 'raw-loader'},
          {loader: '../../../schema/loader.js'}
        ]
      }
    ]
  },
  stats: { colors: false },
  devtool: 'eval',
  devServer:  {
    writeToDisk: true,
    port: 3000,
    hot: true,
  }
};
