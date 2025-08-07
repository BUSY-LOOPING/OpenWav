import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import chartService from '../services/chartService.js';
import billboardService from '../services/billboardService.js';

const router = express.Router();

router.get('/types', (req, res) => {
  res.json({
    success: true,
    charts: chartService.getAvailableCharts()
  });
});

router.post('/import/:chartType', authenticateToken, async (req, res, next) => {
  try {
    const { chartType } = req.params;
    const { date, range = '1-25', quality = '192k', format = 'mp3' } = req.body;
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (YYYY-MM-DD format)'
      });
    }

    const result = await chartService.importBillboardChart(chartType, date, userId, {
      range,
      quality,
      format
    });

    res.json({
      success: true,
      message: `${chartType} chart import started`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/billboard/:chartType', authenticateToken, async (req, res, next) => {
  try {
    const { chartType } = req.params;
    const { date, range = '1-10' } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    let chartData;
    switch (chartType) {
      case 'hot-100':
        chartData = await billboardService.getHot100(date, range);
        break;
      case 'radio-songs':
        chartData = await billboardService.getRadioSongs(date, range);
        break;
      case 'billboard-200':
        chartData = await billboardService.getBillboard200(date, range);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid chart type'
        });
    }

    res.json({
      success: true,
      chartType,
      date,
      range,
      data: chartData
    });
  } catch (error) {
    next(error);
  }
});

export default router;
