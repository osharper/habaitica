# Frontend Developer Task List
## Habaitica Custom Features Implementation

This document provides a step-by-step task list for implementing the frontend components for Task-Locked Rewards and AI-Powered Task Assessment features.

---

## Prerequisites

- [ ] Read `FRONTEND_SPECIFICATIONS.md` thoroughly
- [ ] Read `IMPLEMENTATION_GUIDE.md` for backend context
- [ ] Set up local development environment
- [ ] Verify backend is running with all changes
- [ ] Understand Vue.js 2.x and Vuex patterns used in Habitica

---

## Phase 1: Setup & Assets (Estimated: 2-3 hours)

### Task 1.1: Prepare Icons
- [ ] Find or create SVG icon for lock (`lock.svg`)
- [ ] Find or create SVG icon for AI/robot (`ai.svg`)
- [ ] Find or create SVG icon for chat (`chat.svg`)
- [ ] Find or create SVG icon for image upload (`image.svg`)
- [ ] Add icons to `website/client/src/assets/svg/` directory
- [ ] Verify existing check/uncheck icons are available

### Task 1.2: Add Translation Keys
- [ ] Open `website/common/locales/en/tasks.json`
- [ ] Add all translation keys from FRONTEND_SPECIFICATIONS.md section "Translation Keys"
- [ ] Verify keys compile without errors
- [ ] Test that translations display correctly

### Task 1.3: Review Existing Code
- [ ] Study `website/client/src/components/tasks/taskModal.vue` structure
- [ ] Study `website/client/src/components/tasks/task.vue` structure
- [ ] Study `website/client/src/store/actions/tasks.js` (already has AI actions)
- [ ] Understand how task scoring currently works
- [ ] Understand modal system (Bootstrap Vue)

---

## Phase 2: Task-Locked Rewards UI (Estimated: 8-12 hours)

### Task 2.1: Update Task Modal for Reward Configuration
**File**: `website/client/src/components/tasks/taskModal.vue`

- [ ] Locate the reward cost field section (around line 136)
- [ ] Add required tasks selector UI below the cost field
  - [ ] Create checkbox list for dailies
  - [ ] Create checkbox list for todos
  - [ ] Show "no tasks available" message when appropriate
  - [ ] Display completion badge on completed tasks
- [ ] Add computed property `availableTasksForLocking`
  - [ ] Filter out current task
  - [ ] Separate by task type (dailys/todos)
  - [ ] Exclude completed todos
- [ ] Initialize `task.requiredTasks` array if undefined
- [ ] Add SCSS styling for required tasks selector
  - [ ] Scrollable container (max-height: 300px)
  - [ ] Task type group styling
  - [ ] Checkbox styling
- [ ] Test saving reward with required tasks
- [ ] Test editing existing required tasks

### Task 2.2: Update Task Display Component for Lock Status
**File**: `website/client/src/components/tasks/task.vue`

- [ ] Add lock overlay HTML structure for rewards
  - [ ] Lock icon container
  - [ ] Lock message with task count
  - [ ] "View Required Tasks" button
- [ ] Add computed property `isRewardLocked`
  - [ ] Check if task is reward
  - [ ] Check if has required tasks
  - [ ] Return true if any required task incomplete
- [ ] Add computed property `incompletedRequiredTasks`
  - [ ] Get all user tasks from store
  - [ ] Filter for incomplete required tasks
  - [ ] Return array of incomplete tasks
- [ ] Add computed property `completedRequiredTasks`
  - [ ] Get all user tasks from store
  - [ ] Filter for completed required tasks
  - [ ] Return array of completed tasks
- [ ] Add method `showRequiredTasks()`
  - [ ] Emit modal show event
  - [ ] Pass reward and task data
- [ ] Disable purchase button when `isRewardLocked` is true
- [ ] Add SCSS styling for lock overlay
  - [ ] Semi-transparent overlay
  - [ ] Centered lock content
  - [ ] Smooth backdrop blur
  - [ ] Disabled button styling
- [ ] Test locked state display
- [ ] Test unlocked state display
- [ ] Test modal trigger

### Task 2.3: Create Required Tasks Modal Component
**File**: `website/client/src/components/tasks/requiredTasksModal.vue` (NEW)

