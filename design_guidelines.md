# Zenno Concierge Design Guidelines

## Design Approach

**Selected Approach**: Design System + Reference Hybrid
- **Primary System**: Material Design 3 for its robust handling of conversational interfaces, real-time updates, and transactional flows
- **Reference Inspiration**: ChatGPT/Claude for chat interface patterns, Linear for status indicators and progress tracking
- **Rationale**: This application requires clarity and trust for financial transactions while maintaining an approachable conversational interface

## Core Design Principles

1. **Clarity First**: Every transaction step must be immediately understandable
2. **Progressive Disclosure**: Show information as it becomes relevant in the purchase journey
3. **Trust Through Transparency**: Real-time status updates and clear transaction confirmations
4. **Conversational Flow**: Natural chat interface that doesn't feel robotic

## Typography System

**Font Stack**: Inter (primary), SF Pro Display (fallback)

- **Display/Hero**: 3xl to 5xl, font-bold (app title, major headings)
- **Section Headers**: 2xl, font-semibold (chat session headers, vendor sections)
- **Body Text**: base to lg, font-normal (chat messages, descriptions)
- **UI Labels**: sm to base, font-medium (form labels, metadata)
- **Caption/Meta**: xs to sm, font-normal (timestamps, transaction IDs)
- **Monospace**: font-mono for transaction hashes, API responses

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: p-2, gap-2 (compact lists, inline elements)
- Standard spacing: p-4, gap-4 (chat bubbles, cards)
- Generous spacing: p-6, p-8 (section padding, modal content)
- Large spacing: p-12, p-16 (page sections, major separators)

**Grid Structure**:
- Main layout: Two-column split on desktop (sidebar + main chat area)
- Sidebar: Fixed width 320px (vendor list, transaction history)
- Main area: Flex-grow with max-w-4xl constraint for chat content
- Mobile: Single column stack, collapsible sidebar as drawer

## Component Library

### Navigation & Layout

**Top Bar**:
- Fixed header with app branding (Zenno Concierge logo/text)
- User session indicator
- Settings/help icon buttons (right-aligned)
- Height: h-16, px-6 padding
- Persistent across all views

**Sidebar Panel** (Desktop):
- Fixed left sidebar displaying current transaction status
- Collapsible vendor results list with selection states
- Payment status tracker
- Shadow and subtle border for depth separation

### Chat Interface

**Message Bubbles**:
- User messages: Right-aligned, max-w-2xl, rounded-2xl, px-6 py-4
- AI messages: Left-aligned, max-w-3xl, rounded-2xl, px-6 py-4
- Typing indicator: Animated dots, subtle pulse
- Spacing between messages: gap-4

**Input Area**:
- Sticky bottom bar with full-width textarea
- Auto-expanding up to 4 lines
- Send button (icon) positioned right
- Rounded-full container with px-6 py-4
- Elevated with shadow for prominence

### Vendor Display Cards

**Vendor Card Structure**:
- Compact card design with rounded-xl borders
- Grid layout: 2 columns on tablet, 1 on mobile
- Each card includes: Name (text-lg font-semibold), Address (text-sm), Distance (text-xs), Rating (stars + number)
- Selection state: Highlighted border-2, subtle scale transform
- Spacing: p-4 internal, gap-4 between cards

**Call Status Indicator**:
- Prominent status banner showing real-time call progress
- Icon + status text + duration timer
- Positioned above chat input when active
- Rounded-lg with p-4, subtle animation pulse during active call

### Payment & Transaction

**Payment Summary Card**:
- Elevated card with rounded-xl
- Clear sections: Vendor details, Amount, Payment method, Transaction status
- Each section separated by border-b, internal p-6
- Transaction hash displayed in monospace with copy button
- CTA button: Full-width, rounded-lg, py-3, text-base font-semibold

**Status Timeline**:
- Vertical stepper showing: Search → Call → Negotiation → Payment → Confirmation
- Each step with icon, label, and completion state
- Active step highlighted with subtle animation
- Spacing: gap-6 between steps, pl-8 for indentation

### Forms & Inputs

**Text Inputs**:
- Rounded-lg borders, px-4 py-3
- Focus state with border-2 (no visible treatment change)
- Label above input: text-sm font-medium, mb-2
- Error state with helper text below: text-xs

**Buttons**:
- Primary actions: rounded-lg, px-6 py-3, text-base font-semibold
- Secondary actions: rounded-lg, px-4 py-2, text-sm font-medium
- Icon buttons: rounded-full, p-2 for small icons
- Consistent height: h-10 for standard, h-12 for prominent

### Data Display

**Transaction Details**:
- Definition list pattern for key-value pairs
- Label: text-sm font-medium, Value: text-base font-normal
- Each row: py-3 with border-b separator
- Monospace for blockchain addresses/hashes

**Vendor Search Results**:
- List view with alternating subtle backgrounds (striped pattern)
- Each row: py-4 px-6, flex layout for alignment
- Quick actions (call, select): Positioned right with gap-2

## Interaction Patterns

**Loading States**:
- Skeleton screens for vendor search results
- Shimmer animation for pending content
- Spinner for async actions (payments, API calls)
- Never block entire UI - show inline loading states

**Real-time Updates**:
- Toast notifications for important events (payment confirmed, call connected)
- Position: top-right, stacked with gap-2
- Auto-dismiss after 5 seconds with manual close option
- Slide-in animation from right

**Modals & Overlays**:
- Confirmation dialogs: Centered, max-w-md, rounded-xl, p-6
- Backdrop blur for depth
- Close button: Absolute top-right with p-2
- Actions footer: Border-t, flex justify-end, gap-3, pt-4

## Icons

**Icon Library**: Heroicons (outline for navigation, solid for status indicators)

- Navigation: outline style, w-5 h-5
- Status indicators: solid style, w-4 h-4  
- Action buttons: outline style, w-6 h-6
- Inline icons: w-4 h-4 with text

## Responsive Behavior

**Breakpoints**:
- Mobile (base): Stack layout, drawer-based sidebar
- Tablet (md: 768px): Hybrid - collapsible sidebar, wider chat
- Desktop (lg: 1024px): Full two-column layout with persistent sidebar
- Wide (xl: 1280px): Max content width with centered layout

**Mobile Optimizations**:
- Chat input: Fixed bottom with safe-area-inset padding
- Vendor cards: Full width, single column
- Top bar: Hamburger menu for sidebar access
- Increased touch targets: min-h-12 for interactive elements

## Accessibility Standards

- Consistent focus indicators across all interactive elements
- ARIA labels for icon-only buttons
- Semantic HTML structure (main, aside, nav, article for chat messages)
- Keyboard navigation: Tab order follows visual hierarchy
- Screen reader announcements for real-time status updates

## Animation Guidelines

**Use Sparingly**:
- Typing indicator: Gentle pulse animation
- Loading spinners: Smooth rotation
- Status transitions: Subtle fade-in/fade-out (duration-200)
- No parallax, no scroll-triggered animations
- Page transitions: Simple fade (duration-150)

## Images

This application does not require hero images or decorative imagery. All visual elements are functional:
- Vendor photos: If available from API, display as rounded-lg thumbnails (w-16 h-16) in vendor cards
- User avatar: Small circular avatar (w-8 h-8) for chat interface identification
- Status icons: Use icon library, not custom illustrations