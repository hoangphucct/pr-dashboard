# PR Cycle-Time Dashboard

A full-stack application to track and visualize Pull Request cycle time metrics from GitHub.

## Features

- **Calculate PR Metrics**: Automatically calculates 4 key metrics:
  - **Commit to Open**: Time from first commit to when PR was opened
  - **Open to Review**: Time from PR open to first review comment
  - **Review to Approval**: Time from first review comment to last approval
  - **Approval to Merge**: Time from last approval to merge

- **Data Storage**: Saves metrics as JSON files, one per day

- **Historical Data**: View metrics from previous days

- **Visualization**: Interactive charts showing workflow timeline for each PR

- **Raw Data Scraping**: Scrape PR data from Findy Team analytics

- **Workflow Validation**: Detect issues in PR workflow (missing steps, wrong order, abnormal time)

## Tech Stack

### Backend
- **NestJS** - Node.js framework
- **TypeScript** - Type-safe JavaScript
- **Puppeteer** - Web scraping for Findy Team

### Frontend
- **Next.js 15** - React framework with App Router
- **NextUI** - UI component library
- **Tailwind CSS** - Utility-first CSS
- **React Query** - Data fetching and caching
- **Chart.js** - Data visualization

## Project Structure

```
pr-dashboard/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── dashboard/       # Dashboard API endpoints
│   │   ├── raw-data/        # Raw data API endpoints
│   │   ├── github/          # GitHub API integration
│   │   ├── pr/              # PR metrics calculation
│   │   ├── timeline/        # Timeline building
│   │   ├── workflow/        # Workflow validation
│   │   ├── storage/         # Data storage
│   │   ├── scraper/         # Web scraping
│   │   └── types/           # TypeScript types
│   ├── data/                # JSON data files (gitignored)
│   └── package.json
├── frontend/                # Next.js Frontend
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # API client & utilities
│   │   └── types/           # TypeScript types
│   └── package.json
├── docker-compose.yml       # Docker development setup
├── Dockerfile               # Backend Dockerfile
├── Dockerfile.frontend      # Frontend Dockerfile
└── README.md
```

## Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** & **Docker Compose** (optional, for containerized development)

## Installation

### Option 1: Local Development

#### 1. Clone the repository

```bash
git clone <repository-url>
cd pr-dashboard
```

#### 2. Setup Backend

```bash
cd backend
npm install
```

Create `.env` file in the `backend` directory:

```env
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repository-name
GITHUB_TOKEN=your-github-personal-access-token
PORT=3000
FRONTEND_URL=http://localhost:3001
API_KEY=your-secret-api-key-here
```

**Security Note:** Set `API_KEY` to a strong random string. This key is required to access protected API endpoints.

#### 3. Setup Frontend

```bash
cd frontend
npm install
```

Create `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
API_KEY=your-secret-api-key-here
```

**Note:** `API_KEY` must match the `API_KEY` set in the backend `.env` file.

#### 4. Run the applications

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

#### 5. Access the application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

---

### Option 2: Docker Development

#### 1. Clone the repository

```bash
git clone <repository-url>
cd pr-dashboard
```

#### 2. Create environment files

Create `backend/.env`:
```env
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repository-name
GITHUB_TOKEN=your-github-personal-access-token
```

#### 3. Start with Docker Compose

```bash
docker compose up -d
```

This will start:
- **Backend** on http://localhost:3000
- **Frontend** on http://localhost:3001

#### 4. View logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend
```

#### 5. Stop services

```bash
docker compose down
```

---

## Getting a GitHub Token

1. Go to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Select scopes:
   - `repo` - Full control of private repositories
4. Copy the token and add it to your `.env` file

## Usage

### Dashboard

1. Open http://localhost:3001/dashboard
2. Enter PR IDs (comma-separated), e.g., `1,2,3,4,5`
3. Click **"Get Data"** to fetch metrics from GitHub
4. View results in tables and charts
5. Click **"Details"** to see PR workflow timeline
6. Use date selector to view historical data

### Raw Data

1. Open http://localhost:3001/raw-data
2. Enter Findy Team URL
3. Click **"Process Raw Data"** to scrape and save data
4. Select saved files to view PR data

## Security Features

### API Key Authentication
- All protected endpoints require a valid API key
- API key can be sent via:
  - Header: `X-API-Key: your-api-key`
  - Header: `Authorization: Bearer your-api-key`

### Rate Limiting
- **10 requests per second** per IP
- **100 requests per minute** per IP
- **1000 requests per hour** per IP
- Prevents API abuse and DDoS attacks

### CORS Protection
- Only allows requests from configured `FRONTEND_URL`
- Blocks unauthorized cross-origin requests

### Security Headers
- Helmet.js security headers enabled
- Content Security Policy (CSP) configured
- XSS and clickjacking protection

### Development vs Production
- **Development**: If `API_KEY` is not set, API is accessible without authentication
- **Production**: `API_KEY` is **required** - all requests without valid key are rejected

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | API information page | No |
| GET | `/health` | Health check endpoint | No |

### Dashboard API (Protected)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/dashboard` | Get dashboard data for a date | Yes |
| POST | `/dashboard/get-data` | Fetch PR data from GitHub | Yes |
| GET | `/dashboard/timeline/:prNumber` | Get PR timeline | Yes |
| DELETE | `/dashboard/pr/:prNumber` | Delete PR from storage | Yes |

### Raw Data API (Protected)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/raw-data` | Get raw data files list | Yes |
| POST | `/raw-data` | Process raw data from Findy Team | Yes |

## Scripts

### Backend

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Linting
npm run lint

# Testing
npm run test
npm run test:e2e
```

### Frontend

```bash
# Development
npm run dev

# Production build
npm run build
npm run start

# Linting
npm run lint
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_OWNER` | GitHub username or organization | Yes |
| `GITHUB_REPO` | Repository name | Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes |
| `PORT` | API server port (default: 3000) | No |
| `FRONTEND_URL` | Frontend URL for CORS (default: http://localhost:3001) | No |
| `API_KEY` | API key for authentication (required for production) | No* |

\* If `API_KEY` is not set, API endpoints are accessible without authentication (development mode only).

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: http://localhost:3000) | Yes |
| `API_KEY` | API key for backend authentication (must match backend `API_KEY`) | No* |

\* Required if backend `API_KEY` is set.

## Troubleshooting

### CORS Errors

Make sure the `FRONTEND_URL` in backend `.env` matches your frontend URL.

### Puppeteer Issues (Docker)

The Docker images include Chromium for Puppeteer. If you encounter issues:

```bash
# Rebuild containers
docker compose build --no-cache
docker compose up -d
```

### Port Already in Use

Change ports in:
- Backend: `PORT` in `.env`
- Frontend: Update `package.json` dev script or use `PORT=3002 npm run dev`
- Docker: Update port mappings in `docker-compose.yml`

## License

MIT License