- [ ] Create new Vue component file
- [ ] Set up component structure
  - [ ] Template with Bootstrap modal
  - [ ] Script section with data/computed/methods
  - [ ] Scoped styles
- [ ] Implement data properties
  - [ ] `reward` (null initially)
  - [ ] `incompleted` (empty array)
  - [ ] `completed` (empty array)
  - [ ] `icons` (import SVG icons)
- [ ] Add computed properties
  - [ ] `rewardName` - Get reward text
  - [ ] `totalCount` - Sum of all tasks
  - [ ] `completedCount` - Count of completed
  - [ ] `progressPercentage` - Calculate percentage
- [ ] Create modal template
  - [ ] Reward info header (name, cost)
  - [ ] Progress bar showing completion
  - [ ] Incomplete tasks section (red)
  - [ ] Completed tasks section (green)
  - [ ] Success message when all complete
- [ ] Implement event handlers
  - [ ] Listen for `show-required-tasks` event
  - [ ] Update data when modal opens
  - [ ] Clean up on modal close
- [ ] Add SCSS styling
  - [ ] Reward info card
  - [ ] Task items with status colors
  - [ ] Progress bar styling
  - [ ] Badge styling
- [ ] Register component globally or in parent
- [ ] Test modal opening with reward data
- [ ] Test progress bar calculations
- [ ] Test task list display

### Task 2.4: Create Reward Unlock Notification Component
**File**: `website/client/src/components/notifications/rewardUnlockedNotification.vue` (NEW)

- [ ] Create new Vue component file
- [ ] Set up component structure
- [ ] Implement data properties
  - [ ] `unlockedRewards` (empty array)
  - [ ] `icons` (gold icon)
- [ ] Create modal template
  - [ ] Celebration icon/emoji
  - [ ] Congratulations message
  - [ ] List of unlocked rewards
  - [ ] Each reward shows name and cost
  - [ ] "Awesome" button to close
- [ ] Implement event handlers
  - [ ] Listen for `rewards-unlocked` event
  - [ ] Update data with unlocked rewards
  - [ ] Show modal automatically
  - [ ] Clear data on modal close
- [ ] Add SCSS styling
  - [ ] Centered layout
  - [ ] Celebration icon animation (bounce)
  - [ ] Reward cards with gold accent
  - [ ] Scrollable reward list
- [ ] Register component globally
- [ ] Test with mock unlock data
- [ ] Test animation and styling

### Task 2.5: Integrate Unlock Detection in Task Scoring
**File**: `website/client/src/components/tasks/task.vue`

- [ ] Locate or create `scoreTask` method
- [ ] Add unlock detection after scoring
  ```javascript
  // After successful score
  if (response.data.unlockedRewards && response.data.unlockedRewards.length > 0) {
    this.$root.$emit('rewards-unlocked', response.data.unlockedRewards);
  }
  ```
- [ ] Test completing a task that unlocks rewards
- [ ] Verify notification appears
- [ ] Verify correct rewards shown

### Task 2.6: Test Complete Feature
- [ ] Create a daily task
- [ ] Create a reward with the daily as required task
- [ ] Verify reward shows as locked
- [ ] Complete the daily task
- [ ] Verify unlock notification appears
- [ ] Verify reward now shows as unlocked
- [ ] Purchase the reward successfully
- [ ] Test with multiple required tasks
- [ ] Test with mix of completed/incomplete required tasks

---

## Phase 3: AI-Powered Assessment UI (Estimated: 12-16 hours)

### Task 3.1: Update Task Modal for AI Toggle
**File**: `website/client/src/components/tasks/taskModal.vue`

- [ ] Locate section where `task.type !== 'reward'` (around line 204)
- [ ] Add AI assessment toggle UI
  - [ ] Bootstrap custom switch input
  - [ ] Label "Enable AI Assessment"
  - [ ] Info section explaining AI assessment
  - [ ] Benefits list (3 bullet points)
  - [ ] Note/alert when enabled
- [ ] Bind switch to `task.aiEnabled`
- [ ] Import AI icon SVG
- [ ] Add SCSS styling
  - [ ] Info box with blue accent
  - [ ] Icon and text layout
  - [ ] Alert styling
- [ ] Test toggle on/off
- [ ] Test saving task with AI enabled
- [ ] Test that only todos/dailies show toggle

