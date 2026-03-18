import express from 'express';
import adminController from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';
 
const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin); 

router.get('/stats',                    adminController.getDashboardStats);
router.get('/users',                    adminController.getUsers);
router.put('/users/:id',                adminController.updateUser);
router.delete('/users/:id',             adminController.deleteUser);
router.get('/downloads',                adminController.getDownloadTasks);
router.post('/downloads/:id/cancel',    adminController.cancelDownloadTask);
router.get('/settings',                 adminController.getGlobalSettings);
router.put('/settings/:key',            adminController.updateGlobalSetting);

export default router;