# Sweety – Blood Glucose Tracker

Sweety lets users record blood glucose readings in four daily time slots.
Users can manage their readings and view daily and monthly reports for a selected date.

## Features

- Registration, login and logout with JWT authentication.
- Add, edit and delete whole-number readings from 40 to 600 mg/dL.
- One reading per slot per user per day, with date filtering and pagination.
- Daily, month-to-date and previous-month reports with minimum, maximum, average and count.
- Monthly trend charts, Docker Compose and backend/form tests.

## Tech Stack

- Frontend: React, Vite, JavaScript, Axios, Tailwind CSS and Recharts.
- Backend: Node.js, Express, PostgreSQL, pg, bcrypt and JWT.
- Tests: node:test, node:assert/strict, React Testing Library and jsdom.

## Setup

For local development, install Node.js 22.12 or newer and PostgreSQL 18. The PostgreSQL command-line tools should be on your PATH.

From the project root, copy the environment examples:

```powershell
Copy-Item .env.example server/.env
Copy-Item client/.env.example client/.env
```

Fill in `DATABASE_URL`, `TEST_DATABASE_URL` and `JWT_SECRET` in `server/.env`. The default API and frontend ports are 3000 and 5173. Generate a random JWT secret with:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Create separate application and test databases using your PostgreSQL account:

```powershell
createdb -U postgres sweety
createdb -U postgres sweety_test
```

Start the backend:

```powershell
cd server
npm ci
npm run db:init
npm run db:seed
npm run dev
```

In another terminal, start the frontend:

```powershell
cd client
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Run `npm run build` from `client` to create a production build.

### Docker

With Docker Desktop running Linux containers, copy `.env.docker.example` to `.env.docker`. Set a database password and a random JWT secret in that file. From the project root:

```powershell
docker compose --env-file .env.docker up --build --detach --wait
docker compose --env-file .env.docker exec backend npm run db:seed
```

Open [localhost:8080](http://localhost:8080). The Docker database is separate from the local PostgreSQL database. `docker compose --env-file .env.docker down` stops the containers and keeps their database volume.

With Docker running, `node scripts/testDocker.js` checks the frontend, API proxy, authentication, CRUD, pagination and reports. It creates a test account and removes its test reading after passing.

## Running Tests

From `server`, with `TEST_DATABASE_URL` configured in `server/.env`:

```powershell
node --env-file=.env --test
```

From `client`:

```powershell
npm test
```

Backend tests use isolated schemas in the dedicated test database. Form tests mock Axios and do not need a running backend.

## Demo Account

The seed script creates:

- Email: `demo@sweety.local`
- Password: `SweetyDemo123!`

The script also adds sample readings in all four slots from the start of the previous month through today. Rerunning it only fills missing slots; existing account details and readings are kept. These credentials are for development only.

## Screenshots

[Readings](screenshots/readings.jpg) · [Monthly report](screenshots/monthly-report.jpg) · [Mobile form](screenshots/mobile-form.jpg)

The screenshots use sample data from an isolated test database.

## Notes

- The four slots are Morning (fasting), After breakfast, After lunch and After dinner.
- Dates use India Standard Time and cannot be in the future. All report periods follow the selected report date. Averages are rounded to one decimal place.
- Database initialization upgrades whole-number legacy readings to INTEGER. If fractional readings exist, it stops without changing them. Review and correct those records explicitly before rerunning initialization.
- Docker is configured for local HTTP use. There is no public deployment.
- With more time, I would add password reset, login rate limiting and CSV report downloads.
