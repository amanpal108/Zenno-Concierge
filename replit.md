# Zenno Concierge - AI-Powered Saree Shopping Assistant

## Overview

Zenno Concierge is a sophisticated AI-powered shopping assistant that helps users in India find and purchase authentic Banarasi sarees through natural conversation. The application combines conversational AI, real-time vendor discovery, automated phone negotiations in Hindi, and cryptocurrency-based payments to create a seamless end-to-end purchasing experience.

The system orchestrates a complete purchase journey: from understanding user preferences through chat, to finding nearby vendors via Google Places API, making actual phone calls to negotiate prices using Twilio, and processing payments through USDC (via Locus wallet on Base blockchain) with vendor payouts via Stripe.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type safety
- Vite as the build tool and development server
- TailwindCSS with shadcn/ui component library (New York style)
- Wouter for lightweight client-side routing
- TanStack Query for server state management and real-time polling

**Design System:**
- Hybrid approach combining Material Design 3 principles with ChatGPT/Claude-inspired chat interface patterns
- Custom color system with HSL-based theming supporting light/dark modes
- Typography: Inter and SF Pro Display fonts with semantic sizing (xs to 5xl)
- Spacing based on Tailwind's 2/4/6/8/12/16 unit system
- Component elevation system using subtle shadows and hover states

**State Management:**
- Session-based architecture with server-driven state
- 3-second polling interval for real-time updates (call status, payment processing)
- Local optimistic updates for immediate UI feedback
- React Query cache for efficient data synchronization

**Layout Structure:**
- Responsive two-column layout (sidebar + main chat area on desktop)
- Fixed-width sidebar (320px) for vendor lists and journey timeline
- Main content area with max-width constraint (4xl) for optimal readability
- Mobile: single column with collapsible drawer sidebar

### Backend Architecture

**Technology Stack:**
- Express.js with TypeScript
- Session management using in-memory storage (MemStorage pattern with extensibility for database backing)
- Zod for runtime schema validation
- Drizzle ORM configured for PostgreSQL (via Neon serverless)

**API Design:**
- RESTful endpoints organized by domain (chat, vendors, calls, payments, TTS)
- Request/response validation using shared Zod schemas
- Centralized error handling and logging middleware
- Session-based state persistence across requests

**Service Layer Pattern:**
Each external integration is isolated in its own service module with consistent error handling:

1. **Anthropic Service** (`anthropic.ts`):
   - Uses Claude Sonnet 4 for conversational AI
   - Context-aware responses based on journey status and available vendors
   - Fallback responses when API key not configured

2. **ElevenLabs Service** (`elevenlabs.ts`):
   - Text-to-speech generation for English responses to users
   - Streaming audio support for real-time playback
   - Monolingual model for consistent voice quality

3. **Twilio Service** (`twilio.ts`):
   - Real outbound call orchestration to vendor phone numbers
   - Webhook-based status tracking (initiated, ringing, answered, completed)
   - TwiML URL handling for call flow control
   - Hindi language support for vendor negotiations

4. **Google Places Service** (`google-places.ts`):
   - Vendor discovery based on location and search queries
   - Mock vendor fallback when API key not available (3 Varanasi-based saree vendors)
   - Distance calculation and rating integration

5. **Locus Wallet Service** (`locus.ts`):
   - USDC transactions on Base blockchain
   - Real API integration with simulated fallback for development
   - Transaction hash tracking and status monitoring

6. **Stripe Service** (`stripe.ts`):
   - Vendor payout processing in test mode
   - Transfer/payout intent creation for merchant settlements
   - Metadata tracking for transaction correlation

### Data Models

**Core Entities** (defined in `shared/schema.ts`):

1. **Session**: Central state container
   - Unique ID, message history, vendor list
   - Journey status tracking (chatting → searching-vendors → selecting-vendor → calling-vendor → processing-payment → completed)
   - References to current call and transaction

2. **Message**: Chat conversation unit
   - Role-based (user/assistant)
   - Timestamp for chronological ordering

3. **Vendor**: Merchant information
   - Google Places integration (placeId, rating)
   - Contact details (name, address, phone)
   - Distance calculation from user

