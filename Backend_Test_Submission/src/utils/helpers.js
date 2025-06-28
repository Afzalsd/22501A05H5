const { nanoid } = require('nanoid');
const validator = require('validator');
const geoip = require('geoip-lite');
const { logger } = require('../middleware/logger');
const { Log } = require('../Logging-Middleware/logger'); // ✅ Add this line

class UrlHelpers {
  static generateShortcode(length = 6) {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return nanoid(length).replace(/[^a-zA-Z0-9]/g, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    );
  }

  static isValidUrl(url) {
    try {
      if (!validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true
      })) {
        return false;
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      ) {
        logger.warn('URL with internal/localhost domain detected', { url, hostname });
        Log("backend", "warn", "utils", `Internal/localhost domain detected: ${hostname}`);
      }

      return true;
    } catch (error) {
      logger.error('URL validation error', { url, error: error.message });
      Log("backend", "error", "utils", `URL validation error: ${error.message}`);
      return false;
    }
  }

  static isValidShortcode(shortcode) {
    const shortcodeRegex = /^[a-zA-Z0-9]{3,20}$/;
    return shortcodeRegex.test(shortcode);
  }

  static calculateExpiryDate(validityMinutes = 30) {
    if (!validityMinutes || validityMinutes < 1) {
      validityMinutes = 30;
    }
    const now = new Date();
    return new Date(now.getTime() + validityMinutes * 60 * 1000);
  }

  static getLocationFromIP(ip) {
    try {
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
          country: 'Local',
          region: 'Local',
          city: 'Local',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      const geo = geoip.lookup(ip);

      if (geo) {
        return {
          country: geo.country || 'Unknown',
          region: geo.region || 'Unknown',
          city: geo.city || 'Unknown',
          timezone: geo.timezone || 'Unknown'
        };
      }

      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown'
      };
    } catch (error) {
      logger.error('Error getting location from IP', { ip, error: error.message });
      Log("backend", "error", "utils", `Error getting location from IP: ${error.message}`);
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown'
      };
    }
  }

  static extractReferrer(req) {
    const referrer = req.get('Referer') || req.get('Referrer');

    if (!referrer) return 'direct';

    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch (error) {
      logger.warn('Invalid referrer URL', { referrer });
      Log("backend", "warn", "utils", `Invalid referrer URL: ${referrer}`);
      return 'unknown';
    }
  }

  static getClientIP(req) {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      '127.0.0.1'
    );
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>]/g, '').trim();
  }

  static formatResponse(success, data = null, message = null, errors = null) {
    const response = {
      success,
      timestamp: new Date().toISOString()
    };
    if (data) response.data = data;
    if (message) response.message = message;
    if (errors) response.errors = errors;
    return response;
  }

  static generateShortUrl(req, shortcode) {
    const protocol = req.protocol;
    const host = req.get('Host');
    return `${protocol}://${host}/${shortcode}`;
  }
}

module.exports = UrlHelpers;
