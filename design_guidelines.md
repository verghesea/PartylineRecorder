# Design Guidelines: Partyline Recorder Dashboard

## Design Approach

**Selected Approach:** Design System (Material Design foundation) with productivity tool refinement
**Inspiration:** Linear's clean data presentation + Notion's organized content hierarchy
**Rationale:** This is a data-heavy utility application focused on recording management, requiring efficient navigation, clear information hierarchy, and scalable layouts for future transcription features.

## Core Design Principles

1. **Information Clarity:** Prioritize readable data presentation over decorative elements
2. **Efficient Scanning:** Enable quick location of specific recordings through visual hierarchy
3. **Action Accessibility:** Keep primary actions (play, download) immediately available
4. **Future-Proof Layout:** Design with transcription panel integration in mind

---

## Typography System

### Font Families
- **Primary:** Inter (via Google Fonts CDN) - clean, highly legible for data
- **Monospace:** JetBrains Mono - for technical details (RecordingSid, timestamps)

### Type Scale
- **Page Title:** text-3xl font-semibold (Recordings Dashboard)
- **Section Headers:** text-xl font-medium (Today, This Week, etc.)
- **Recording Titles:** text-base font-medium (Auto-generated from timestamp)
- **Metadata:** text-sm (Duration, participants, conference ID)
- **Technical Details:** text-xs font-mono (Recording SIDs, file paths)
- **Empty States:** text-lg font-normal

---

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 3, 4, 6, 8, 12, 16** for consistent rhythm
- Micro spacing (icons, inline elements): **2, 3**
- Component padding: **4, 6**
- Section spacing: **8, 12**
- Page margins: **16**

### Grid Structure
- **Container:** max-w-7xl mx-auto px-6 lg:px-8
- **Two-Column Layout (Future-Ready):**
  - Left: Recordings list (w-full lg:w-2/3)
  - Right: Transcription panel (w-full lg:w-1/3, initially hidden)

### Responsive Breakpoints
- Mobile: Stack all elements vertically, full-width cards
- Tablet (md:): Maintain vertical stack with larger touch targets
- Desktop (lg:): Two-column layout when transcription feature launches

---

## Component Library

### 1. Navigation Header
**Structure:**
- Fixed top bar, full-width with subtle bottom border
- Left: Logo/app name "Partyline Recorder"
- Center: Global search input (placeholder: "Search recordings...")
- Right: User menu, settings icon

**Spacing:** h-16 px-6, items-center

### 2. Recordings List View

**List Container:**
- Grouped by time period (Today, Yesterday, This Week, This Month, Older)
- Each group: mb-12

**Recording Card (Primary Component):**
```
Structure per card:
- Container: rounded-lg border p-4 mb-3 hover:shadow-md transition
- Top Row (flex justify-between items-start):
  - Left: Recording title (timestamp formatted: "Oct 25, 2025 • 7:17 PM")
  - Right: Duration badge (px-3 py-1 rounded-full text-sm)
- Metadata Row (flex gap-4 mt-2 text-sm):
  - Participant count icon + number
  - Conference status (completed/in-progress)
  - RecordingSid (truncated, monospace)
- Action Row (flex gap-3 mt-4):
  - Play button (primary, icon + "Play Recording")
  - Download button (secondary, icon only with tooltip)
  - More options menu (icon only)
```

**Spacing within card:** p-4, gap-3 between rows

### 3. Audio Player (Embedded)

**When Recording is Playing:**
- Expand card to include inline player
- Player strip: h-20 mt-4 rounded-lg border
- Layout: flex items-center justify-between px-6
- Left: Play/pause button (icon, size-8)
- Center: Waveform visualization or progress bar (flex-1 mx-6)
- Right: Timestamp (current/total), volume control, speed selector

### 4. Empty State

**When No Recordings:**
- Centered container: max-w-md mx-auto text-center py-24
- Icon: Microphone with slash (size-16, mx-auto mb-6)
- Heading: "No recordings yet"
- Description: "Dial [phone number] to start a recorded conference call"
- Secondary info: "Recordings appear here automatically after calls end"

### 5. Search & Filter Bar

**Below Header:**
- Container: border-b py-4 px-6
- Layout: flex justify-between items-center
- Left: View toggles (List view active, Grid view for future)
- Center: Date range picker (subtle button)
- Right: Sort dropdown ("Newest first" default)

### 6. Future: Transcription Panel

**Right Column (Initially Hidden):**
- Sticky positioning: top-20 (below header)
- Header: "Transcription" with close button
- Content area: Scrollable transcript with timestamps
- Speaker labels (Speaker 1, Speaker 2, etc.)
- Highlight search terms
- Footer: Download transcript button

---

## Interaction Patterns

### Hover States
- Recording cards: subtle shadow elevation
- Buttons: slight opacity shift (hover:opacity-90)
- Links: underline decoration

### Active States
- Selected recording: left border accent (border-l-4)
- Playing recording: pulsing indicator

### Loading States
- Skeleton screens for recording cards (animate-pulse)
- Spinner for audio loading (in player area)

---

## Icon System

**Library:** Heroicons (via CDN)
**Primary Icons:**
- Play/Pause: PlayIcon, PauseIcon (solid)
- Download: ArrowDownTrayIcon
- Search: MagnifyingGlassIcon  
- Participants: UsersIcon
- Duration: ClockIcon
- Menu: EllipsisVerticalIcon
- Settings: Cog6ToothIcon
- Empty state: MicrophoneIcon with slash

**Icon Sizing:**
- Small metadata: size-4
- Action buttons: size-5
- Empty state: size-16

---

## Data Display Patterns

### Recording Metadata Format
- **Date/Time:** "Oct 25, 2025 • 7:17 PM" (readable format)
- **Duration:** "24:15" or "1h 24m 15s"
- **Participants:** "5 participants" with icon
- **Status:** Badge component (rounded-full px-2 py-1)
- **Technical IDs:** Monospace font, truncated with tooltip on hover

### Grouping Strategy
- Temporal grouping (Today, Yesterday, etc.)
- Dividers between groups (subtle border-t)
- Group headers: sticky positioning during scroll

---

## Accessibility Implementation

### Keyboard Navigation
- Tab order: Search → recordings list → player controls
- Enter: Play/pause recording
- Space: Play/pause when player focused
- Arrow keys: Navigate recording list

### ARIA Labels
- All icon buttons include aria-label
- Recording cards: role="article"
- Player: role="region" aria-label="Audio player"
- List groups: role="group" aria-labelledby

### Focus Indicators
- Visible focus rings on all interactive elements (ring-2 ring-offset-2)
- Skip to main content link (sr-only by default)

---

## Performance Considerations

- Virtualized scrolling for 100+ recordings (future enhancement)
- Lazy load audio files (only when play is clicked)
- Pagination or infinite scroll for large datasets
- Debounced search input (300ms)

---

## Images

**No images required** for this dashboard application. All visual elements are component-based (cards, tables, icons) focused on data presentation. Future versions may include user avatars if authentication is added.