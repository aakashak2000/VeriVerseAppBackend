# VeriVerse

## Overview

VeriVerse is an AI-powered misinformation detection platform that combines agentic AI verification with community trust mechanisms. Users can submit claims or headlines, which are then verified by AI agents using multiple tools (search, web crawling, etc.), and community members can vote on the accuracy of the results. The platform features a leaderboard system to gamify community participation and reward accurate reviewers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, built using Vite as the build tool and development server.

**UI System**: The application uses shadcn/ui components built on Radix UI primitives, styled with TailwindCSS. The design follows a minimal, productivity-focused aesthetic with a strict color palette:
- Background: #F8FAFC (light gray/blue)
- Text: #0F172A (near-black)
- Accent: #2563EB (soft blue)

**Routing**: Client-side routing implemented with Wouter library. Three main routes:
- `/` - Landing page with hero section and product overview
- `/ask` - Interactive claim verification interface
- `/verify` - Community leaderboard and trust board

**State Management**: React Query (@tanstack/react-query) for server state management with configured defaults for refetching behavior and stale time.

**Component Structure**:
- `ClaimInputCard`: Form for submitting claims with loading states
- `ResultCard`: Displays verification results with status badges, confidence scores, votes, and evidence
- `LeaderboardTable`: Shows top community reviewers with tier badges
- `HowItWorks`: Three-step process visualization
- `CounterMetric`: Animated counter for statistics display

### Backend Architecture

**Server Framework**: Express.js server with TypeScript, serving both API endpoints and static assets.

**Proxy Pattern**: The Express backend acts as a proxy to a separate FastAPI service (configurable via `FASTAPI_BASE` environment variable, defaults to `http://localhost:8000`). All `/api/*` routes are forwarded to the FastAPI backend.

**API Endpoints** (proxied):
- `POST /api/prompts` - Submit new claims for verification
- `GET /api/runs/:runId` - Poll verification status and results
- `GET /api/leaderboard` - Retrieve community trust rankings

**Fallback/Demo Mode**: The frontend API client (`client/src/lib/api.ts`) includes built-in demo data that activates when the FastAPI backend is unavailable, ensuring the application remains functional for demonstration purposes.

**Session Management**: Infrastructure in place for session handling using `connect-pg-simple` for PostgreSQL-backed sessions, though not actively used in current implementation.

**Build Process**: Custom build script (`script/build.ts`) that:
- Bundles frontend with Vite
- Bundles server with esbuild
- Selectively bundles dependencies to reduce cold start times
- Produces production-ready artifacts in `dist/`

### Data Storage

**Database ORM**: Drizzle ORM configured for PostgreSQL (via `@neondatabase/serverless` driver).

**Schema** (defined in `shared/schema.ts`):
- `users` table with id, username, and password fields
- TypeScript types for Vote, Evidence, RunState, LeaderboardEntry, and Leaderboard
- Zod schemas for validation using `drizzle-zod`

**Storage Abstraction**: `IStorage` interface in `server/storage.ts` with in-memory implementation (`MemStorage`) for development. This abstraction allows swapping to database-backed storage without changing business logic.

**Database Configuration**: Drizzle Kit configured to generate migrations in `./migrations` directory, with schema source at `./shared/schema.ts`.

### Design System

**Component Library**: shadcn/ui "new-york" style variant with customized configuration:
- Custom border radius values (9px, 6px, 3px)
- Extended color system using HSL with CSS custom properties
- Consistent hover and active states using elevation utilities
- Dark mode support via class-based theme switching

**Typography**: No custom fonts bundled; relies on system fonts with fallbacks defined in CSS custom properties.

**Spacing System**: Tailwind default spacing scale (4, 6, 8, 12, 16) with generous whitespace emphasis per design guidelines.

## External Dependencies

### Third-Party UI Libraries
- **Radix UI**: Complete suite of headless UI primitives for accessible components (dialogs, dropdowns, tooltips, etc.)
- **Lucide React**: Icon library for consistent iconography
- **cmdk**: Command palette component
- **vaul**: Drawer component
- **embla-carousel-react**: Carousel functionality

### Utility Libraries
- **class-variance-authority**: Component variant management
- **clsx** & **tailwind-merge**: Utility for merging Tailwind classes
- **date-fns**: Date manipulation and formatting
- **nanoid**: Unique ID generation

### Database & API
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **Drizzle ORM**: Type-safe ORM with PostgreSQL dialect
- **FastAPI Backend**: External microservice (not in this repository) that handles AI agent orchestration and verification logic

### Development Tools
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server-side bundler for production builds
- **TypeScript**: Type safety across frontend and backend
- **tsx**: TypeScript execution for development and build scripts

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal`: Error overlay for development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development banner

### Backend Services (Expected)
- **FastAPI Service**: Separate Python-based service (configured via `FASTAPI_BASE` environment variable) that provides:
  - Claim verification endpoints
  - AI agent orchestration
  - Tool integration (Google Search, web crawler, etc.)
  - Vote management
  - Leaderboard calculation

### Notes on Architecture
- The application is designed to gracefully degrade when the FastAPI backend is unavailable, using demo data to maintain functionality
- PostgreSQL database may be added later; Drizzle ORM is configured but storage currently uses in-memory implementation
- Session management infrastructure exists but is not actively used in the current implementation