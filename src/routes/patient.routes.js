const express = require('express');
const auth = require('../middleware/auth');
const patientController = require('../controllers/patient.controller');

const router = express.Router();

router.use(auth);

router.post('/', patientController.createPatient);
router.get('/', patientController.getAllPatients);
router.get('/:id', patientController.getPatientById);
router.put('/:id', patientController.updatePatient);
router.delete('/:id', patientController.deletePatient);

module.exports = router;
