import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.licdn.com' },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Proxy server-side de /api/ai/* a la API real. Evita CORS / mixed-content
  // y permite que el browser llame a same-origin sin depender de
  // NEXT_PUBLIC_API_URL. Configurá API_URL en Netlify (o NEXT_PUBLIC_API_URL
  // como fallback).
  async rewrites() {
    const apiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001'
    return [
      { source: '/api/ai/:path*', destination: `${apiUrl}/api/ai/:path*` },
    ]
  },
};

export default nextConfig;
