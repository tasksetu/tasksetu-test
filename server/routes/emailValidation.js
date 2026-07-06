// Email validation API endpoints
const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
/**
 * @swagger
 * /api/email/check-email/{email}:
 *   get:
 *     summary: Check if an email is already registered
 *     tags: [Email]
 *     parameters:
 *       - in: path
 *         name: email
 *         schema:
 *           type: string
 *         required: true
 *         description: Email address to check
 *     responses:
 *       200:
 *         description: Email check result
 *       400:
 *         description: Invalid email format
 *       500:
 *         description: Server error
 */
// Check if email already exists
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Check if email exists in database
    const existingUser = await User.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingUser) {
      return res.json({
        success: false,
        exists: true,
        message: 'Email is already registered',
        suggestion: 'Try logging in or use password reset'
      });
    }
    
    return res.json({
      success: true,
      exists: false,
      message: 'Email is available'
    });
    
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking email'
    });
  }
});

/**
 * @swagger
 * /api/email/check-emails-bulk:
 *   post:
 *     summary: Bulk check if emails are registered
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk email check results
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
// Bulk email validation for admin purposes
router.post('/check-emails-bulk', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        message: 'Emails must be an array'
      });
    }
    
    const results = await Promise.all(
      emails.map(async (email) => {
        const exists = await User.findOne({ 
          email: email.toLowerCase() 
        });
        
        return {
          email,
          exists: !!exists,
          status: exists ? 'registered' : 'available'
        };
      })
    );
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('Bulk email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking emails'
    });
  }
});

/**
 * @swagger
 * /api/email/suggest-email/{email}:
 *   get:
 *     summary: Suggest available emails if the given email is taken
 *     tags: [Email]
 *     parameters:
 *       - in: path
 *         name: email
 *         schema:
 *           type: string
 *         required: true
 *         description: Email address to check and suggest alternatives
 *     responses:
 *       200:
 *         description: Email suggestions
 *       500:
 *         description: Server error
 */
// Check email availability with suggestions
router.get('/suggest-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const [localPart, domain] = email.split('@');
    
    // Check original email
    const originalExists = await User.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (!originalExists) {
      return res.json({
        success: true,
        available: email,
        suggestions: []
      });
    }
    
    // Generate suggestions
    const suggestions = [];
    for (let i = 1; i <= 5; i++) {
      const suggestion = `${localPart}${i}@${domain}`;
      const exists = await User.findOne({ 
        email: suggestion.toLowerCase() 
      });
      
      if (!exists) {
        suggestions.push(suggestion);
      }
    }
    
    res.json({
      success: true,
      available: null,
      suggestions: suggestions.slice(0, 3) // Return top 3 suggestions
    });
    
  } catch (error) {
    console.error('Email suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating suggestions'
    });
  }
});

module.exports = router;