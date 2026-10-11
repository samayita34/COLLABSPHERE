# COLLABSPHERE 
### Enterprise Real-Time Collaborative Workspace & Project Management Platform

COLLABSPHERE is a full-stack collaborative workspace platform designed to help teams manage projects, organize tasks, share documents and files, and communicate in one centralized environment.

The platform aims to improve team productivity through project tracking, role-based access control, real-time updates, and a unified workspace for collaboration.

##  Key Features

- **Authentication & Authorization** — User registration, login, session management, and role-based access control.
- **Organization & Workspace Management** — Organize users and projects into structured workspaces.
- **Project Management** — Create, view, update, and manage projects.
- **Kanban Task Board** — Track tasks by status, priority, due date, and assignee.
- **Task Management** — Create and update tasks and monitor progress across projects.
- **Collaborative Documents** — Create, edit, and manage project documents with a rich-text editor.
- **Real-Time Project Chat** — Communicate with team members through project messaging.
- **File Management** — Upload, view, and manage files associated with projects.
- **Workspace Dashboard** — View project statistics, recent activity, and task summaries.
- **My Tasks** — Access tasks assigned to the current user across projects.

> Note: Features under active development may not be fully implemented. Refer to the project roadmap for planned improvements.

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Redux Toolkit
- React Query
- React Router
- TipTap
- Socket.IO Client

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- Socket.IO
- JSON Web Tokens (JWT)

### Database & Infrastructure
- PostgreSQL
- Redis
- Docker (planned / where configured)

##  Architecture

COLLABSPHERE follows a client-server architecture.

1. The **React frontend** provides the user interface for projects, tasks, documents, files, and chat.
2. The **Express backend** exposes REST APIs and handles authentication, business logic, and authorization.
3. **PostgreSQL** stores persistent application data through Prisma ORM.
4. **Socket.IO** supports real-time communication and application updates.
5. **Redis** can be used for caching and other performance-related operations where configured.

##  Main Modules

| Module | Purpose |
|---|---|
| Authentication | User access and session management |
| Workspaces | Organize teams and projects |
| Projects | Manage project information |
| Tasks | Track work using task boards |
| Documents | Create and edit project documents |
| Files | Upload and manage project files |
| Messaging | Enable project communication |
| Dashboard | Display workspace and project summaries |

## ⚙️ Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- PostgreSQL
- Redis, if required by your current configuration
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/COLLABSPHERE.git
cd COLLABSPHERE
```

Replace `YOUR_USERNAME` with your GitHub username and use the exact repository URL.

### 2. Install dependencies

Install the frontend and backend dependencies separately:

```bash
cd frontend
npm install
```

Then install backend dependencies:

```bash
cd ../backend
npm install
```

> If your frontend directory has a different name, use the actual directory name in your repository.

### 3. Configure environment variables

Create the required `.env` files for the backend and frontend based on the variables used in your code.

Typical backend configuration may include:

```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="your_secret_key"
REDIS_URL="your_redis_connection_string"
```

Use the exact variable names expected by your application. Add any required OAuth, email, or frontend API URL settings if configured.

**Never commit real passwords, API keys, tokens, or other secrets to GitHub.**

### 4. Set up the database

Run the Prisma commands configured for your project. For example:

```bash
npx prisma generate
npx prisma migrate dev
```

Run these commands from the backend directory if that is where your Prisma schema and configuration are located. Use your existing migration workflow if the project has already been initialized.

### 5. Start the application

Start the backend using the script defined in its `package.json`, for example:

```bash
npm run dev
```

Start the frontend in a separate terminal using its configured development script:

```bash
npm run dev
```

Check the terminal output for the local URLs and open the frontend URL in your browser.

## Security

The project incorporates or is designed to support security measures such as:

- Authentication and protected routes
- Role-based authorization
- Secure session and token handling
- Input validation
- Environment-based configuration
- Access control for workspace resources

The exact security guarantees depend on the current implementation and deployment configuration.

## Roadmap

Planned improvements include:

- [ ] Persistent in-app notification center
- [ ] Detailed audit logs and activity history
- [ ] Global search across workspace resources
- [ ] Advanced analytics and reporting
- [ ] Enhanced task discussions and collaboration
- [ ] Document version history and simultaneous collaborative editing
- [ ] Advanced file permissions and version management
- [ ] Expanded direct messaging and chat features
- [ ] Automated testing and CI/CD improvements
- [ ] Production deployment and monitoring

## Project Objective

The objective of COLLABSPHERE is to bring project management and team collaboration into a unified platform. By combining task tracking, document management, file sharing, messaging, and real-time updates, the project aims to provide a scalable foundation for collaborative work.

## Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your changes.
5. Submit a pull request.
