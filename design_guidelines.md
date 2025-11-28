# VeriVerse Design Guidelines

## Design Approach
**Selected Approach**: Custom minimal design with productivity app aesthetic
**Justification**: Clean, understated interface that prioritizes clarity and trust for a misinformation detection platform

## Core Visual Identity

### Color Palette (Strict)
- **Background**: #F8FAFC (very light gray/blue)
- **Text**: #0F172A (near-black)
- **Accent**: #2563EB (soft blue) - buttons, highlights, status indicators only
- **Semantic Colors** (allowed for specific contexts):
  - **Success/Verified**: Green variants (green-50 through green-700) for credibility scores and verified content
  - **Warning**: Amber variants for awaiting/pending states
  - **Error**: Red variants for failed verifications or negative indicators
- **No gradients, no loud colors** - maintain productivity app feel

### Typography
- **Logo/Brand**: Bold weight, small blue accent underline
- **Headlines**: Large, bold, clean sans-serif
- **Body**: Regular weight, optimized for readability
- **Hierarchy**: Clear distinction between titles, subtitles, and body text

### Layout System
- **Spacing**: Generous whitespace throughout - use Tailwind units of 4, 6, 8, 12, 16
- **Max-widths**: 
  - Landing hero: ~800px centered
  - Content cards: Full width with internal padding
  - Tables/Lists: Contained within card boundaries
- **Cards**: Rounded corners, subtle shadows (minimal depth)

## Page-Specific Designs

### Landing Page (/)
**Layout**: Single-column, centered, maximum elegance

**Hero Section**:
- Text logo "VeriVerse" at top (bold, small blue underline)
- Large headline: "Agentic AI + Community vs Misinformation"
- Single-sentence subtext
- No background image - pure clean background

**How It Works** (3-step horizontal row, stack on mobile):
- Step 1: 💬 "Ask" - "Paste any headline or claim"
- Step 2: 🤖 "Verify" - "Our agentic AI + tools investigate"
- Step 3: 🧑‍🤝‍🧑 "Trust" - "Peers upvote/downvote the answer"
- Use emoji icons, clean typography

**CTAs**:
- Primary button: "Try the Ask Demo" (solid blue background)
- Secondary button: "See Community" (outline style)

**Animated Metric**:
- Label: "Claims Verified"
- Counter animating from 0 → 1,248 over 1.5 seconds on mount
- Large number display with clean typography

### Ask Page (/ask)
**Layout**: Social media-inspired, Twitter/Threads single-post aesthetic

**Claim Input Card**:
- Social "compose post" styling
- Label: "Paste a claim or headline"
- Multi-line textarea with comfortable padding
- "Run Verification" button (blue accent)

**Result Card** (social post style):
- **Status Pill** (top-right corner):
  - queued → gray
  - in_progress → blue
  - awaiting_votes → amber
  - completed → green
- **Main Body**: provisional_answer text, generous line-height
- **Credibility Score Section** (green accent for verified content):
  - Large percentage display with checkmark icon
  - "Credibility Score" label beneath
  - Verification badge: "Highly Verified" (>=80%), "Partially Verified" (60-79%), "Needs Review" (<60%)
  - Light green background (#f0fdf4 / green-50) to indicate trustworthiness
- **Evidence Chips**: Small pills showing [tool_name], arranged in row, click to view details in modal
- **Expert Votes Section**: 
  - Header: "Expert Votes (X total)" with match criteria summary
  - Individual expert cards showing:
    - Avatar with initials from name
    - Full name (e.g., "Dr. Sarah Chen")
    - Domain and location (e.g., "ML Engineering • San Francisco")
    - Verified professional badge if applicable
    - Thumbs up/down icon with tooltip showing rationale and match reasons
  - Match reasons: domain_expert, location_match, verified_professional, high_reputation, topic_specialist
  - If no votes: "Waiting for expert reviewers..." in light text
- **Timestamp**: "Last updated: [time]" in small, muted text

**Whitespace**: Generous padding between sections, clean separation

### Verify Page (/verify)
**Layout**: Leaderboard-focused, community trust emphasis

**Header**:
- Title: "Community Trust Board"
- Subtext: "These are the top reviewers helping VeriVerse stay accurate"

**Leaderboard Table/List**:
- Columns: Name, Precision %, Attempts, Tier, Points
- **Tier Badges**: Colored small badges (Bronze, Silver, Gold, Platinum, Diamond)
- **Precision**: Display as percentage (e.g., "91%")
- Clean row styling, subtle hover states

**Footer Text**:
- Small explanatory text about point system and rewards
- "Back to Ask" link/button

## Component Library

### Navigation (Layout.tsx)
- Minimal top bar
- Left: "VeriVerse" text logo
- Right: Simple nav links "Ask" | "Community"
- Sticky or static, very thin, clean separation from content

### Cards
- White background (#FFFFFF)
- Subtle shadow: `shadow-sm` or `shadow-md`
- Rounded corners: `rounded-lg`
- Comfortable padding: p-6 to p-8

### Buttons
- **Primary**: Blue background (#2563EB), white text, rounded, medium padding
- **Secondary**: Blue outline, blue text, same rounding
- Hover states: Slight darkening/brightening
- No gradients

### Status Elements
- Pills/badges: Small, rounded-full, colored backgrounds with white/dark text
- Loading states: Simple spinner or "Loading..." text, centered

### Error Handling
- Thin red bar at top of page: "Backend unavailable, try again later"
- Minimal, non-intrusive

## Responsive Behavior
- **Desktop**: Full layouts as described
- **Mobile**: 
  - Stack horizontal rows vertically
  - Single-column cards
  - Full-width buttons
  - Maintain generous spacing

## Images
**No images required** - This is a text and data-focused application with clean, minimal aesthetic. All visual interest comes from typography, spacing, and subtle color accents.

## Animation Guidelines
- **Counter animation**: Smooth increment over 1.5 seconds using requestAnimationFrame
- **Polling updates**: Gentle transitions when status/data updates
- **Avoid**: Heavy animations, transitions, or motion - keep interface calm and professional

## Key Design Principles
1. **Understated elegance**: Let content speak, minimize decoration
2. **Trust through clarity**: Clean presentation builds credibility
3. **Social familiarity**: Leverage familiar social media patterns for votes/evidence
4. **Productivity focus**: Fast, efficient, no distractions
5. **One accent color**: Blue only where it guides action or communicates status