### Task 3.2: Update Task Display for AI Status
**File**: `website/client/src/components/tasks/task.vue`

- [ ] Add AI status badge display
  - [ ] Only show for AI-enabled tasks
  - [ ] Show current assessment status
  - [ ] Color-code by status (pending/approved/rejected/needs_revision)
- [ ] Add "Submit Proof" button
  - [ ] Only show for AI-enabled tasks
  - [ ] Icon + text
  - [ ] Opens AI chat modal
- [ ] Add completion note for AI tasks
  - [ ] Show "Submit proof via AI chat to complete"
  - [ ] Only when not completed
- [ ] Add computed property `aiStatusClass`
  - [ ] Map status to badge class
  - [ ] Return appropriate Bootstrap class
- [ ] Add method `openAIChat()`
  - [ ] Emit modal show event
  - [ ] Pass current task data
- [ ] Add SCSS styling
  - [ ] AI badge styling
  - [ ] Button styling
  - [ ] Note text styling
- [ ] Test badge display for each status
- [ ] Test button click opens chat

### Task 3.3: Create AI Chat Modal Component - Structure
**File**: `website/client/src/components/tasks/taskAIChatModal.vue` (NEW)

- [ ] Create new Vue component file
- [ ] Set up component structure (template/script/style)
- [ ] Import required SVG icons (AI, chat, image)
- [ ] Set up data properties
  - [ ] `task` (null)
  - [ ] `chatMessages` (empty array)
  - [ ] `newMessage` (empty string)
  - [ ] `isLoading` (false)
  - [ ] `uploadedImages` (empty array)
  - [ ] `icons` object
- [ ] Create computed properties
  - [ ] `chatTitle` - Dynamic title with task name
  - [ ] `statusBadgeClass` - Status color class
  - [ ] `userInitial` - First letter of username
  - [ ] `canSend` - Check if can submit message
- [ ] Set up lifecycle hooks
  - [ ] `mounted` - Listen for `open-ai-chat` event
  - [ ] `beforeDestroy` - Clean up event listeners

### Task 3.4: Create AI Chat Modal Component - Template
**File**: `website/client/src/components/tasks/taskAIChatModal.vue` (continued)

- [ ] Create Bootstrap modal structure
  - [ ] Modal header with dynamic title
  - [ ] Modal body with chat container
  - [ ] Hide footer (custom footer in body)
- [ ] Add task info header
  - [ ] Task title
  - [ ] Task notes (if present)
  - [ ] Current status badge
  - [ ] Purple gradient background
- [ ] Add chat messages area
  - [ ] Scrollable container (ref="messagesContainer")
  - [ ] Empty state (welcome message)
  - [ ] Message loop (v-for)
    - [ ] User messages (right-aligned, purple)
    - [ ] Assistant messages (left-aligned, white)
    - [ ] Avatar for each message
    - [ ] Message bubble with content
    - [ ] Timestamp
  - [ ] Loading indicator (typing animation)
- [ ] Add image preview area
  - [ ] Show uploaded images
  - [ ] Remove button for each image
  - [ ] Horizontal scroll if many images
- [ ] Add input area
  - [ ] Image upload button (hidden file input)
  - [ ] Textarea for message
  - [ ] Character/helper text
  - [ ] Submit button with loading state
- [ ] Test template renders correctly
- [ ] Test empty state shows
- [ ] Test messages display

### Task 3.5: Create AI Chat Modal Component - Functionality
**File**: `website/client/src/components/tasks/taskAIChatModal.vue` (continued)

- [ ] Implement `handleOpenChat(task)` method
  - [ ] Set task data
  - [ ] Load existing messages
  - [ ] Scroll to bottom
  - [ ] Focus input
- [ ] Implement `loadMessages()` method
  - [ ] Call store action `tasks:getTaskChatMessages`
  - [ ] Set `chatMessages` data
  - [ ] Handle errors
- [ ] Implement `sendMessage()` method
  - [ ] Validate message not empty
  - [ ] Capture message and attachments
  - [ ] Clear input and images
  - [ ] Set loading state
  - [ ] Call store action `tasks:sendTaskChatMessage`
  - [ ] Update chatMessages with response
  - [ ] Update task data
  - [ ] Scroll to bottom
  - [ ] Handle approval (show success, close modal)
  - [ ] Handle errors (restore message, show error)
  - [ ] Clear loading state
