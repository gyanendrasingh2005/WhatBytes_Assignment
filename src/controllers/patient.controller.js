const prisma = require('../config/prisma');

const ALLOWED_GENDERS = ['male', 'female', 'other', 'non-binary'];
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

const createPatient = async (req, res) => {
  try {
    const { name, age, gender, address, phone, medicalHistory, createdById } = req.body;

    if (createdById !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Unexpected fields not permitted',
        errors: ['Unexpected fields not permitted'],
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required (at least 2 characters)',
        errors: ['Patient name is required (at least 2 characters)'],
      });
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
      return res.status(400).json({
        success: false,
        message: 'Age must be a valid integer between 0 and 150',
        errors: ['Age must be a valid integer between 0 and 150'],
      });
    }

    if (!gender || !ALLOWED_GENDERS.includes(String(gender).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be one of: Male, Female, Other, Non-binary',
        errors: ['Gender must be one of: Male, Female, Other, Non-binary'],
      });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Address is required (at least 3 characters)',
        errors: ['Address is required (at least 3 characters)'],
      });
    }

    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number',
        errors: ['Please provide a valid phone number'],
      });
    }

    const patient = await prisma.patient.create({
      data: {
        name: name.trim(),
        age: parsedAge,
        gender: gender.trim(),
        address: address.trim(),
        phone: phone.trim(),
        medicalHistory: medicalHistory ? medicalHistory.trim() : null,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while creating patient',
    });
  }
};

const getAllPatients = async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      where: { createdById: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'Patients retrieved successfully',
      data: patients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching patients',
    });
  }
};

const getPatientById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID must be a positive integer',
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        doctors: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                specialization: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!patient || patient.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    const formattedPatient = {
      ...patient,
      assignedDoctors: patient.doctors.map((item) => ({
        mappingId: item.id,
        doctor: item.doctor,
      })),
    };

    return res.status(200).json({
      success: true,
      message: 'Patient retrieved successfully',
      data: formattedPatient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching patient',
    });
  }
};

const updatePatient = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID must be a positive integer',
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!patient || patient.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    const { name, age, gender, address, phone, medicalHistory } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (age !== undefined) {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
        return res.status(400).json({ success: false, message: 'Invalid age' });
      }
      updateData.age = parsedAge;
    }
    if (gender !== undefined) {
      if (!ALLOWED_GENDERS.includes(String(gender).toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid gender' });
      }
      updateData.gender = gender.trim();
    }
    if (address !== undefined) updateData.address = address.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory ? medicalHistory.trim() : null;

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: updatedPatient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while updating patient',
    });
  }
};

const deletePatient = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID must be a positive integer',
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!patient || patient.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    if (prisma.patientDoctor && prisma.patientDoctor.deleteMany) {
      await prisma.patientDoctor.deleteMany({ where: { patientId: id } });
    }
    await prisma.patient.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting patient',
    });
  }
};

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};
