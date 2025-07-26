/** @type {import('postcss-load-config').Config} */
const config = {
	plugins: {
		"@tailwindcss/postcss": {},
		autoprefixer: {},
		...(process.env.NODE_ENV === "production" && {
			cssnano: {
				preset: [
					"default",
					{
						discardComments: {
							removeAll: true,
						},
						normalizeWhitespace: true,
						minifySelectors: true,
						minifyParams: true,
						mergeLonghand: true,
						mergeRules: true,
						reduceIdents: false,
						discardUnused: false,
					},
				],
			},
		}),
	},
};

export default config;
