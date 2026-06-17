# CoreFlow - Premium Business App Design

## Design Philosophy

CoreFlow is a premium, enterprise-grade business management application designed for seamless cross-platform experience (iOS, Android, Desktop). The UI follows **Apple Human Interface Guidelines (HIG)** with high-end typography, sophisticated color palette, and elegant micro-interactions. All interactions are optimized for one-handed mobile usage in portrait orientation (9:16).

---

## Screen List

### Authentication & Onboarding
1. **Login Screen** - JWT-based authentication with email/password
2. **Registration Screen** - New user account creation
3. **Forgot Password Screen** - Password recovery flow
4. **Onboarding Welcome** - First-time user introduction

### Core Dashboard
5. **Dashboard (Home)** - Role-based overview with quick actions
6. **Navigation Hub** - Tab-based access to main features

### Team & Organization
7. **Team Directory** - Member list with role badges and contact info
8. **Member Profile** - Individual member details, role, and status
9. **Role Management** - Admin-only role assignment (MD, CEO, CTO only)
10. **Organization Hierarchy** - Visual org chart (read-only for non-admins)

### Meeting Management
11. **Meetings List** - Upcoming and past meetings with filtering
12. **Create Meeting** - Meeting scheduling with elegant date/time pickers
13. **Meeting Details** - Full meeting information, attendees, and join link
14. **Meeting Attendees** - List of participants with status
15. **Calendar View** - Month/week calendar showing scheduled meetings

### Notifications & Activity
16. **Notifications Center** - Notification history and management
17. **Activity Feed** - Recent organization activity and updates

### Settings & Profile
18. **User Profile** - Personal profile information and preferences
19. **Settings** - App preferences, notification settings, security
20. **Account Management** - Password change, session management

---

## Primary Content & Functionality

### Authentication Flow
- **Login Screen**: Email input, password input, "Remember me" toggle, login button, sign-up link
- **Registration**: Email, password, confirm password, full name, role selection (default: General Member)
- **JWT Token Management**: Secure token storage in device keychain, automatic refresh on expiry

### Dashboard (Role-Based)
- **Managing Director/CEO/CTO View**: 
  - Key metrics: total members, active meetings, pending approvals
  - Quick action buttons: Create meeting, Manage roles, View reports
  - Recent activity feed
  
- **Project Manager View**:
  - Assigned meetings and tasks
  - Team performance metrics
  - Meeting schedule for the week
  
- **HR View**:
  - Team member list
  - Attendance tracking
  - Leave management
  
- **Developer/General Member View**:
  - Personal calendar
  - Assigned meetings
  - Task list

### Team Directory
- Searchable member list with role badges
- Member cards showing: name, role, department, status (online/offline)
- Quick contact buttons: call, email, message
- Member profile deep-link

### Meeting Management
- **Create Meeting Screen**:
  - Meeting title input
  - Description/notes
  - **Elegant Date Picker**: Full calendar showing upcoming dates (30-day view)
  - **Elegant Time Picker**: Hour/minute selection with AM/PM toggle
  - **Duration Selector**: Separate dropdown (15 min, 30 min, 1 hr, 2 hrs, etc.)
  - Attendee selection (multi-select from team directory)
  - Meeting link type: Teams, Google Meet, Zoom, or custom URL
  - Recurring options: None, Daily, Weekly, Monthly
  - Create button with validation

- **Meetings List**:
  - Upcoming meetings sorted by date/time
  - Past meetings archive
  - Meeting cards showing: title, time, attendees count, meeting link
  - Swipe actions: Edit, Delete, Reschedule
  - Filter by: All, My Meetings, Team Meetings, Upcoming, Past

- **Meeting Details**:
  - Full meeting information
  - Attendee list with RSVP status
  - Meeting link (clickable to join)
  - Edit/Delete options (creator only)
  - Notification settings

### Role Management (Admin Only)
- **Role Assignment Screen**:
  - Member list with current role
  - Role dropdown: Managing Director, CEO, CTO, Project Manager, HR, Developer, General Member
  - Confirmation dialog before role change
  - Audit log showing role changes
  - Only MD/CEO/CTO can modify roles

---

## Key User Flows

### Flow 1: User Login & First Access
1. User opens app → Login screen
2. Enters email and password
3. JWT token received and stored securely
4. Redirected to Dashboard based on role
5. Dashboard shows role-specific content

