const { logger } = require('../middleware/logger');
const { Log } = require('../Logging-Middleware/logger');

class UrlModel {
  constructor() {
    // In-memory storage for URLs
    this.urls = new Map();
    // In-memory storage for click analytics
    this.analytics = new Map();
  }

  // Create a new short URL entry
  create(shortcode, originalUrl, expiryDate, createdAt = new Date()) {
    const urlData = {
      shortcode,
      originalUrl,
      createdAt,
      expiryDate,
      isActive: true
    };

    this.urls.set(shortcode, urlData);

    // Initialize analytics for this shortcode
    this.analytics.set(shortcode, {
      totalClicks: 0,
      clicks: []
    });

    logger.info('Short URL created', {
      shortcode,
      originalUrl,
      expiryDate: expiryDate.toISOString()
    });
    Log("backend", "info", "handler", `Short URL created: ${shortcode}`);

    return urlData;
  }

  // Find URL by shortcode
  findByShortcode(shortcode) {
    const urlData = this.urls.get(shortcode);

    if (!urlData) {
      logger.warn('Short URL not found', { shortcode });
      Log("backend", "warn", "handler", `Short URL not found: ${shortcode}`);
      return null;
    }

    // Check if URL has expired
    if (new Date() > urlData.expiryDate) {
      logger.warn('Short URL has expired', {
        shortcode,
        expiryDate: urlData.expiryDate.toISOString()
      });
      Log("backend", "warn", "handler", `Short URL expired: ${shortcode}`);
      return null;
    }

    return urlData;
  }

  // Check if shortcode exists
  exists(shortcode) {
    return this.urls.has(shortcode);
  }

  // Record a click/visit
  recordClick(shortcode, clickData) {
    const analytics = this.analytics.get(shortcode);

    if (!analytics) {
      logger.error('Analytics not found for shortcode', { shortcode });
      Log("backend", "error", "handler", `No analytics for shortcode: ${shortcode}`);
      return false;
    }

    const click = {
      timestamp: new Date().toISOString(),
      ip: clickData.ip,
      userAgent: clickData.userAgent,
      referrer: clickData.referrer || 'direct',
      location: clickData.location || 'unknown'
    };

    analytics.clicks.push(click);
    analytics.totalClicks++;

    logger.info('Click recorded', {
      shortcode,
      totalClicks: analytics.totalClicks,
      clickData: click
    });
    Log("backend", "info", "handler", `Click recorded for shortcode: ${shortcode}`);

    return true;
  }

  // Get analytics for a shortcode
  getAnalytics(shortcode) {
    const urlData = this.urls.get(shortcode);
    const analytics = this.analytics.get(shortcode);

    if (!urlData || !analytics) {
      logger.warn('Analytics or URL not found', { shortcode });
      Log("backend", "warn", "handler", `Analytics or URL not found for: ${shortcode}`);
      return null;
    }

    return {
      shortcode,
      originalUrl: urlData.originalUrl,
      createdAt: urlData.createdAt.toISOString(),
      expiryDate: urlData.expiryDate.toISOString(),
      totalClicks: analytics.totalClicks,
      clicks: analytics.clicks,
      isActive: urlData.isActive && new Date() <= urlData.expiryDate
    };
  }

  // Get all URLs (for debugging)
  getAllUrls() {
    const urls = [];
    for (const [shortcode, urlData] of this.urls) {
      const analytics = this.analytics.get(shortcode);
      urls.push({
        ...urlData,
        totalClicks: analytics ? analytics.totalClicks : 0
      });
    }
    return urls;
  }

  // Clean up expired URLs (optional maintenance function)
  cleanupExpired() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [shortcode, urlData] of this.urls) {
      if (now > urlData.expiryDate) {
        this.urls.delete(shortcode);
        this.analytics.delete(shortcode);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired URLs', { count: cleanedCount });
      Log("backend", "info", "cron_job", `Cleaned up ${cleanedCount} expired URLs`);
    }

    return cleanedCount;
  }
}

// Export singleton instance
module.exports = new UrlModel();
