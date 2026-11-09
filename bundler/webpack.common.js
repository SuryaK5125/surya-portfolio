const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCSSExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {
    entry: {
        main: path.resolve(__dirname, '../src/script.ts'),
        desktop: path.resolve(__dirname, '../src/desktop/index.tsx'),
        about: path.resolve(__dirname, '../src/about/index.tsx'),
    },
    output: {
        hashFunction: 'xxhash64',
        filename: '[name].[contenthash].js',
        path: path.resolve(__dirname, '../public'),
    },
    devtool: 'source-map',
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, '../static'),
                    globOptions: {
                        // Files kept in the repo but never requested at
                        // runtime. Files that are
                        // imported or referenced from HTML are emitted with
                        // hashed names by their loaders, so their raw copies
                        // are skipped too.
                        ignore: [
                            '**/.gitkeep',
                            // Emitted (hashed) by html-loader from index.html
                            '**/textures/monitor/video/**',
                            '**/images/**',
                            // Emitted (hashed) by the UI's SVG imports
                            '**/textures/UI/**',
                            // Unused
                            '**/textures/monitor/layers/png/**',
                            '**/textures/monitor/layers/compressed/reflection-compressed.png',
                            '**/textures/monitor/cursors/**',
                            '**/textures/environmentMap/**',
                            // No recorded audio: all effects are opt-in Web Audio synthesis.
                            '**/audio/**',
                            // Original project's models and screen layers,
                            // no longer used by the scene (see ASSETS.md)
                            '**/models/Computer/**',
                            '**/models/Decor/**',
                            // Removed from the desk; keep the source asset archived only.
                            '**/models/Props/cherry-tree.glb',
                            '**/models/Props/headphones.glb',
                            '**/models/Props/mouse.glb',
                            '**/models/Props/chair.glb',
                            '**/models/Laptop/laptop.glb',
                            '**/models/Porsche/porsche.glb',
                            '**/models/Speaker/speaker.glb',
                            '**/models/Props/cartier.glb',
                            '**/models/Props/tom-ford.glb',
                            // Original (uncleaned) baked texture; the scene uses
                            // baked_environment_desk.jpg
                            '**/models/World/baked_environment.jpg',
                            '**/textures/monitor/**',
                            // No DRACOLoader yet; re-include when compressed
                            // models land (M5)
                            '**/draco/**',
                        ],
                    },
                },
            ],
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../src/index.html'),
            chunks: ['main'],
            minify: true,
        }),
        // Same-origin desktop OS shown on the in-scene screen (and usable standalone)
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../src/desktop/index.html'),
            filename: 'desktop/index.html',
            chunks: ['desktop'],
            minify: true,
        }),
        // Standalone About page, also shown in the desktop's browser app
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../src/about/index.html'),
            filename: 'about/index.html',
            chunks: ['about'],
            minify: true,
        }),
        new MiniCSSExtractPlugin(),
    ],
    resolve: {
        alias: {
            three: path.resolve('./node_modules/three'),
        },
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            // HTML
            {
                test: /\.(html)$/,
                use: ['html-loader'],
            },
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            // JS
            {
                test: /\.tsx$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },

            // CSS
            {
                test: /\.css$/,
                use: [MiniCSSExtractPlugin.loader, 'css-loader'],
            },

            // Images
            {
                test: /\.(jpg|png|gif|svg)$/,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/images/[hash][ext]',
                },
            },
            // Fonts
            {
                test: /\.(ttf|eot|woff|woff2)$/,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[hash][ext]',
                },
            },
            // Shaders
            {
                test: /\.(glsl|vs|fs|vert|frag)$/,
                exclude: /node_modules/,
                use: ['glslify-import-loader', 'raw-loader', 'glslify-loader'],
            },
        ],
    },
};