4. **Call**: Telephony session state
   - Status progression (initiating → ringing → in-progress → negotiating → completed/failed)
   - Negotiated price tracking
   - Transcript storage for audit trail

5. **Transaction**: Payment record
   - Multi-stage status (pending → processing → completed/failed)
   - Dual tracking: USDC blockchain hash + Stripe payout ID
   - Amount and currency metadata

### Database Schema

**Drizzle ORM Configuration:**
- PostgreSQL dialect via Neon serverless driver
- Schema location: `shared/schema.ts`
- Migration output: `./migrations`
- Connection via `DATABASE_URL` environment variable
- Fail-fast validation if database not provisioned

**Note**: The application currently uses in-memory storage but is architected for easy migration to PostgreSQL persistence. The schema types and Drizzle configuration are in place for future database integration.

### Authentication & Authorization

The current MVP does not implement authentication. Sessions are created on-demand and accessed via session ID. For production deployment, this should be enhanced with:
- User authentication (e.g., phone OTP, OAuth)
- Session-to-user binding
- Rate limiting per user
- Transaction history access control

### Real-time Updates

**Polling Strategy:**
- Client polls `/api/session/:sessionId` every 3 seconds
- Server pushes state changes (new messages, vendor updates, call status, payment status)
- Optimizes for simplicity over WebSocket complexity for MVP
- React Query handles automatic refetching and cache invalidation

## External Dependencies

### AI & Voice Services

1. **Anthropic Claude API**
   - Model: `claude-sonnet-4-20250514`
   - Purpose: Conversational AI reasoning and response generation
   - Context window: Conversation history + journey status + vendor list
   - Fallback: Generic helpful responses when API key missing

2. **ElevenLabs Text-to-Speech**
   - Voice: Default English monolingual model
   - Purpose: Audio responses for user messages
   - Streaming support for real-time playback
   - API key: `ELEVENLABS_API_KEY`

### Telephony

**Twilio**
- Outbound calling to vendor phone numbers
- Real-time status webhooks (initiated, ringing, answered, completed)
- TwiML-based call flow for Hindi negotiations
- Credentials: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Validation: Account SID must start with "AC" for production

### Maps & Location

**Google Places API**
- Vendor discovery via text search
- Place details retrieval (rating, contact info, location)
- Fallback: 3 mock Varanasi saree vendors when `GOOGLE_PLACES_API_KEY` not configured
- Mock data includes realistic addresses and phone numbers

### Payment Infrastructure

1. **Locus Wallet (USDC on Base)**
   - Network: Base blockchain
   - Token: USDC stablecoin
   - Purpose: User-to-escrow payment
   - Credentials: `LOCUS_API_KEY`, `LOCUS_WALLET_ID`
   - Returns: Transaction hash on blockchain

2. **Stripe**
   - API Version: `2024-12-18.acacia`
   - Mode: Test mode for MVP
   - Purpose: Vendor payouts (merchant settlement)
   - Credential: `STRIPE_SECRET_KEY`
   - Fallback: Payout intent simulation when connected account unavailable

### Development Tools

1. **Replit Integration**
   - Vite plugins for dev banner and error overlay
   - Cartographer for code navigation
   - Runtime error modal in development

2. **Build Pipeline**
   - Vite for frontend bundling
   - esbuild for server-side bundling
   - TypeScript compilation with strict mode
   - Path aliases: `@/` (client), `@shared/` (shared schemas), `@assets/` (attached files)

### Environment Variables

**Mandatory for Production:**
- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: Claude API access
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `LOCUS_API_KEY`, `LOCUS_WALLET_ID`
- `STRIPE_SECRET_KEY`

**Optional (with fallbacks):**
- `ELEVENLABS_API_KEY`: TTS generation (graceful degradation)
- `GOOGLE_PLACES_API_KEY`: Vendor search (uses mock data)

### Fail-Fast Configuration

The application validates mandatory environment variables at startup:
- Database URL checked in `drizzle.config.ts`
- API credentials validated in respective service modules
- Missing credentials trigger clear error messages rather than silent failures