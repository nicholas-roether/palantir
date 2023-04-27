
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const wd = path.resolve(__dirname, "..");
const src = path.join(wd, "src");

module.exports = (env) => ({
	mode: env.production ? "production" : "development",
	devtool: env.production ? undefined : "source-map",
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
		extensions: [".ts", ".js", ".tsx", ".jsx", ".glsl"]
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
			{
				test: /\.glsl$/,
				type: "asset/source"
			}
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
})