- [ ] Implement `triggerImageUpload()` method
  - [ ] Click hidden file input
- [ ] Implement `handleImageUpload(event)` method
  - [ ] Read selected files
  - [ ] Convert to base64
  - [ ] Add to uploadedImages array
  - [ ] Reset file input
- [ ] Implement `removeImage(index)` method
  - [ ] Remove image from array
- [ ] Implement `formatTime(timestamp)` method
  - [ ] Format date to time string
  - [ ] Return empty if no timestamp
- [ ] Implement `scrollToBottom()` method
  - [ ] Scroll messages container to bottom
  - [ ] Use nextTick for timing
- [ ] Implement `onHidden()` method
  - [ ] Clear all data
  - [ ] Reset state
- [ ] Test sending messages
- [ ] Test receiving responses
- [ ] Test image upload
- [ ] Test auto-completion on approval

### Task 3.6: Create AI Chat Modal Component - Styling
**File**: `website/client/src/components/tasks/taskAIChatModal.vue` (continued)

- [ ] Style main container
  - [ ] Fixed height (600px)
  - [ ] Flex column layout
- [ ] Style task info header
  - [ ] Purple gradient background
  - [ ] White text
  - [ ] Rounded corners
  - [ ] Padding and spacing
- [ ] Style chat messages area
  - [ ] Flex: 1 (take available space)
  - [ ] Scrollable overflow
  - [ ] Light gray background
  - [ ] Padding
- [ ] Style empty chat state
  - [ ] Centered content
  - [ ] AI icon
  - [ ] Welcome text
- [ ] Style message items
  - [ ] Flex layout
  - [ ] Avatar styling (circular)
  - [ ] Message bubble
    - [ ] User: purple, right-aligned
    - [ ] Assistant: white, left-aligned
    - [ ] Rounded corners
    - [ ] Max width 70%
  - [ ] Timestamp styling
  - [ ] Slide-in animation
- [ ] Style typing indicator
  - [ ] Three dots
  - [ ] Animated bouncing
  - [ ] Gray color
- [ ] Style image preview area
  - [ ] Horizontal flex layout
  - [ ] Scrollable
  - [ ] Thumbnail size (100px)
  - [ ] Remove button (red circle with X)
- [ ] Style input area
  - [ ] Border top separator
  - [ ] Upload button
  - [ ] Textarea
    - [ ] No resize
    - [ ] Focus state (purple border)
  - [ ] Submit button
    - [ ] Primary color
    - [ ] Disabled state
    - [ ] Loading spinner
- [ ] Test all styling
- [ ] Test responsive layout
- [ ] Test animations

### Task 3.7: Register AI Chat Modal Component
- [ ] Open `website/client/src/main.js` or appropriate file
- [ ] Import TaskAIChatModal component
- [ ] Register globally with Vue.component()
- [ ] Verify modal can be opened from task component
- [ ] Test modal appears correctly

### Task 3.8: Test Complete AI Assessment Feature
- [ ] Create a todo task
- [ ] Enable AI assessment in task modal
- [ ] Save task
- [ ] Verify AI badge appears on task
- [ ] Click "Submit Proof" button
- [ ] Verify AI chat modal opens
- [ ] Send a test message (e.g., "I completed this task by...")
- [ ] Verify message appears in chat
- [ ] Verify AI response appears
- [ ] Test different scenarios:
  - [ ] Message that gets approved
  - [ ] Message that gets rejected
  - [ ] Message that needs revision
  - [ ] Image upload
  - [ ] Multiple messages in conversation
- [ ] Verify task auto-completes when approved
- [ ] Verify status badge updates correctly

---

## Phase 4: Integration & Polish (Estimated: 4-6 hours)

### Task 4.1: Cross-Feature Testing
- [ ] Test reward locked by AI-assessed task
  - [ ] Create AI todo
  - [ ] Create reward requiring that todo
  - [ ] Verify reward locked
  - [ ] Submit proof and get approval
  - [ ] Verify reward unlocks
  - [ ] Verify unlock notification
- [ ] Test multiple locked rewards
  - [ ] Create multiple rewards with shared required tasks
  - [ ] Complete one task
  - [ ] Verify all affected rewards unlock
