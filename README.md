# Zenno Concierge - AI-Powered Saree Shopping Assistant 🥻

An innovative AI concierge service that helps users in India purchase authentic Banarasi sarees through natural conversation, automated vendor discovery, phone negotiations in Hindi, and seamless cryptocurrency payments.

## 🌟 Features

### Conversational AI Shopping
- Natural language chat interface powered by Anthropic Claude
- Personalized saree recommendations based on preferences
- Real-time vendor discovery and selection
- Journey-based shopping experience

### Smart Vendor Discovery
- Finds authentic Banarasi saree vendors near you
- Displays vendor ratings and locations
- Interactive vendor carousel for easy selection
- Mock vendors available for testing

### Automated Phone Negotiations (Mock Mode)
- Simulated Hindi language negotiations with vendors
- Real-time call status tracking
- Automatic price negotiation (20-40% discounts)
- Complete call flow simulation for demos

### Simplified Payment System
- **Special Offer**: Flat $1 USDC payment for any saree
- Starting balance of $10 USDC for testing
- Secure blockchain-based transactions
- Clear payment approval flow

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Replit account (for deployment)

### Environment Variables

Create a `.env` file with the following:

```bash
# AI Services
ANTHROPIC_API_KEY=your_anthropic_key
ELEVENLABS_API_KEY=your_elevenlabs_key (optional)

# Maps & Location
GOOGLE_PLACES_API_KEY=your_google_places_key (optional)

# Payment Services  
LOCUS_API_KEY=your_locus_key
LOCUS_WALLET_ID=your_wallet_id
STRIPE_SECRET_KEY=your_stripe_key

# Telephony (Currently using mock)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Session
SESSION_SECRET=your_session_secret
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## 💬 How to Use

### 1. Start a Conversation
- Open the application in your browser
- Type "I want to buy a Banarasi saree" to begin
- The AI will ask about your preferences (city, colors, occasion, budget)

### 2. Browse Vendors
- View discovered vendors in the interactive carousel
- Each vendor shows ratings, location, and distance
- Click "Select & Call" on your preferred vendor

### 3. Automated Negotiation (Mock)
- Watch real-time call status updates
- Call progresses through: Ringing → In Progress → Negotiating → Completed
- Receive negotiated price (typically ₹480-640)

### 4. Payment Approval
- Review the negotiated price
- Pay only $1 USDC (promotional flat rate)
- See remaining wallet balance
- Click "Approve Payment" to proceed

### 5. Transaction Complete
- Payment processes automatically
- Receive confirmation message
- Transaction details saved in sidebar

## 🏗️ Architecture

### Frontend
- **React + TypeScript**: Type-safe component development
- **TailwindCSS + shadcn/ui**: Modern, responsive UI
- **Wouter**: Lightweight routing
- **TanStack Query**: Server state management
- **Real-time polling**: 3-second intervals for updates

### Backend
- **Express.js**: RESTful API server
- **In-memory storage**: Session-based state management
- **Zod validation**: Runtime type checking
- **Service layer pattern**: Isolated integrations

### External Services
- **Anthropic Claude**: Conversational AI
- **ElevenLabs**: Text-to-speech (optional)
- **Google Places**: Vendor discovery (optional, falls back to mocks)
- **Twilio**: Phone calls (currently mocked)
- **Locus Wallet**: USDC on Base blockchain
- **Stripe**: Vendor payouts

## 🧪 Test Mode Features

The application includes a comprehensive mock mode for testing:

- **Mock Vendors**: 3 pre-configured Varanasi saree shops
- **Test Phone Number**: +16179466711 for all vendors
- **Simulated Calls**: Automatic progression through call states
- **Fixed Pricing**: ₹480-640 negotiated prices
- **Flat Payment**: $1 USDC for any purchase
- **Starting Balance**: $10 USDC for testing

## 📁 Project Structure

```
├── client/               # Frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/      # Page components
│   │   └── lib/        # Utilities
├── server/              # Backend application
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Data persistence
│   └── services/       # External integrations
├── shared/             # Shared types and schemas
│   └── schema.ts       # Zod schemas
└── migrations/         # Database migrations
```

## 🔑 Key Components

### VendorCarousel
Interactive vendor selection with smooth scrolling and visual feedback

### CallStatusBanner
Real-time call progress with retry functionality for failed calls

### PaymentApproval
Simplified payment interface with $1 flat rate pricing

### PaymentSummary
Transaction details and status tracking in sidebar

## 🌐 Deployment

### Deploy on Replit

1. Import this repository to Replit
2. Configure environment secrets
3. Click "Run" to start the application
4. Use the built-in deployment feature for production

## 🛠️ Development

### Mock Mode Toggle

In `server/routes.ts`, line 272:
```javascript
const USE_MOCK_CALL = true; // Set to false for real Twilio calls
```

### Adjusting Prices

Modify base price and discount range in `server/routes.ts`:
```javascript
const basePrice = 800; // Base price in INR
const discount = Math.floor(Math.random() * 20) + 20; // 20-40% discount
```

## 📝 API Endpoints

- `POST /api/messages` - Send chat messages
- `GET /api/session/:id` - Get session state
- `POST /api/vendors/select` - Select a vendor
- `POST /api/calls/initiate` - Start vendor call
- `POST /api/payments/approve` - Approve/reject payment
- `POST /api/payments/process` - Process payment

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🙏 Acknowledgments

- Built with the Replit full-stack JavaScript template
- UI components from shadcn/ui
- AI capabilities powered by Anthropic Claude
- Payment infrastructure via Locus and Stripe

## 📞 Support

For issues and questions, please open an issue in the repository.

---

**Note**: This application currently operates in mock mode with simulated phone calls and test payments. The $1 USDC flat rate is a promotional feature for testing purposes.