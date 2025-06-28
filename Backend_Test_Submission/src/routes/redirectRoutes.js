const express = require('express');
const router = express.Router();
const UrlModel = require('../models/UrlModel');
const UrlHelpers = require('../utils/helpers');
const { logger } = require('../middleware/logger');

// GET /:shortcode - Redirect to original URL
router.get('/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;
    const clientIP = UrlHelpers.getClientIP(req);

    logger.info('Redirect request received', { 
      shortcode,
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer')
    });

    // Validate shortcode format
    if (!UrlHelpers.isValidShortcode(shortcode)) {
      logger.warn('Invalid shortcode format in redirect request', { shortcode, ip: clientIP });
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid shortcode format', ['Shortcode must be 3-20 alphanumeric characters'])
      );
    }

    // Find the URL data
    const urlData = UrlModel.findByShortcode(shortcode);

    if (!urlData) {
      logger.warn('Shortcode not found or expired for redirect', { shortcode, ip: clientIP });
      return res.status(404).json(
        UrlHelpers.formatResponse(false, null, 'Short URL not found or has expired', ['The requested shortcode does not exist or has expired'])
      );
    }

    // Get geographical location from IP
    const location = UrlHelpers.getLocationFromIP(clientIP);

    // Record the click analytics
    const clickData = {
      ip: clientIP,
      userAgent: req.get('User-Agent') || 'Unknown',
      referrer: UrlHelpers.extractReferrer(req),
      location: location
    };

    const clickRecorded = UrlModel.recordClick(shortcode, clickData);

    if (!clickRecorded) {
      logger.error('Failed to record click analytics', { shortcode, clickData });
    }

    logger.info('Redirecting to original URL', {
      shortcode,
      originalUrl: urlData.originalUrl,
      ip: clientIP,
      location: `${location.city}, ${location.country}`
    });

    // Perform the redirect
    res.redirect(302, urlData.originalUrl);

  } catch (error) {
    logger.error('Error processing redirect', { 
      error: error.message, 
      stack: error.stack,
      shortcode: req.params.shortcode,
      ip: UrlHelpers.getClientIP(req)
    });
    
    res.status(500).json(
      UrlHelpers.formatResponse(false, null, 'Internal server error', ['An unexpected error occurred during redirect'])
    );
  }
});

// Handle health check
router.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'URL Shortener Microservice'
  });
});

module.exports = router;