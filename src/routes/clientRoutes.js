const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { validateClientRegistration } = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/clients
 * @desc    Register a new client
 * @access  Public
 */
router.post('/', validateClientRegistration, clientController.registerClient);

/**
 * @route   GET /api/clients/:id
 * @desc    Get client by ID
 * @access  Public
 */
router.get('/:id', clientController.getClientById);

/**
 * @route   GET /api/clients/:id/bookings
 * @desc    Get client's bookings
 * @access  Public
 */
router.get('/:id/bookings', clientController.getClientBookings);

/**
 * @route   PATCH /api/clients/:id
 * @desc    Update client
 * @access  Public
 */
router.patch('/:id', clientController.updateClient);

module.exports = router; 