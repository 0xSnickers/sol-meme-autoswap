import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const extraAllowedDevOrigins = String(process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const nextConfig = {
  basePath: '/automated-trading-meme',
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.142.129', ...extraAllowedDevOrigins],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
