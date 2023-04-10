
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const wd = path.resolve(__dirname, "..");
const src = path.join(wd, "src");

module.exports = {
	mode: "production",
	entry: {
		main: path.join(src, "main.ts"),
	},
	output: {
		path: path.join(wd, ".dist")
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: "ts-loader",
			}
		]
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "./res", to: "." }
			]
		})
	]
}