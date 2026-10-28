# Healthcare Backend REST API

A clean, minimal, and secure Healthcare REST API built using **Node.js**, **Express.js**, **PostgreSQL**, and **Prisma ORM**.

---

## 1. Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Security**: Helmet, CORS, express-rate-limit

---

## 2. Project Structure

```
healthcare-backend/
├── prisma/
│   └── schema.prisma              # Database models and relations
├── src/
│   ├── config/
│   │   └── prisma.js              # Prisma Client instance
│   ├── controllers/
│   │   ├── auth.controller.js     # User registration and login
│   │   ├── patient.controller.js  # Patient CRUD and ownership checks
│   │   ├── doctor.controller.js   # Doctor CRUD and creator permissions
│   │   └── mapping.controller.js  # Patient-doctor assignments
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── routes/
│   │   ├── auth.routes.js         # /api/auth routes
│   │   ├── patient.routes.js      # /api/patients routes
│   │   ├── doctor.routes.js       # /api/doctors routes
│   │   └── mapping.routes.js      # /api/mappings routes
│   ├── app.js                     # Express app setup and route mounting
│   └── server.js                  # Server startup and environment check
├── tests/                         # Automated test suite
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
├── package.json                   # Scripts and dependencies
├── postman_collection.json        # Postman test collection
└── README.md
```

---

## 3. Database Models & Relationships

- **User**: Represents registered medical staff/users. Has one-to-many relationships with Patients, Doctors, and Mappings.
- **Patient**: Owned by the user who created it (`createdById`). Only the creator can view, update, or delete their patient records.
- **Doctor**: Publicly readable by all authenticated users, but can only be updated or deleted by the user who created the record.
- **PatientDoctor**: Maps a patient to a doctor. Contains a composite unique constraint `@@unique([patientId, doctorId])` to prevent duplicate doctor assignments to the same patient. Deletes automatically on cascade if a patient or doctor is deleted.

---

## 4. Setup & Installation (Windows PowerShell)

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Configure Environment Variables
Create `.env` from `.env.example`:
```powershell
Copy-Item .env.example .env
```
Ensure your `.env` contains:
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/healthcare_db?schema=public"
JWT_SECRET="your_jwt_secret_key"
JWT_EXPIRES_IN="1h"
```

### Step 3: PostgreSQL Database Setup

- **Local PostgreSQL**:
  ```powershell
  psql -U postgres -c "CREATE DATABASE healthcare_db;"
  ```
- **Free Cloud PostgreSQL (Neon)**:
  Create a free database at [neon.tech](https://neon.tech) and paste the provided connection string into `DATABASE_URL` in `.env`.

### Step 4: Run Prisma Schema & Migrations
```powershell
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

### Step 5: Start the Server
```powershell
# Development mode (nodemon auto-reload):
npm run dev

# Production mode:
npm start
```
The server will run on `http://localhost:5000`.

To inspect the database using Prisma's visual GUI:
```powershell
npm run db:studio
```

---

## 5. API Endpoints

### Public Endpoints
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint |
| `POST` | `/api/auth/register` | Register new user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Login user and obtain JWT token |

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

#### Patient Management (Private to Creator)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/patients` | Create patient (`name`, `age`, `gender`, `address`, `phone`, `medicalHistory`) |
| `GET` | `/api/patients` | Retrieve all patients owned by current user |
| `GET` | `/api/patients/:id` | Retrieve specific patient by ID |
| `PUT` | `/api/patients/:id` | Update patient record |
| `DELETE`| `/api/patients/:id` | Delete patient record |

#### Doctor Management (Creator Edit/Delete)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/doctors` | Create doctor (`name`, `specialization`, `email`, `phone`, `address`) |
| `GET` | `/api/doctors` | Retrieve all registered doctors |
| `GET` | `/api/doctors/:id` | Retrieve specific doctor by ID |
| `PUT` | `/api/doctors/:id` | Update doctor (creator only) |
| `DELETE`| `/api/doctors/:id` | Delete doctor (creator only) |

#### Patient-Doctor Assignments
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/mappings` | Assign doctor to patient (`patientId`, `doctorId`) |
| `GET` | `/api/mappings` | Retrieve all assignments created by current user |
| `GET` | `/api/mappings/:patientId` | Retrieve all doctors assigned to a patient |
| `DELETE`| `/api/mappings/:id` | Remove patient-doctor assignment |

---

## 6. JWT Authentication

1. Send a POST request to `/api/auth/login` with `email` and `password`.
2. Copy the returned `accessToken` from the response.
3. For all protected routes, include the following header:
   ```
   Authorization: Bearer <accessToken>
   ```

---

## 7. Testing with Postman

1. Open Postman and click **Import**.
2. Select `postman_collection.json` located in the root of this project.
3. The collection includes predefined tests for registration, login, patient CRUD, doctor CRUD, assignments, and error scenarios.
4. When you run `Login User`, the token is automatically stored in the collection variable `token` and used for subsequent requests.

---

## 8. Running Automated Tests

Run the full test suite with Jest:
```powershell
npm test
```
All 41 tests validate route handling, authentication, ownership rules, duplicate prevention, and status codes.