### Flow 2: Create Meeting
1. User taps "Create Meeting" button
2. Enters meeting title and description
3. Taps date field → Elegant calendar picker opens (shows 30 upcoming days)
4. Selects date → Calendar closes
5. Taps time field → Time picker opens (hour/minute selection)
6. Selects time → Time picker closes
7. Selects duration from dropdown
8. Selects attendees from team directory
9. Chooses meeting link type (Teams/Google Meet/etc.)
10. Reviews meeting details
11. Taps "Create Meeting" → Meeting saved, confirmation shown
12. Returns to meetings list

### Flow 3: View Meeting & Join
1. User views meetings list
2. Taps on a meeting card
3. Meeting details screen opens
4. Reviews attendees and meeting info
5. Taps "Join Meeting" → Opens meeting link in browser/app
6. Returns to app after meeting

### Flow 4: Role Management (Admin)
1. Admin navigates to Role Management
2. Searches for member
3. Taps member → Shows current role
4. Changes role from dropdown
5. Confirms change → Role updated in database
6. Audit log entry created
7. Member receives notification of role change

### Flow 5: View Team Directory
1. User taps "Team" tab
2. Directory shows all members with role badges
3. User can search by name or role
4. Taps member → Profile details open
5. Can view contact info and recent activity
6. Returns to directory

---

## Color Palette (Premium & Elegant)

### Primary Colors
- **Primary Accent**: `#1F6FEB` (Deep Blue) - Used for primary buttons, links, highlights
- **Secondary Accent**: `#7C3AED` (Vibrant Purple) - Used for secondary actions and badges
- **Success**: `#10B981` (Emerald Green) - Success states, confirmations
- **Warning**: `#F59E0B` (Amber) - Warnings and alerts
- **Error**: `#EF4444` (Red) - Errors and destructive actions

### Neutral Colors
- **Background**: `#FFFFFF` (Light) / `#0F172A` (Dark) - Main background
- **Surface**: `#F8FAFC` (Light) / `#1E293B` (Dark) - Cards and elevated surfaces
- **Border**: `#E2E8F0` (Light) / `#334155` (Dark) - Borders and dividers
- **Text Primary**: `#0F172A` (Light) / `#F1F5F9` (Dark) - Main text
- **Text Secondary**: `#64748B` (Light) / `#CBD5E1` (Dark) - Secondary text

### Role Badge Colors
- **Managing Director**: `#1F6FEB` (Deep Blue)
- **CEO**: `#7C3AED` (Purple)
- **CTO**: `#06B6D4` (Cyan)
- **Project Manager**: `#EC4899` (Pink)
- **HR**: `#F59E0B` (Amber)
- **Developer**: `#10B981` (Green)
- **General Member**: `#6B7280` (Gray)

---

## Typography

### Font Family
- **Primary**: System font (San Francisco on iOS, Roboto on Android)
- **Fallback**: Segoe UI on desktop

### Font Sizes & Weights
- **Display Large**: 32pt, Bold (600) - Page titles
- **Display**: 28pt, Bold (600) - Section headers
- **Headline**: 24pt, Semibold (600) - Card titles
- **Title**: 18pt, Semibold (600) - Subheadings
- **Body Large**: 16pt, Regular (400) - Main content
- **Body**: 14pt, Regular (400) - Secondary content
- **Caption**: 12pt, Regular (400) - Labels and hints
- **Label**: 11pt, Semibold (600) - Button labels

### Line Height
- **Display**: 1.2x font size
- **Headline**: 1.3x font size
- **Body**: 1.5x font size
- **Caption**: 1.4x font size

---

## Elegant Date & Time Picker Design

### Date Picker
- **Style**: Full calendar grid showing 30 upcoming days
- **Header**: Month/year selector with left/right navigation
- **Grid**: 7 columns (Sun-Sat), showing dates with:
  - Current date highlighted in primary color
  - Selected date with filled circle
  - Disabled past dates in muted color
  - Today indicator with subtle accent
- **Footer**: "Cancel" and "Select" buttons
- **Animation**: Smooth slide-in from bottom (iOS) or fade-in (Android)

### Time Picker
- **Style**: Elegant spinner-style selector
- **Components**:
  - Hour selector (00-23 or 1-12 with AM/PM)
  - Minute selector (00-59, increments of 5)
  - AM/PM toggle (if 12-hour format)
