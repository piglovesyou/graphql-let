import path from 'path';
import webpack from 'webpack';
import memoryfs from 'memory-fs';
import nodeExternals from 'webpack-node-externals';

const babelLoader = {
  loader: 'babel-loader',
  options: {
    babelrc: false,
    configFile: false,
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
  },
};

export default function compile(
  cwd: string,
  fixture: string,
  target: 'node' | 'web',
): Promise<webpack.Stats> {
  const compiler = webpack({
    mode: 'production',
    context: cwd,
    entry: `./${fixture}`,
    output: {
      path: path.resolve(cwd),
      filename: 'bundle.js',
    },
    target,
    externals: [nodeExternals()],
    module: {
      rules: [
        {
          test: /\.graphql$/,
          use: [
            babelLoader,
            {
              loader: path.resolve(__dirname, '../../src/loader.ts'),
            },
          ],
        },
        {
          test: /\.tsx$/,
          use: [
            babelLoader,
            {
              loader: path.resolve(__dirname, '../../src/literalLoader.ts'),
            },
          ],
        },
      ],
    },
  });

  compiler.outputFileSystem = new memoryfs();

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err);
      if (stats.hasErrors())
        reject(new Error(stats.toJson().errors.join('\n')));

      resolve(stats);
    });
  });
}
