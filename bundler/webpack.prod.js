const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = merge(
    commonConfiguration,
    {
        mode: 'production',
        // Stable, shared React code is fetched once for the room and its iframe.
        optimization: {
            runtimeChunk: { name: entrypoint => `runtime-${entrypoint.name}` },
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    default: false,
                    defaultVendors: false,
                    react: {
                        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|object-assign)[\\/]/,
                        name: 'react-vendor',
                        enforce: true,
                    },
                },
            },
        },
        // Don't publish source maps with the production build
        devtool: false,
        plugins:
        [
            new CleanWebpackPlugin()
        ]
    }
)
