import billboardService from './billboardService.js';
import youtubeService from './youtubeService.js';
import artistService from './artistService.js';
import playlistService from './playlistService.js';
import downloadService from './downloadService.js';
import {logger} from '../config/logger.js';

class ChartService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async importBillboardChart(chartType, date, userId, options = {}) {
    const importId = `chart_${chartType}_${date}_${Date.now()}`;
    
    try {
      this.emitProgress(importId, 'started', 0, `Fetching ${chartType} chart for ${date}`);

      let chartData;
      switch (chartType) {
        case 'hot-100':
          chartData = await billboardService.getHot100(date, options.range || '1-50');
          break;
        case 'radio-songs':
          chartData = await billboardService.getRadioSongs(date, options.range || '1-30');
          break;
        case 'billboard-200':
          chartData = await billboardService.getBillboard200(date, options.range || '1-25');
          break;
        default:
          throw new Error(`Unknown chart type: ${chartType}`);
      }

      this.emitProgress(importId, 'processing', 10, 
        `Found ${chartData.content?.length || 0} tracks`);

      const tracks = billboardService.parseChartData(chartData, chartType);
      
      const playlist = await playlistService.createPlaylistFromChart(
        chartData, chartType, userId
      );

      this.emitProgress(importId, 'searching', 20, 'Searching YouTube for tracks...');

      const results = [];
      let processed = 0;

      for (const track of tracks) {
        try {
          const progress = 20 + Math.round((processed / tracks.length) * 60);
          
          this.emitProgress(importId, 'searching', progress, 
            `Searching: ${track.artist} - ${track.title}`);

          const searchQuery = `${track.artist} ${track.title}`;
          const youtubeResults = await youtubeService.searchVideos(searchQuery, 3);

          if (youtubeResults.length > 0) {
            const bestMatch = youtubeResults[0]; 
            
            const artist = await artistService.createOrGetArtist(track.artist, {
              image_url: bestMatch.thumbnail
            });

            const downloadResult = await downloadService.addDownloadJob(bestMatch.url, {
              userId,
              quality: options.quality || '192k',
              format: options.format || 'mp3',
              audioOnly: options.audioOnly !== false,
              priority: 3
            });

            results.push({
              track,
              artist,
              youtubeVideo: bestMatch,
              downloadResult,
              success: true
            });
          } else {
            results.push({
              track,
              success: false,
              error: 'No YouTube results found'
            });
          }
        } catch (error) {
          results.push({
            track,
            success: false,
            error: error.message
          });
        }
        
        processed++;
      }

      const successCount = results.filter(r => r.success).length;
      
      this.emitProgress(importId, 'completed', 100, 
        `Chart import completed: ${successCount}/${tracks.length} tracks found and queued`);

      return {
        importId,
        chartType,
        date,
        playlist,
        results,
        successCount,
        failedCount: tracks.length - successCount
      };

    } catch (error) {
      this.emitProgress(importId, 'failed', null, 
        `Import failed: ${error.message}`);
      throw error;
    }
  }

  getAvailableCharts() {
    return [
      { id: 'hot-100', name: 'Billboard Hot 100', description: 'The most popular songs in the US' },
      { id: 'radio-songs', name: 'Radio Songs', description: 'Most played songs on radio' },
      { id: 'billboard-200', name: 'Billboard 200', description: 'Top albums in the US' }
    ];
  }

  emitProgress(importId, status, progress, message, extra = {}) {
    if (this.io) {
      this.io.emit('chartImport', {
        importId,
        status,
        progress,
        message,
        ...extra,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default new ChartService();
