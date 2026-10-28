const prisma = require('../config/prisma');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

const createDoctor = async (req, res) => {
  try {
    const { name, specialization, email, phone, address } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Doctor name is required (at least 2 characters)',
        errors: ['Doctor name is required (at least 2 characters)'],
      });
    }

    if (!specialization || typeof specialization !== 'string' || specialization.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Specialization is required',
        errors: ['Specialization is required'],
      });
    }

    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        errors: ['Please provide a valid email address'],
      });
    }

    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number',
        errors: ['Please provide a valid phone number'],
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingDoctor = await prisma.doctor.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: 'A doctor with this email already exists',
      });
    }

    const doctor = await prisma.doctor.create({
      data: {
        name: name.trim(),
        specialization: specialization.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        address: address ? address.trim() : null,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor created successfully',
      data: doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while creating doctor',
    });
  }
};

const getAllDoctors = async (req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching doctors',
    });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID must be a positive integer',
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Doctor retrieved successfully',
      data: doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor',
    });
  }
};

const updateDoctor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID must be a positive integer',
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    if (doctor.createdById !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to update this doctor',
      });
    }

    const { name, specialization, email, phone, address } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (specialization !== undefined) updateData.specialization = specialization.trim();
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Invalid email' });
      }
      if (normalizedEmail !== doctor.email) {
        const emailInUse = await prisma.doctor.findUnique({
          where: { email: normalizedEmail },
        });
        if (emailInUse) {
          return res.status(409).json({ success: false, message: 'A doctor with this email already exists' });
        }
      }
      updateData.email = normalizedEmail;
    }
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address ? address.trim() : null;

    const updatedDoctor = await prisma.doctor.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Doctor updated successfully',
      data: updatedDoctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while updating doctor',
    });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID must be a positive integer',
      });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    if (doctor.createdById !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to delete this doctor',
      });
    }

    if (prisma.patientDoctor && prisma.patientDoctor.deleteMany) {
      await prisma.patientDoctor.deleteMany({ where: { doctorId: id } });
    }
    await prisma.doctor.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Doctor deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting doctor',
    });
  }
};

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
};
