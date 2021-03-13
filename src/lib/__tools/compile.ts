import memoryfs from 'memory-fs';
import path from 'path';
import webpack from 'webpack';
import nodeExternals from 'webpack-node-externals';
import type { GraphQLLetLoaderOptions } from '../../loader';

export default function compile(
  cwd: string,
  entries: string[],
  target: 'node' | 'web',
  gqlLetLoaderOptions: GraphQLLetLoaderOptions | undefined = undefined,
): Promise<webpack.Stats> {
  const compiler = webpack({
    mode: 'production',
    context: cwd,
    entry: entries.map((e) => `./${e}`),
    output: {
      path: path.resolve(cwd),
      filename: 'bundle.js',
    },
    target,
    externals: [nodeExternals()],
    module: {
      rules: [
        {
          test: /\.(graphql|tsx)$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                configFile: false,
                presets: ['@babel/preset-react', '@babel/preset-typescript'],
              },
            },
            {
              loader: path.resolve(__dirname, '../../loader.ts'),
              options: gqlLetLoaderOptions,
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
