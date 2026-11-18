# OpenSlot — Appointment Booking System

A full-stack appointment booking application built with HTML, CSS, JavaScript, Node.js, Express and SQLite. The visual system uses **only** the supplied Burgundy / Dusty Rose palette.

## Features

### User
- Register and sign in
- Protected user dashboard
- Browse upcoming dates with available slots
- Select a time and submit an appointment request
- View booking history and status
- Cancel pending or approved appointments

### Admin
- Admin dashboard with booking statistics
- Add appointment dates and time slots
- View all appointment requests
- Approve, reject or reopen requests
- Remove unused availability slots

### Booking rules
- A slot cannot have more than one active (`pending` or `approved`) booking.
- The server checks availability at booking time, not only in the browser.
- SQLite stores users, slots and appointment records.
- Passwords are hashed with bcryptjs; protected APIs use JWT authentication.

## Requirements
- Node.js 18 or newer
- npm

## Run locally

1. Extract the ZIP and open the project folder in VS Code.
2. Open a terminal in this folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Optional: copy `.env.example` to `.env` and set a private `JWT_SECRET`.
5. Start the server:

   ```bash
   npm start
   ```

6. Open **http://localhost:5000**.

The SQLite database (`appointments.db`) is created automatically on first run, along with demo availability for the next 14 days.

## Demo admin account

- Email: `admin@OpenSlot.com`
- Password: `Admin@123`

Register a separate user account to test the customer booking flow.

## Project structure

```text
appointment-booking-system/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── database.js
├── server.js
├── package.json
├── .env.example
└── README.md
```

## Database tables

- `users`: name, email, hashed password and role
- `slots`: date, start time and end time (unique per date/time)
- `appointments`: user, slot, reason, status and creation timestamp

## Important production notes

This is a working local project suitable for learning and demonstration. Before public deployment:
- Set a strong `JWT_SECRET` in environment variables.
- Use HTTPS and configure a strict CORS policy.
- Add rate limiting, email verification and password reset.
- Add pagination and audit logging for admin actions.
- Use managed persistent storage for SQLite or migrate to PostgreSQL for multi-instance hosting.
- Add CSRF protections if authentication is changed to cookies.
