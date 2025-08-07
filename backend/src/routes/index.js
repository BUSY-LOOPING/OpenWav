import express from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import adminRoutes from './admin.js';
import mediaRoutes from './media.js';
import downloadRoutes from './downloads.js';
import settingsRoutes from './settings.js';
import youtubeRoutes from './youtube.js';
import chartsRoutes from './charts.js';  
import playlistsRoutes from './playlists.js'; 
import artistsRoutes from './artists.js'; 

const router = express.Router();

const API_VERSION = '/v1';

router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/admin`, adminRoutes);
router.use(`${API_VERSION}/media`, mediaRoutes);
router.use(`${API_VERSION}/downloads`, downloadRoutes);
router.use(`${API_VERSION}/settings`, settingsRoutes);
router.use(`${API_VERSION}/youtube`, youtubeRoutes);
router.use(`${API_VERSION}/charts`, chartsRoutes);
router.use(`${API_VERSION}/playlists`, playlistsRoutes);
router.use(`${API_VERSION}/artists`, artistsRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'Media Streaming API',
    version: '1.0.0',
    endpoints: {
      auth: `${API_VERSION}/auth`,
      users: `${API_VERSION}/users`,
      admin: `${API_VERSION}/admin`,
      media: `${API_VERSION}/media`,
      downloads: `${API_VERSION}/downloads`,
      settings: `${API_VERSION}/settings`
    },
    documentation: 'https://your-api-docs.com',
    support: 'https://your-support.com'
  });
});

router.get(API_VERSION, (req, res) => {
  res.json({
    version: '1.0.0',
    status: 'active',
    endpoints: [
      { path: '/auth', description: 'Authentication endpoints' },
      { path: '/users', description: 'User management endpoints' },
      { path: '/admin', description: 'Admin panel endpoints' },
      { path: '/media', description: 'Media streaming and management' },
      { path: '/downloads', description: 'Download management' },
      { path: '/settings', description: 'User and system settings' }
    ]
  });
});

export default router;