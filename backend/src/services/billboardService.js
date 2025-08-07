import {logger} from '../config/logger.js';

class BillboardService {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = 'billboard-api2.p.rapidapi.com';
    this.baseURL = 'https://billboard-api2.p.rapidapi.com';
  }

  async makeRequest(endpoint) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': this.apiHost,
          'x-rapidapi-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Billboard API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error(`Billboard API request failed: ${error.message}`);
      throw error;
    }
  }

  // Get Hot 100 chart
  async getHot100(date, range = '1-100') {
    const endpoint = `/hot-100?date=${date}&range=${range}`;
    return this.makeRequest(endpoint);
  }

  // Get Radio Songs chart
  async getRadioSongs(date, range = '1-50') {
    const endpoint = `/radio-songs?date=${date}&range=${range}`;
    return this.makeRequest(endpoint);
  }

  // Get Billboard 200 (Albums)
  async getBillboard200(date, range = '1-200') {
    const endpoint = `/billboard-200?date=${date}&range=${range}`;
    return this.makeRequest(endpoint);
  }

  // Get Artist Hot 100
  async getArtistHot100(date, range = '1-100') {
    const endpoint = `/artist-100?date=${date}&range=${range}`;
    return this.makeRequest(endpoint);
  }

  // Get multiple charts for a date
  async getChartsForDate(date) {
    try {
      const [hot100, radioSongs, billboard200, artist100] = await Promise.allSettled([
        this.getHot100(date, '1-50'),
        this.getRadioSongs(date, '1-30'),
        this.getBillboard200(date, '1-30'),
        this.getArtistHot100(date, '1-25')
      ]);

      return {
        date,
        hot100: hot100.status === 'fulfilled' ? hot100.value : null,
        radioSongs: radioSongs.status === 'fulfilled' ? radioSongs.value : null,
        billboard200: billboard200.status === 'fulfilled' ? billboard200.value : null,
        artist100: artist100.status === 'fulfilled' ? artist100.value : null
      };
    } catch (error) {
      logger.error(`Failed to get charts for date ${date}:`, error);
      throw error;
    }
  }

parseChartData(chartData, chartName) {
  if (!chartData || !chartData.content) return [];

  // Convert content object to array of entries
  const entries = Object.values(chartData.content);
  
  return entries.map(item => ({
    position: parseInt(item.rank), 
    title: item.title,
    artist: item.artist,
    chartName,
    chartDate: chartData.info?.date || null,
    isNew: item.detail === 'new' || false,
    lastWeekPosition: item['last week'] ? parseInt(item['last week']) : null,
    peakPosition: item['peak position'] ? parseInt(item['peak position']) : null,
    weeksOnChart: item['weeks on chart'] ? parseInt(item['weeks on chart']) : null,
    metadata: {
      image: item.image || null,
      detail: item.detail || null, // 'up', 'down', 'same', 'new'
      weeksAtNumber1: item['weeks at no.1'] ? parseInt(item['weeks at no.1']) : null
    }
  }));
}

}

export default new BillboardService();
