const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Service routes using controller-based implementation
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', protect, restrictTo('admin'), serviceController.createService);
router.put('/:id', protect, restrictTo('admin'), serviceController.updateService);
router.delete('/:id', protect, restrictTo('admin'), serviceController.deleteService);

// Service category routes
router.get('/category/:category', serviceController.getServicesByCategory);

module.exports = router;
