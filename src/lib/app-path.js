export const APP_BASE_PATH = '/automated-trading-meme';

export function withAppBasePath(pathname) {
  return `${APP_BASE_PATH}${pathname}`;
}