- **Interaction**: Tap to select, scroll to adjust
- **Display**: Large, readable numbers with highlight on selected value
- **Footer**: "Cancel" and "Select" buttons

### Duration Selector
- **Style**: Dropdown menu or segmented control
- **Options**: 15 min, 30 min, 45 min, 1 hr, 1.5 hrs, 2 hrs, 3 hrs, 4 hrs, All day
- **Default**: 1 hour
- **Display**: Shows selected duration prominently

---

## Micro-Interactions & Animations

### Button Interactions
- **Tap Feedback**: Scale 0.97 with haptic feedback (Light)
- **Loading State**: Spinner with subtle rotation
- **Success State**: Checkmark animation (0.3s)

### Navigation Transitions
- **Screen Push**: Slide from right (iOS) / Fade (Android)
- **Modal Presentation**: Slide up from bottom with blur background
- **Tab Switching**: Fade transition (no heavy animations)

### List Interactions
- **Pull-to-Refresh**: Smooth spinner animation
- **Swipe Actions**: Reveal delete/edit buttons with haptic feedback
- **Item Selection**: Subtle highlight with scale animation

### Form Interactions
- **Input Focus**: Bottom border color change to primary accent
- **Error State**: Shake animation with red highlight
- **Success State**: Green checkmark with fade-in

---

## Accessibility & Usability

### One-Handed Usage
- All interactive elements positioned within thumb reach
- Bottom tabs for primary navigation
- Floating action buttons for quick access
- Minimum touch target: 44pt × 44pt

### Dark Mode Support
- All colors automatically adjust based on system preference
- High contrast ratios for text (WCAG AA standard)
- No reliance on color alone for information

### Keyboard Navigation
- All screens support keyboard navigation on desktop
- Tab order follows visual hierarchy
- Return key submits forms
- Escape key closes modals

---

## Performance & Optimization

### Data Loading
- Skeleton screens during data fetch
- Pagination for large lists (meetings, members)
- Local caching with Supabase real-time sync
- Optimistic updates for instant feedback

### Image Optimization
- Profile pictures: 100×100px thumbnails
- Lazy loading for off-screen images
- WebP format with JPEG fallback

### Network Optimization
- Minimal API calls per screen
- Request batching for multiple data fetches
- Offline support with local cache
- Automatic retry on network failure

---

## Security & Privacy

### Data Protection
- JWT tokens stored in device keychain
- All API calls over HTTPS
- End-to-end encryption for sensitive data
- RBAC enforced at database level

### User Privacy
- No tracking or analytics without consent
- Clear privacy policy and terms
- User data deletion on account removal
- Audit logs for admin actions

---

## Testing Strategy

### Unit Tests
- Authentication logic (JWT validation, token refresh)
- Role-based access control
- Date/time picker calculations
- Form validation

### Integration Tests
- User login flow
- Meeting creation and retrieval
- Role assignment and verification
- Real-time updates

### E2E Tests
- Complete user journey from login to meeting creation
- Role-based dashboard rendering
- Meeting scheduling and joining
- Team directory search and filtering

---

## Deployment & Monitoring

### Build Targets
- iOS: Minimum iOS 14, optimized for iPhone 12+
- Android: Minimum API 24, optimized for Android 12+
- Desktop: Web version via React Native Web

### Performance Metrics
- App startup time: < 2 seconds
- Screen transition: < 300ms
- API response time: < 1 second
- Meeting list load: < 500ms

### Error Handling
- User-friendly error messages
- Automatic error reporting to backend
- Graceful fallbacks for failed operations
- Retry mechanism with exponential backoff

---

## Future Enhancements

1. **Video Conferencing**: Integrated video calls within app
2. **Screen Sharing**: Share screen during meetings
3. **Recording**: Record meetings for later review
4. **Analytics**: Meeting analytics and insights
5. **Integrations**: Slack, Microsoft Teams, Outlook sync
6. **Mobile Notifications**: Push notifications for meeting reminders
7. **Offline Mode**: Full offline support with sync on reconnect
8. **Advanced Scheduling**: Recurring meetings, meeting templates
9. **Team Analytics**: Team performance dashboards
10. **Mobile App Store Deployment**: iOS App Store and Google Play Store