- [ ] Test edge cases
  - [ ] Reward with no required tasks (backward compat)
  - [ ] Task with deleted required tasks
  - [ ] AI-enabled task that gets disabled

### Task 4.2: Responsive Design
- [ ] Test on mobile viewport (320px - 768px)
  - [ ] Task modal scrolls properly
  - [ ] Required tasks selector usable
  - [ ] AI chat modal fits screen
  - [ ] Touch targets large enough (44px min)
- [ ] Test on tablet viewport (768px - 1024px)
  - [ ] Modals centered and sized well
  - [ ] Layout uses space efficiently
- [ ] Test on desktop viewport (1024px+)
  - [ ] All components look polished
  - [ ] No wasted space

### Task 4.3: Accessibility Audit
- [ ] Keyboard navigation
  - [ ] Tab through all interactive elements
  - [ ] Enter/Space activates buttons/checkboxes
  - [ ] Escape closes modals
  - [ ] Ctrl/Cmd+Enter sends messages in chat
- [ ] Screen reader testing
  - [ ] All images have alt text
  - [ ] All inputs have labels
  - [ ] Modal titles announced
  - [ ] Status changes announced
- [ ] Color contrast
  - [ ] All text meets WCAG AA (4.5:1)
  - [ ] Interactive elements visible
- [ ] Focus indicators
  - [ ] All focusable elements have visible focus
  - [ ] Focus order logical

### Task 4.4: Browser Compatibility
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)
- [ ] Test in Mobile Safari (iOS 13+)
- [ ] Test in Mobile Chrome (latest)

### Task 4.5: Performance Optimization
- [ ] Verify no memory leaks
  - [ ] Event listeners cleaned up
  - [ ] Components properly destroyed
- [ ] Check bundle size
  - [ ] Lazy load chat modal if large
  - [ ] Optimize images
- [ ] Test with many tasks (100+)
  - [ ] Required tasks selector performs well
  - [ ] Chat with long history scrolls smoothly

### Task 4.6: Error Handling
- [ ] Test offline behavior
  - [ ] Show appropriate error messages
  - [ ] Retry options where applicable
- [ ] Test API errors
  - [ ] 400 errors show field validation
  - [ ] 401 errors redirect to login
  - [ ] 500 errors show user-friendly message
- [ ] Test edge cases
  - [ ] Empty responses
  - [ ] Malformed data
  - [ ] Missing required fields

---

## Phase 5: Documentation & Handoff (Estimated: 2-3 hours)

### Task 5.1: Code Documentation
- [ ] Add JSDoc comments to complex functions
- [ ] Document component props and events
- [ ] Add inline comments for tricky logic
- [ ] Update any outdated comments

### Task 5.2: User Documentation
- [ ] Create or update user guide
- [ ] Add screenshots of new features
- [ ] Write usage instructions
- [ ] Document known limitations

### Task 5.3: Developer Handoff
- [ ] Create summary of changes
- [ ] List any deviations from specs
- [ ] Document any issues or concerns
- [ ] Provide testing checklist
- [ ] Record demo video (optional but helpful)

### Task 5.4: Code Review Prep
- [ ] Run linter and fix issues
- [ ] Run tests (if any)
- [ ] Self-review code for best practices
- [ ] Clean up console.logs and debug code
- [ ] Ensure no commented-out code
- [ ] Verify all TODOs addressed

---

## Phase 6: Quality Assurance (Estimated: 4-6 hours)

### Task 6.1: Functional Testing Checklist

**Task-Locked Rewards:**
- [ ] Can create reward with no required tasks (normal behavior)
- [ ] Can add required tasks to reward
- [ ] Can remove required tasks from reward
- [ ] Can edit required tasks list
- [ ] Locked reward shows lock overlay
- [ ] Lock overlay shows correct task count
- [ ] "View Required Tasks" button opens modal
- [ ] Required Tasks modal shows correct data
- [ ] Required Tasks modal updates progress correctly
- [ ] Reward unlocks when all tasks completed
- [ ] Unlock notification appears with correct rewards
- [ ] Multiple rewards can unlock from one task
- [ ] Can purchase unlocked reward
- [ ] Cannot purchase locked reward (button disabled)

