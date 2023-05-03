
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const wd = path.resolve(__dirname, "..");
const src = path.join(wd, "src");


module.exports = (env) => ({
	experiments: {
		asyncWebAssembly: true
	},
	mode: env.production ? "production" : "development",
	devtool: env.production ? undefined : "source-map",
	entry: {
		popup: path.join(src, "popup"),
		window: path.join(src, "window"),
		frames: path.join(src, "frames"),
		background: path.join(src, "background"),
		options: path.join(src, "options")
	},
	output: {
		path: path.join(wd, "dist"),
		clean: true
	},
	resolve: {
		extensions: [".ts", ".js", ".tsx", ".jsx", ".glsl", ".wasm"]
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
			},
			{
				test: /\.wasm$/,
				type: "webassembly/async"
			}
		]
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "./res", to: "." },
				{ from: require.resolve("webextension-polyfill"), to: "."},
			]
		})
	]
})