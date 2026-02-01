/**
 * DataService - Maps UI variables to ScanSan API endpoints
 * Handles data transformation and caching
 */

import apiClient from './apiClient';

class DataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached data or fetch new
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 Cache hit: ${key}`);
      return cached.data;
    }
    
    console.log(`🌐 Fetching: ${key}`);
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Variable: Market Value
   * Endpoint: /v1/district/{area_code_district}/growth
   * Extract: avg_price from yearly_data
   */
  async getMarketValue(areaCode) {
    const key = `market_${areaCode}`;
    
    return this.getCached(key, async () => {
      try {
        const response = await apiClient.get(`/district/${areaCode}/growth`);
        
        if (!response.data?.data?.yearly_data) {
          throw new Error(`No yearly_data found for ${areaCode}`);
        }
        
        return {
          areaCode,
          type: 'market_value',
          timeseries: response.data.data.yearly_data.map(item => ({
            year: parseInt(item.year_month),
            value: item.avg_price,
            percentageChange: item.avg_price_percentage_change,
            medianPrice: item.median_price
          }))
        };
      } catch (error) {
        console.error(`Failed to fetch market value for ${areaCode}:`, {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data,
          url: error?.config?.url
        });
        throw error;
      }
    });
  }

  /**
   * Variable: Rental Yield
   * Endpoint: /v1/district/{area_code_district}/rent/demand
   * Extract: mean_rent_pcm
   */
  async getRentalYield(areaCode) {
    const key = `rental_${areaCode}`;
    
    return this.getCached(key, async () => {
      try {
        const response = await apiClient.get(`/district/${areaCode}/rent/demand`);
        
        // Note: Adjust based on actual API structure
        return {
          areaCode,
          type: 'rental_yield',
          value: response.data.mean_rent_pcm,
          data: response.data
        };
      } catch (error) {
        console.error(`Failed to fetch rental yield for ${areaCode}:`, error);
        return null; // Return null if endpoint doesn't exist yet
      }
    });
  }

  /**
   * Variable: Crime Density
   * Endpoint: /v1/area_codes/{area_code}/crime/summary
   * Extract: total_incidents
   */
  async getCrimeDensity(areaCode) {
    const key = `crime_${areaCode}`;
    
    return this.getCached(key, async () => {
      try {
        const response = await apiClient.get(`/area_codes/${areaCode}/crime/summary`);
        
        return {
          areaCode,
          type: 'crime_density',
          totalIncidents: response.data.total_incidents,
          data: response.data
        };
      } catch (error) {
        console.error(`Failed to fetch crime data for ${areaCode}:`, error);
        return null;
      }
    });
  }

  /**
   * Variable: Infrastructure
   * Endpoint: /v1/postcode/{postcode}/amenities
   * Extract: count of schools and stations
   */
  async getInfrastructure(postcode) {
    const key = `infra_${postcode}`;
    
    return this.getCached(key, async () => {
      try {
        const response = await apiClient.get(`/postcode/${postcode}/amenities`);
        
        const schools = response.data.amenities?.filter(a => a.type === 'school')?.length || 0;
        const stations = response.data.amenities?.filter(a => a.type === 'station')?.length || 0;
        
        return {
          postcode,
          type: 'infrastructure',
          schools,
          stations,
          total: schools + stations,
          amenities: response.data.amenities
        };
      } catch (error) {
        console.error(`Failed to fetch infrastructure for ${postcode}:`, error);
        return null;
      }
    });
  }

  /**
   * Search for area codes
   * Endpoint: /v1/area_codes/search
   */
  async searchAreaCodes(areaName) {
    try {
      const response = await apiClient.get('/area_codes/search', {
        params: { area_name: areaName }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to search area codes for ${areaName}:`, error);
      throw error;
    }
  }

  /**
   * Get area summary
   */
  async getAreaSummary(areaCode) {
    try {
      const response = await apiClient.get(`/area_codes/${areaCode}/summary`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get summary for ${areaCode}:`, error);
      return null;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }
}

export default new DataService();
