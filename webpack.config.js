const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin')

const dist = path.resolve(__dirname, 'dist')

module.exports = {
	mode: 'none',
	entry: {
		background: './src/background.js',
		content: './src/content.js',
		sidebar: './src/sidebar.js'
	},
	output: {
		filename: '[name].js',
		path: dist
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: 'vue-loader',
			}
		]
	},
	resolve: {
		alias: {
			'vue$': 'vue/dist/vue.esm.js'
		}
	},
	plugins: [
		CopyWebpackPlugin([
            'manifest.json',
			'src/content.css',
			'src/sidebar.html',
			'src/sidebar.css',
			{from: 'icons', to: 'icons'},
            {from: 'vendor/selectorgadget_combined.*', to: 'vendor', flatten: true},
            {from: 'vendor/fontawesome', to: 'vendor/fontawesome'},
            {from: 'vendor/reset.css', to: 'vendor'}
        ])
	]
}
