const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const unpluginIcons = require("unplugin-icons/webpack");

const wd = path.resolve(__dirname, "..");
const src = path.join(wd, "src");

module.exports = function (env) {
	const target = env.target ?? "firefox";
	return {
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
			path: path.join(wd, `dist/${target}`),
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
							[
								"@babel/preset-env",
								{
									exclude: [
										"@babel/plugin-transform-regenerator"
									]
								}
							],
							"@babel/preset-typescript",
							"solid"
						],
						plugins: ["@emotion"]
					}
				},
				{
					test: /\.css$/,
					use: [
						{
							loader: "style-loader",
							options: {
								insert: (element) => {
									if (window.__styleLoaderLastElement) {
										window.__styleLoaderLastElement.after(
											element
										);
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
			unpluginIcons({
				scale: 1.2,
				compiler: "solid",
				defaultStyle: "vertical-align: sub"
			}),
			new CopyPlugin({
				patterns: [
					{ from: "./res", to: "." },
					{ from: require.resolve("webextension-polyfill"), to: "." },
					{
						from: `manifest/${target}.json`,
						to: "manifest.json"
					}
				]
			})
		]
	};
};
