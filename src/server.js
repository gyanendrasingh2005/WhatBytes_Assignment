require('dotenv').config();

const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET must be defined in your .env file');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`Healthcare API server running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
