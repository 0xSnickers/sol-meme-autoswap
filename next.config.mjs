const extraAllowedDevOrigins = String(process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.142.129', ...extraAllowedDevOrigins],
};

export default nextConfig;
