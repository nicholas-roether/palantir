
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const wd = path.resolve(__dirname, "..");
const src = path.join(wd, "src");

module.exports = {
	mode: "production",
	entry: {
		popup: path.join(src, "popup"),
		content: path.join(src, "content"),
		background: path.join(src, "background"),
		options: path.join(src, "options")
	},
	output: {
		path: path.join(wd, "dist")
	},
	resolve: {
		extensions: [".ts", ".js", ".tsx", ".jsx"]
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: "babel-loader",
				options: {
					babelrc: false,
					presets: [
						"@babel/preset-env",
						"solid",
						"@babel/preset-typescript"
					]
				},
			},
		]
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "./res", to: "." },
				{ from: require.resolve("webextension-polyfill"), to: "."}
			]
		})
	]
}