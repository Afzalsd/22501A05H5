const express = require('express');
const router = express.Router();
const UrlModel = require('../models/UrlModel');
const UrlHelpers = require('../utils/helpers');
const { logger } = require('../middleware/logger');

// POST /shorturls - Create a new short URL
router.post('/shorturls', async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body;

    logger.info('Create short URL request', { 
      url, 
      validity, 
      shortcode, 
      ip: UrlHelpers.getClientIP(req) 
    });

    // Validate required fields
    if (!url) {
      logger.warn('Missing required field: url');
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'URL is required', ['url field is missing'])
      );
    }

    // Validate URL format
    if (!UrlHelpers.isValidUrl(url)) {
      logger.warn('Invalid URL format', { url });
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid URL format', ['Please provide a valid HTTP/HTTPS URL'])
      );
    }

    // Validate and set validity period
    let validityMinutes = validity || 30;
    if (validityMinutes < 1 || validityMinutes > 525600) { // Max 1 year
      logger.warn('Invalid validity period', { validity: validityMinutes });
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid validity period', ['Validity must be between 1 and 525600 minutes (1 year)'])
      );
    }

    let finalShortcode = shortcode;

    // Validate custom shortcode if provided
    if (shortcode) {
      if (!UrlHelpers.isValidShortcode(shortcode)) {
        logger.warn('Invalid shortcode format', { shortcode });
        return res.status(400).json(
          UrlHelpers.formatResponse(false, null, 'Invalid shortcode format', ['Shortcode must be 3-20 alphanumeric characters'])
        );
      }

      // Check if shortcode already exists
      if (UrlModel.exists(shortcode)) {
        logger.warn('Shortcode already exists', { shortcode });
        return res.status(409).json(
          UrlHelpers.formatResponse(false, null, 'Shortcode already exists', ['The provided shortcode is already in use'])
        );
      }
    } else {
      // Generate unique shortcode
      let attempts = 0;
      do {
        finalShortcode = UrlHelpers.generateShortcode();
        attempts++;
        
        if (attempts > 10) {
          logger.error('Failed to generate unique shortcode after 10 attempts');
          return res.status(500).json(
            UrlHelpers.formatResponse(false, null, 'Unable to generate unique shortcode', ['Please try again'])
          );
        }
      } while (UrlModel.exists(finalShortcode));
    }

    // Calculate expiry date
    const expiryDate = UrlHelpers.calculateExpiryDate(validityMinutes);

    // Create the short URL
    const urlData = UrlModel.create(finalShortcode, url, expiryDate);

    // Generate the complete short URL
    const shortLink = UrlHelpers.generateShortUrl(req, finalShortcode);

    logger.info('Short URL created successfully', {
      shortcode: finalShortcode,
      originalUrl: url,
      shortLink,
      expiryDate: expiryDate.toISOString()
    });

    // Return success response
    res.status(201).json({
      shortLink,
      expiry: expiryDate.toISOString()
    });

  } catch (error) {
    logger.error('Error creating short URL', { 
      error: error.message, 
      stack: error.stack,
      requestBody: req.body 
    });
    
    res.status(500).json(
      UrlHelpers.formatResponse(false, null, 'Internal server error', ['An unexpected error occurred'])
    );
  }
});

// GET /shorturls/:shortcode - Get statistics for a short URL
router.get('/shorturls/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;

    logger.info('Get URL statistics request', { 
      shortcode,
      ip: UrlHelpers.getClientIP(req)
    });

    // Validate shortcode format
    if (!UrlHelpers.isValidShortcode(shortcode)) {
      logger.warn('Invalid shortcode format in statistics request', { shortcode });
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid shortcode format', ['Shortcode must be 3-20 alphanumeric characters'])
      );
    }

    // Get analytics data
    const analytics = UrlModel.getAnalytics(shortcode);

    if (!analytics) {
      logger.warn('Shortcode not found for statistics', { shortcode });
      return res.status(404).json(
        UrlHelpers.formatResponse(false, null, 'Short URL not found', ['The requested shortcode does not exist or has expired'])
      );
    }

    logger.info('URL statistics retrieved', {
      shortcode,
      totalClicks: analytics.totalClicks,
      isActive: analytics.isActive
    });

    // Return analytics data
    res.status(200).json({
      shortcode: analytics.shortcode,
      originalUrl: analytics.originalUrl,
      createdAt: analytics.createdAt,
      expiryDate: analytics.expiryDate,
      isActive: analytics.isActive,
      totalClicks: analytics.totalClicks,
      clickDetails: analytics.clicks.map(click => ({
        timestamp: click.timestamp,
        referrer: click.referrer,
        location: {
          country: click.location.country,
          region: click.location.region,
          city: click.location.city
        },
        userAgent: click.userAgent
      }))
    });

  } catch (error) {
    logger.error('Error retrieving URL statistics', { 
      error: error.message, 
      stack: error.stack,
      shortcode: req.params.shortcode 
    });
    
    res.status(500).json(
      UrlHelpers.formatResponse(false, null, 'Internal server error', ['An unexpected error occurred'])
    );
  }
});

module.exports = router;