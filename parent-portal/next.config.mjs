/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kamakura-green-ikusei.surge.sh', pathname: '/**' }
    ]
  }
};

export default nextConfig;