**AI Assessment:**
- [ ] Can enable AI on todo
- [ ] Can enable AI on daily
- [ ] Cannot enable AI on habit
- [ ] Cannot enable AI on reward
- [ ] AI badge shows on AI-enabled tasks
- [ ] AI badge shows correct status (pending/approved/rejected/needs_revision)
- [ ] "Submit Proof" button appears
- [ ] Clicking button opens AI chat modal
- [ ] Modal shows task info correctly
- [ ] Can send text message
- [ ] AI responds to message
- [ ] Can upload images
- [ ] Can remove uploaded images
- [ ] Multiple messages create conversation
- [ ] Task auto-completes when approved
- [ ] Task stays incomplete when rejected
- [ ] Status updates correctly after each message
- [ ] Modal closes after approval
- [ ] Chat history persists (can reopen and see old messages)
- [ ] Disabling AI clears chat

### Task 6.2: Visual Testing Checklist
- [ ] All components match design/mockups
- [ ] Colors match brand guidelines
- [ ] Typography consistent
- [ ] Spacing/padding consistent
- [ ] Icons display correctly
- [ ] Animations smooth and not jarring
- [ ] No layout shifts
- [ ] No overlapping elements
- [ ] No cut-off text
- [ ] Loading states visible but not obtrusive

### Task 6.3: UX Testing Checklist
- [ ] User flow intuitive
- [ ] Clear what actions are possible
- [ ] Feedback immediate for all actions
- [ ] Error messages helpful
- [ ] Success messages encouraging
- [ ] No dead ends (always clear next step)
- [ ] Undo/cancel options where needed
- [ ] Confirmations for destructive actions

---

## Estimation Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Setup & Assets | 3 | 2-3 hours |
| Phase 2: Task-Locked Rewards | 6 | 8-12 hours |
| Phase 3: AI Assessment | 8 | 12-16 hours |
| Phase 4: Integration & Polish | 6 | 4-6 hours |
| Phase 5: Documentation | 4 | 2-3 hours |
| Phase 6: Quality Assurance | 3 | 4-6 hours |
| **TOTAL** | **30** | **32-46 hours** |

**Note**: These are estimates for an experienced Vue.js developer familiar with Habitica's codebase. Adjust based on actual proficiency and complexity encountered.

---

## Daily Progress Tracking

Use this section to track progress (suggested):

### Day 1: ___/___/___
- [ ] Completed tasks: ____________
- [ ] Blockers: ____________
- [ ] Notes: ____________

### Day 2: ___/___/___
- [ ] Completed tasks: ____________
- [ ] Blockers: ____________
- [ ] Notes: ____________

### Day 3: ___/___/___
- [ ] Completed tasks: ____________
- [ ] Blockers: ____________
- [ ] Notes: ____________

(Continue as needed...)

---

## Common Issues & Solutions

### Issue: Modal not showing
**Solution**: Verify component is registered globally, check modal ID matches, ensure Bootstrap Vue is properly configured

### Issue: Store actions not working
**Solution**: Check action names match exactly (case-sensitive), verify store is imported, check browser console for errors

### Issue: Styles not applying
**Solution**: Ensure `<style scoped>` tag present, check CSS class names, verify SCSS compiles, clear browser cache

### Issue: API errors
**Solution**: Check backend is running, verify API endpoints in network tab, check request payload format, verify authentication

### Issue: Images not uploading
**Solution**: Check file input accept attribute, verify base64 encoding, check file size limits, verify backend handles images

---

## Getting Help

If stuck:
1. Check `FRONTEND_SPECIFICATIONS.md` for detailed requirements
2. Check `IMPLEMENTATION_GUIDE.md` for backend details
3. Review existing Habitica components for patterns
4. Check browser console for errors
5. Use Vue DevTools for debugging
6. Ask team lead or senior developer

---

## Definition of Done

A task is considered "done" when:
- [ ] Code written and follows project conventions
- [ ] Functionality works as specified
- [ ] Tested manually across scenarios
- [ ] Responsive on mobile/tablet/desktop
- [ ] Accessible (keyboard, screen reader)
- [ ] No console errors or warnings
- [ ] Code reviewed (self or peer)
- [ ] Documentation updated

---

## Notes

Use this space for additional notes, discoveries, or deviations from the plan:

---

**Good luck with the implementation! 🚀**

Remember to:
- Commit frequently with clear messages
- Test as you go
- Ask questions early
- Take breaks to stay fresh
- Celebrate small wins along the way!
