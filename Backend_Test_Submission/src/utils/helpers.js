const { nanoid } = require('nanoid');
const validator = require('validator');
const geoip = require('geoip-lite');
const { logger } = require('../middleware/logger');

class UrlHelpers {
  
  // Here Generates a unique shortcode globally
  // Uses nanoid for better performance and shorter IDs
  static generateShortcode(length = 6) {
    // Use alphanumeric characters only
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return nanoid(length).replace(/[^a-zA-Z0-9]/g, () => 
      alphabet[Math.floor(Math.random() * alphabet.length)]
    );
  }


  // Validate the URL format
  static isValidUrl(url) {
    try {
      // Check if it's a valid URL format
      if (!validator.isURL(url, {
        
        protocols: ['http', 'https'],
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true


      })) {
        return false;
      }


      // Additional check to ensure it's not localhost or internal IPs for security reasons
      // This is to prevent misuse of the microservice by allowing only valid external URLs
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        logger.warn('URL with internal/localhost domain detected', { url, hostname });
      }


      return true;



    } catch (error) {
      logger.error('URL validation error', { url, error: error.message });
      return false;
    }
  }

  // Validate shortcode format
  static isValidShortcode(shortcode) {
    // Shortcode should be alphanumeric and between 3-20 characters
    const shortcodeRegex = /^[a-zA-Z0-9]{3,20}$/;
    return shortcodeRegex.test(shortcode);
  }

  // Calculate expiry date from validity minutes
  static calculateExpiryDate(validityMinutes = 30) {
    if (!validityMinutes || validityMinutes < 1) {
      validityMinutes = 30; // Default to 30 minutes
    }
    
    const now = new Date();
    const expiryDate = new Date(now.getTime() + (validityMinutes * 60 * 1000));
    return expiryDate;
  }

  // Get geographical location from IP
  static getLocationFromIP(ip) {
    try {
      // Handle localhost and private IPs
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
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown'
      };
    }
  }

  // Extract referrer information
  static extractReferrer(req) {
    const referrer = req.get('Referer') || req.get('Referrer');
    
    if (!referrer) {
      return 'direct';
    }

    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch (error) {
      logger.warn('Invalid referrer URL', { referrer });
      return 'unknown';
    }
  }

  // Get client IP address
  static getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  // Sanitize input strings
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Basic sanitization - remove dangerous characters
    return input.replace(/[<>]/g, '').trim();
  }

  // Format response data
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

  // Generate full short URL
  static generateShortUrl(req, shortcode) {
    const protocol = req.protocol;
    const host = req.get('Host');
    return `${protocol}://${host}/${shortcode}`;
  }
}

module.exports = UrlHelpers;