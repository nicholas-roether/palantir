const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const unpluginIcons = require("unplugin-icons/webpack");

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
		join: path.join(src, "join"),
		content: path.join(src, "content"),
		background: path.join(src, "background"),
		options: path.join(src, "options")
	},
	output: {
		path: path.join(wd, "dist"),
		clean: true
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
						"@babel/preset-typescript",
						"solid"
					],
					plugins: [
						"@emotion"
					]
				},
			},
			{
				test: /\.css$/,
				use: [
					{
						loader: "style-loader",
						options: {
							insert: (element) => {
								if (window.__styleLoaderLastElement) {
									window.__styleLoaderLastElement.after(element);
									return;
								}
								window.__styleLoaderLastElement = element;
								document.head.prepend(element);
							}
						}
					},
					"css-loader"
				]
			}
		]
	},
	plugins: [
		unpluginIcons({ scale: 1.5, compiler: "solid" }),
		new CopyPlugin({
			patterns: [
				{ from: "./res", to: "." },
				{ from: require.resolve("webextension-polyfill"), to: "."},
			]
		})
	]
})
