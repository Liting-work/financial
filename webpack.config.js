import path from 'node:path'
import { fileURLToPath } from 'node:url'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { startupBanner } from './server/network.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default (env, argv) => {
  const isProd = argv.mode === 'production'

  return {
    mode: isProd ? 'production' : 'development',
    entry: path.join(__dirname, 'src/index.jsx'),
    output: {
      path: path.join(__dirname, 'dist'),
      filename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|webp|svg|gif)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'public/index.html'),
        favicon: false,
      }),
    ],
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    devServer: {
      // 0.0.0.0 = 允许局域网内的同事用本机 IP 访问；仅本机调试可改回 127.0.0.1
      host: '0.0.0.0',
      port: 5173,
      // 用 IP 访问时 Host 头是 IP，默认校验会报 Invalid Host header
      allowedHosts: 'all',
      hot: true,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, 'public'),
      },
      proxy: [
        {
          context: ['/api', '/docs'],
          target: 'http://127.0.0.1:3001',
        },
      ],
      client: {
        overlay: { errors: true, warnings: false },
      },
      onListening(devServer) {
        const port = devServer?.server?.address()?.port ?? 5173
        console.log(
          startupBanner({
            title: '傲举财务 · 报销看板（开发）',
            port,
            hint: '同事用「同事访问」地址；页面内的 /api 会代理到本机 3001',
          }),
        )
      },
    },
    performance: {
      hints: false,
    },
  }
}
