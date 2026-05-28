# Project PRD: 19wpm

## 1. Executive Summary
19wpm is a high-performance typing speed test application designed for focus and competition. It merges the radical minimalism and distraction-free environment of platforms like Monkeytype with the competitive spirit and literary sourcing of TypeRacer. The application caters to both solo practitioners seeking a "cozy" focus mode and competitive typists looking for race-style feedback.

## 2. Product Vision & Goals
- **Focus First:** Eliminate visual noise to prioritize the typing experience.
- **Cozy Competition:** Create a competitive environment that feels editorial and warm rather than aggressive.
- **Literary Connection:** Use high-quality literary excerpts with proper attribution to make practice feel like reading.
- **Thematic Versatility:** Support distinct visual identities (Cozy Light vs. Dracula Dark) to suit user preference and environment.

## 3. Target Audience
- **Productivity Enthusiasts:** Users looking to improve their daily typing efficiency.
- **Competitive Typists:** Users who enjoy racing against benchmarks or others.
- **Minimalist Design Lovers:** Users who appreciate clean, purposeful interfaces.

## 4. Design System (Obsidian Neon & Cozy Competition)

### 4.1 Cozy Competition (Light Mode)
- **Concept:** Warm, soft, editorial, "reading app" feel.
- **Palette:**
    - Background: Warm off-white (#F7F4F0)
    - Primary Accent: Dusty Rose (#C9908A)
    - Success/Correct: Sage Green (#A8B5A2)
    - Error/Incorrect: Muted Coral (#D4756B)
- **Typography:** Monospace for typing areas; Refined Sans-serif (Montserrat) for UI.

### 4.2 Dracula Mode (Dark Mode)
- **Concept:** High-contrast, neon-on-dark, syntax highlighting style.
- **Palette:** 
    - Background: Deep Slate/Purple (#282A36 / #11131e)
    - Primary Accent: Neon Purple/Pink (#bd93f9)
    - Success/Correct: Neon Green
    - Error/Incorrect: Red/Coral
- **Typography:** Consistent with Light Mode for branding but optimized for dark contrast.

## 5. Functional Requirements

### 5.1 Landing Page
- Minimalist hero section with a blinking cursor animation.
- Dual entry points: "Start Typing" (Solo) and "Join a Race" (Competitive).
- Quick-toggle chips for test duration (15s, 30s, 60s) and language.
- Theme toggle (Sun/Moon) for instant mode switching.

### 5.2 Typing Test Engine (Solo Mode)
- Monkeytype-inspired minimalist layout.
- Real-time word-level feedback (Correct, Incorrect, Untyped).
- Smooth animated caret movement.
- Live WPM and Accuracy tracking.
- Literary attribution display (Author, Source).

### 5.3 Test Results
- Data-driven summary card with WPM and Accuracy.
- Inline sparkline/bar chart showing WPM bursts throughout the test.
- Detailed character breakdown and duration metrics.
- Actionable next steps: "Retry" and "View My Stats."

### 5.4 User Dashboard
- Personal profile summary (Avatar, Join Date, Streak).
- Stat grid: Average WPM, Best WPM, Last WPM, Total Texts Completed.
- Long-term progression line chart.
- Searchable/paginated history table of past performances.

### 5.5 Authentication & User Management
- Integrated Login/Register card with tab switching.
- Social OAuth support (Google, GitHub).
- Logged-in state with user profile menu and settings access.

### 5.6 Content Creation
- Custom text submission form for users to add their own passages.
- Live validation (Word count requirement > 20 words).

## 6. Technical Specifications
- **Framework:** React/TypeScript (Tailwind UI patterns).
- **Interactions:** Smooth CSS transitions for theme switching and UI states.
- **Data Visualization:** SVG-based charts for performance tracking.
- **Responsiveness:** Desktop-first design with a focus-filling viewport for mobile.

## 7. Success Metrics
- **User Engagement:** Daily typing streaks and average tests per session.
- **Performance Improvement:** Average WPM increase over time for active users.
- **Feature Adoption:** Usage of custom text creation and "Dracula" theme toggle.
