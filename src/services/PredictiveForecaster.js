/**
 * Predictive Forecaster
 * Uses CAGR (Compound Annual Growth Rate) to project future property values
 * Historical Data: 2019-2025 (7 years)
 * Future Predictions: 2026-2035 (10 years)
 */

export class PredictiveForecaster {
  constructor() {
    this.minYearsForPrediction = 3; // Minimum years needed for CAGR
  }

  /**
   * Calculate CAGR (Compound Annual Growth Rate)
   * Formula: CAGR = (Ending Value / Beginning Value)^(1/Number of Years) - 1
   */
  calculateCAGR(beginValue, endValue, years) {
    if (beginValue <= 0 || endValue <= 0 || years <= 0) {
      return 0;
    }
    
    return Math.pow(endValue / beginValue, 1 / years) - 1;
  }

  /**
   * Get CAGR from last N years of data
   */
  getRecentCAGR(timeseries, years = 3) {
    if (!timeseries || timeseries.length < years) {
      console.warn('Insufficient data for CAGR calculation');
      return 0;
    }

    // Sort by year
    const sorted = [...timeseries].sort((a, b) => a.year - b.year);
    const recent = sorted.slice(-years);
    
    const beginValue = recent[0].value;
    const endValue = recent[recent.length - 1].value;
    const actualYears = recent[recent.length - 1].year - recent[0].year;
    
    return this.calculateCAGR(beginValue, endValue, actualYears);
  }

  /**
   * Project future value using CAGR
   * Formula: Future Value = Present Value * (1 + CAGR)^n
   */
  projectFutureValue(currentValue, cagr, yearsAhead) {
    if (currentValue <= 0) return 0;
    return currentValue * Math.pow(1 + cagr, yearsAhead);
  }

  /**
   * Generate complete forecast including historical and future data
   * @param {Array} historicalData - Array of {year, value} objects
   * @param {number} futureYears - Number of years to project (default: 10)
   * @returns {Object} - {historical, future, cagr, currentYear, projectionStart}
   */
  generateForecast(historicalData, futureYears = 10) {
    if (!historicalData || historicalData.length === 0) {
      throw new Error('No historical data provided');
    }

    // Sort historical data
    const sorted = [...historicalData].sort((a, b) => a.year - b.year);
    const lastDataPoint = sorted[sorted.length - 1];
    const currentYear = lastDataPoint.year;
    const currentValue = lastDataPoint.value;

    // Calculate CAGR from last 3 years
    const cagr = this.getRecentCAGR(sorted, Math.min(3, sorted.length));
    
    console.log(`📈 CAGR (3-year): ${(cagr * 100).toFixed(2)}%`);

    // Generate future projections
    const future = [];
    for (let i = 1; i <= futureYears; i++) {
      const futureYear = currentYear + i;
      const projectedValue = this.projectFutureValue(currentValue, cagr, i);
      
      future.push({
        year: futureYear,
        value: Math.round(projectedValue),
        isPrediction: true,
        confidence: this.calculateConfidence(i, futureYears)
      });
    }

    return {
      historical: sorted.map(d => ({ ...d, isPrediction: false })),
      future,
      cagr,
      currentYear,
      projectionStart: currentYear + 1,
      projectionEnd: currentYear + futureYears
    };
  }

  /**
   * Calculate confidence level (decreases as we go further into future)
   * Confidence = 100% at year 1, decreasing to 60% at max future year
   */
  calculateConfidence(yearsAhead, maxYears) {
    const minConfidence = 0.6; // 60%
    const confidenceDecay = (1 - minConfidence) / maxYears;
    return Math.max(minConfidence, 1 - (yearsAhead * confidenceDecay));
  }

  /**
   * Get value for a specific year (historical or predicted)
   */
  getValueForYear(forecast, targetYear) {
    // Check historical data
    const historical = forecast.historical.find(d => d.year === targetYear);
    if (historical) return { ...historical, source: 'historical' };

    // Check future projections
    const future = forecast.future.find(d => d.year === targetYear);
    if (future) return { ...future, source: 'predicted' };

    return null;
  }

  /**
   * Generate weighted forecast (useful for mixing multiple data sources)
   */
  generateWeightedForecast(datasets, weights) {
    if (datasets.length !== weights.length) {
      throw new Error('Datasets and weights must have same length');
    }

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    // Generate individual forecasts
    const forecasts = datasets.map(data => this.generateForecast(data));

    // Combine forecasts
    const combinedFuture = forecasts[0].future.map((_, index) => {
      const year = forecasts[0].future[index].year;
      const weightedValue = forecasts.reduce((sum, forecast, i) => {
        return sum + (forecast.future[index].value * normalizedWeights[i]);
      }, 0);

      return {
        year,
        value: Math.round(weightedValue),
        isPrediction: true,
        confidence: this.calculateConfidence(index + 1, forecasts[0].future.length)
      };
    });

    return {
      historical: forecasts[0].historical,
      future: combinedFuture,
      cagr: forecasts.reduce((sum, f, i) => sum + (f.cagr * normalizedWeights[i]), 0),
      currentYear: forecasts[0].currentYear,
      projectionStart: forecasts[0].projectionStart,
      projectionEnd: forecasts[0].projectionEnd
    };
  }
}

export default new PredictiveForecaster();
