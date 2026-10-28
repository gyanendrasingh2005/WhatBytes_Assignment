const prisma = require('../config/prisma');

const createMapping = async (req, res) => {
  try {
    const patientId = parseInt(req.body.patientId, 10);
    const doctorId = parseInt(req.body.doctorId, 10);

    if (isNaN(patientId) || patientId <= 0 || isNaN(doctorId) || doctorId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive integer patientId and doctorId are required',
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient || patient.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or you do not have permission to manage this patient',
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    const existingMapping = await prisma.patientDoctor.findUnique({
      where: {
        patientId_doctorId_unique: {
          patientId,
          doctorId,
        },
      },
    });

    if (existingMapping) {
      return res.status(409).json({
        success: false,
        message: 'Doctor is already assigned to this patient',
      });
    }

    const mapping = await prisma.patientDoctor.create({
      data: {
        patientId,
        doctorId,
        createdById: req.user.id,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
          },
        },
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
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor assigned to patient successfully',
      data: mapping,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while creating mapping',
    });
  }
};

const getUserMappings = async (req, res) => {
  try {
    const mappings = await prisma.patientDoctor.findMany({
      where: { createdById: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            phone: true,
          },
        },
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
    });

    return res.status(200).json({
      success: true,
      message: 'Mappings retrieved successfully',
      data: mappings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching mappings',
    });
  }
};

const getDoctorsForPatient = async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId, 10);
    if (isNaN(patientId) || patientId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID must be a positive integer',
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient || patient.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    const mappings = await prisma.patientDoctor.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
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
    });

    return res.status(200).json({
      success: true,
      message: 'Assigned doctors retrieved successfully',
      data: {
        patient: {
          id: patient.id,
          name: patient.name,
        },
        doctors: mappings.map((m) => ({
          mappingId: m.id,
          assignedAt: m.createdAt,
          doctor: m.doctor,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching assigned doctors',
    });
  }
};

const deleteMapping = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Mapping ID must be a positive integer',
      });
    }

    const mapping = await prisma.patientDoctor.findUnique({
      where: { id },
    });

    if (!mapping || mapping.createdById !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient-doctor assignment not found',
      });
    }

    await prisma.patientDoctor.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Patient-doctor assignment removed successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting assignment',
    });
  }
};

module.exports = {
  createMapping,
  getUserMappings,
  getDoctorsForPatient,
  deleteMapping,
};
