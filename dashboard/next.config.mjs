/** @type {import('next').NextConfig} */
const nextConfig = {
	output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
	serverExternalPackages: ["@influxdata/influxdb-client"],
	reactStrictMode: true,

	async rewrites() {
		return [
			{
				source: '/osm-tiles/:z/:x/:y.png',
				destination: 'https://tile.openstreetmap.org/:z/:x/:y.png',
			},
		];
	},

	async headers() {
		return [
			{
				// Apply CORS headers to API routes
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
				],
			},
			{
				// Add CORS headers for tile proxy
				source: "/osm-tiles/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{ key: "Access-Control-Allow-Methods", value: "GET" },
					{ key: "Cache-Control", value: "public, max-age=3600" },
				],
			},
		];
	},

	webpack: (config, { isServer, dev }) => {
		// For hot reloading in Docker
		if (dev && !isServer) {
			config.watchOptions = {
				...config.watchOptions,
				poll: 1000,
				aggregateTimeout: 300,
			};
		}
		return config;
	},
};

export default nextConfig;