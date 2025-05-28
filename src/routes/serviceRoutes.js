const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { validateService } = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

// Service routes with controller-based implementation
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', authMiddleware.requireAuth, validateService, serviceController.createService);
router.put('/:id', authMiddleware.requireAuth, validateService, serviceController.updateService);
router.delete('/:id', authMiddleware.requireAuth, serviceController.deleteService);

// Service category routes
router.get('/category/:category', serviceController.getServicesByCategory);

// Service availability routes
router.get('/:id/availability', serviceController.getServiceAvailability);
router.post('/:id/availability', authMiddleware.requireAuth, serviceController.updateServiceAvailability);

// Service analytics routes
router.get('/analytics/popular', serviceController.getPopularServices);
router.get('/analytics/revenue/:serviceId', authMiddleware.requireAuth, serviceController.getServiceRevenue);

// Export router
module.exports = router;
