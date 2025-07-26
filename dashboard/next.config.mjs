/** @type {import('next').NextConfig} */
const nextConfig = {
	output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
	serverExternalPackages: ["@influxdata/influxdb-client"],
	reactStrictMode: true,

	// Compiler optimizations
	compiler: {
		removeConsole:
			process.env.NODE_ENV === "production"
				? {
						exclude: ["error", "warn"],
					}
				: false,
	},

	// Image optimization
	images: {
		formats: ["image/webp", "image/avif"],
		minimumCacheTTL: 86400, // 24 hours
		dangerouslyAllowSVG: true,
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},

	// Bundle optimization
	webpack: (config, { dev, isServer }) => {
		// Production optimizations
		if (!dev) {
			config.optimization = {
				...config.optimization,
				splitChunks: {
					chunks: "all",
					minSize: 20000,
					maxSize: 244000,
					cacheGroups: {
						default: {
							minChunks: 2,
							priority: -20,
							reuseExistingChunk: true,
						},
						vendor: {
							test: /[\\/]node_modules[\\/]/,
							name: "vendors",
							priority: 10,
							reuseExistingChunk: true,
						},
						openlayers: {
							test: /[\\/]node_modules[\\/]ol[\\/]/,
							name: "openlayers",
							priority: 20,
							reuseExistingChunk: true,
						},
						recharts: {
							test: /[\\/]node_modules[\\/]recharts[\\/]/,
							name: "recharts",
							priority: 20,
							reuseExistingChunk: true,
						},
						three: {
							test: /[\\/]node_modules[\\/]three[\\/]/,
							name: "three",
							priority: 20,
							reuseExistingChunk: true,
						},
						utils: {
							name: "utils",
							test: /[\\/](lib|hooks|components)[\\/]/,
							priority: 15,
							reuseExistingChunk: true,
						},
					},
				},
				// Tree shaking optimizations
				usedExports: true,
				sideEffects: false,
			};
		}

		// Development optimizations
		if (dev && !isServer) {
			config.watchOptions = {
				...config.watchOptions,
				poll: 1000,
				aggregateTimeout: 300,
			};
		}

		// Bundle analyzer
		if (process.env.ANALYZE === "true") {
			const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
			config.plugins.push(
				new BundleAnalyzerPlugin({
					analyzerMode: "server",
					analyzerPort: isServer ? 8888 : 8889,
					openAnalyzer: true,
					generateStatsFile: true,
					statsFilename: isServer
						? "../analyze/server.json"
						: "../analyze/client.json",
				}),
			);
		}

		// Optimize resolve for better tree shaking
		config.resolve.alias = {
			...config.resolve.alias,
			// Remove problematic recharts ESM alias
		};

		return config;
	},

	// Headers for caching and performance
	async headers() {
		return [
			{
				source: "/api/:path*",
				headers: [
					{ key: "Access-Control-Allow-Credentials", value: "true" },
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{
						key: "Access-Control-Allow-Methods",
						value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
					},
					{
						key: "Access-Control-Allow-Headers",
						value:
							"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
					},
					// Cache API responses for 30 seconds
					{
						key: "Cache-Control",
						value: "public, s-maxage=30, stale-while-revalidate=60",
					},
				],
			},
			{
				source: "/:path*-tiles/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{ key: "Access-Control-Allow-Methods", value: "GET" },
					{ key: "Cache-Control", value: "public, max-age=86400, immutable" },
				],
			},
			{
				source: "/_next/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			// Security headers
			{
				source: "/(.*)",
				headers: [
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "origin-when-cross-origin",
					},
				],
			},
		];
	},

	// Optimized rewrites with caching
	async rewrites() {
		return [
			{
				source: "/osm-tiles/:z/:x/:y.png",
				destination: "https://tile.openstreetmap.org/:z/:x/:y.png",
			},
			{
				source: "/carto-dark/:z/:x/:y.png",
				destination:
					"https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/:z/:x/:y.png",
			},
			{
				source: "/carto-dark-nolabels/:z/:x/:y.png",
				destination:
					"https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/:z/:x/:y.png",
			},
		];
	},

	// Redirect configuration for performance
	async redirects() {
		return [
			{
				source: "/telemetry",
				destination: "/",
				permanent: false,
			},
		];
	},

	// PoweredByHeader removal for security and performance
	poweredByHeader: false,

	// Compression
	compress: true,

	// Generate ETags for better caching
	generateEtags: true,

	// Optimize page extensions
	pageExtensions: ["tsx", "ts", "jsx", "js"],

	// Environment variables for optimization
	env: {
		OPTIMIZE_IMAGES: "true",
		MINIMIZE_JS: process.env.NODE_ENV === "production" ? "true" : "false",
	},
};

export default nextConfig;
