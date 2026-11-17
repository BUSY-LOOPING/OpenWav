export const SERVICES = ['backend', 'downloader', 'scheduler', 'scraper', 'recommender'];
export const WINDOWS = { '15m': 900, '1h': 3600, '6h': 21_600, '24h': 86_400 } as const;
export type Window = keyof typeof WINDOWS;
