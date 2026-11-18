# TaskFlow

Full-stack task manager built with the MERN stack.

## Features
- JWT authentication (register, login, protected routes)
- Password hashing with bcrypt
- Task CRUD with priority, status and due dates
- Search and filter by status and priority
- Live stats dashboard with completion progress
- Overdue task detection
- Responsive dark UI

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Axios |
| Backend | Node.js, Express, JWT, bcryptjs |
| Database | MongoDB Atlas, Mongoose |
| Hosting | Vercel (frontend), Render (backend) |

## Live Demo
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-api.onrender.com`

## API
| Method | Endpoint | Auth |
|---|---|---|
| POST | /api/auth/register | No |
| POST | /api/auth/login | No |
| GET | /api/auth/me | Yes |
| GET | /api/tasks?status=&priority=&search= | Yes |
| GET | /api/tasks/stats | Yes |
| POST | /api/tasks | Yes |
| PUT | /api/tasks/:id | Yes |
| DELETE | /api/tasks/:id | Yes |

## Run Locally
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Author
Jaya Ram
