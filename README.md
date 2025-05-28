# Recovery Office Booking System Backend

This is the backend API service for the Recovery Office booking system. It provides endpoints for services, time slots, bookings, and clients.

## Technology Stack

- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **MongoDB**: Database
- **Mongoose**: MongoDB object modeling
- **JWT**: Authentication
- **Jest**: Testing

## Project Structure

```
backend/
├── src/
│   ├── controllers/        # Route controllers
│   ├── models/             # Mongoose models
│   ├── routes/             # Express routes
│   ├── middleware/         # Express middleware
│   ├── scripts/            # Utility scripts (e.g., seeding)
│   ├── utils/              # Utility functions
│   └── server.js           # Main Express app
├── .env                    # Environment variables
├── .env.example            # Example environment variables
└── package.json            # Project dependencies
```

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB (v4+)

### Installation

1. Clone the repository
2. Navigate to the backend directory
   ```
   cd recovery-office/backend
   ```
3. Install dependencies
   ```
   npm install
   ```
4. Copy the example environment file and update it with your settings
   ```
   cp .env.example .env
   ```
5. Update the `.env` file with your MongoDB connection string and other settings

### Running the Server

#### Development Mode

```
npm run dev
```

The server will run on `http://localhost:5000` (or the port specified in your .env file) with hot reloading enabled.

#### Production Mode

```
npm start
```

### Seeding the Database

To populate the database with initial data (services and time slots):

```
npm run seed
```

This will create:
- 5 sample services (Initial Consultation, Investment Fraud Recovery, etc.)
- Available time slots for the next 30 days

## API Endpoints

### Services

- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get a specific service by ID
- `POST /api/services` - Create a new service (admin)
- `PUT /api/services/:id` - Update a service (admin)
- `DELETE /api/services/:id` - Delete a service (admin)

### Time Slots

- `GET /api/slots?serviceId=&date=` - Get available time slots for a service on a specific date
- `POST /api/slots/generate` - Generate time slots for a date range (admin)
- `PATCH /api/slots/:id` - Update a time slot's availability (admin)
- `DELETE /api/slots/:id` - Delete a time slot (admin)

### Bookings

- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/:id` - Get a booking by ID
- `PATCH /api/bookings/:id` - Update a booking
- `DELETE /api/bookings/:id` - Cancel a booking

### Clients

- `POST /api/clients` - Register a new client during booking
- `GET /api/clients/:id` - Get client details (authenticated)

## Testing

Run tests with:

```
npm test
```

## Deployment

The backend is designed to be deployed on any Node.js hosting platform:

- Heroku
- AWS
- Google Cloud
- Netlify Functions
- Vercel

## Integration with Frontend

To connect this backend with the Recovery Office frontend:

1. Ensure the backend is running
2. Update the frontend API configuration to point to this backend's URL
3. Test the booking flow end-to-end 