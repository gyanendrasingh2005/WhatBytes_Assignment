const express = require('express');
const auth = require('../middleware/auth');
const doctorController = require('../controllers/doctor.controller');

const router = express.Router();

router.use(auth);

router.post('/', doctorController.createDoctor);
router.get('/', doctorController.getAllDoctors);
router.get('/:id', doctorController.getDoctorById);
router.put('/:id', doctorController.updateDoctor);
router.delete('/:id', doctorController.deleteDoctor);

module.exports = router;
