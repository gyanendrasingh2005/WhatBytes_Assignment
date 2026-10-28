const express = require('express');
const auth = require('../middleware/auth');
const mappingController = require('../controllers/mapping.controller');

const router = express.Router();

router.use(auth);

router.post('/', mappingController.createMapping);
router.get('/', mappingController.getUserMappings);
router.get('/:patientId', mappingController.getDoctorsForPatient);
router.delete('/:id', mappingController.deleteMapping);

module.exports = router;
