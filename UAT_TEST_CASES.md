# UAT Test Cases — MyTrainingApp

## How to Use This Document
- Work through test cases **in order** — later tests depend on data created in earlier ones
- For each test case, record **Pass**, **Fail**, or **Blocked** in the result column
- If a test fails, note what you saw vs. what was expected
- You will need: a computer (web portal) + an Android device with the APK installed

## Test Accounts Needed Before Starting
Have the following credentials ready before the UAT session:

| Role | Email | Password | Notes |
|---|---|---|---|
| SuperAdmin | | | Provided by dev team |
| Manager | | | Created during TC-007 |
| Employee | | | Created during TC-013 |

---

## Phase 1 — Authentication

---

### TC-001 — SuperAdmin Login (Web)
**Role:** SuperAdmin
**Pre-condition:** SuperAdmin account exists

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Open the admin web portal in a browser | Login screen appears with email and password fields | |
| 2 | Enter the SuperAdmin email and password | Fields accept input | |
| 3 | Click **Sign In** | Dashboard loads and shows SuperAdmin navigation menu with: Business Units, Stores, Managers, Organization, Unassigned Employees | |
| 4 | Click **Sign Out** | User is returned to the login screen | |

---

### TC-002 — Invalid Login Attempt (Web)
**Role:** Any
**Pre-condition:** Admin portal is open

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Enter a valid email but a wrong password | Fields accept input | |
| 2 | Click **Sign In** | An error message appears (e.g., "Incorrect username or password"). User is NOT logged in | |

---

### TC-003 — Forgot Password (Web)
**Role:** Any
**Pre-condition:** A valid account exists

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | On the login screen, click **Forgot Password** | A form appears asking for the email address | |
| 2 | Enter a valid account email and submit | A message says a reset code has been sent | |
| 3 | Check the email inbox for the reset code | A password reset email is received | |
| 4 | Enter the code and set a new password | Success message appears; user can now log in with the new password | |

---

### TC-004 — Employee Login on Mobile App
**Role:** Employee
**Pre-condition:** APK is installed on Android device; employee account exists (created in TC-013)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Open the MyTrainingApp on the Android device | Login screen appears | |
| 2 | Enter employee email and the temporary password they received | Fields accept input | |
| 3 | Tap **Sign In** | App prompts employee to set a new password (first login) OR navigates directly to the course list | |
| 4 | If prompted, enter and confirm a new password | Employee lands on the course list screen | |

---

## Phase 2 — Organisation Setup

*Note: This phase must be completed by the SuperAdmin before any other roles can be tested.*

---

### TC-005 — Create a Business Unit
**Role:** SuperAdmin
**Pre-condition:** Logged in as SuperAdmin

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the left menu, click **Business Units** | Business Unit list screen loads | |
| 2 | Click **Create Business Unit** | A form appears with Name and Description fields | |
| 3 | Enter a name (e.g., "Eastern Region") and a description | Fields accept input | |
| 4 | Click **Save** | Success confirmation appears; the new Business Unit appears in the list | |

---

### TC-006 — Create a Store
**Role:** SuperAdmin or Business Unit Admin
**Pre-condition:** At least one Business Unit exists (TC-005)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the left menu, click **Stores** | Store list loads | |
| 2 | Click **Create Store** | A form appears with Name and Business Unit fields | |
| 3 | Enter a store name (e.g., "Downtown Store") and select the Business Unit created in TC-005 | Fields accept input | |
| 4 | Click **Save** | Success confirmation appears; store appears in the list | |

---

### TC-007 — Create a Manager Account
**Role:** SuperAdmin or Store Admin
**Pre-condition:** At least one Store exists (TC-006)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the left menu, click **Managers** | Manager list loads | |
| 2 | Click **Create Manager** | A form appears | |
| 3 | Enter manager name, email, and phone number; assign to the store from TC-006 | Fields accept input | |
| 4 | Click **Save** | Success confirmation; manager appears in the list | |
| 5 | Check the manager's email inbox | A welcome/account creation email is received with login instructions | |
| 6 | Log out as SuperAdmin and log in using the new manager credentials | Manager is prompted to select a store (if multiple) then the Manager dashboard loads | |

---

## Phase 3 — Store Selection (Manager)

*Performed by the Manager. Log in as Manager before starting this phase.*

---

### TC-008 — Manager Store Selection
**Role:** Manager
**Pre-condition:** Logged in as Manager; manager is assigned to at least one store

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | After logging in, observe the store selection screen | A "Select Store" screen appears listing all stores assigned to this manager | |
| 2 | Click on the store created in TC-006 | The Manager dashboard loads and shows the selected store name | |
| 3 | Verify the navigation menu on the left sidebar | Menu shows: Dashboard, Courses, Employees, Assignments, Analytics, Training Status Overview, Quiz Performance Analytics, Employees Needing Support, Training Reports, Training Leaderboard, and a Learning Paths submenu | |

---

## Phase 4 — Course Management

---

### TC-009 — Create a Video Course with Quiz
**Role:** Manager
**Pre-condition:** Logged in as Manager; store selected; have a short video file and a thumbnail image ready

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Courses** | Course list screen loads | |
| 2 | Click **Create Course** | A choice appears: "Start from Blank" or "Start from Template" | |
| 3 | Click **Start from Blank** | Course creation form opens | |
| 4 | Enter a course title (e.g., "Food Safety Basics") and description | Fields accept input | |
| 5 | Under Content Type, select **Video** | Video upload section appears | |
| 6 | Upload a thumbnail image (drag-and-drop or browse) | Image uploads and a preview is shown | |
| 7 | Upload a video file (drag-and-drop or browse) | Upload progress bar appears; video uploads successfully | |
| 8 | Set Duration (e.g., "10 min") and Category (e.g., "Compliance") | Fields accept input | |
| 9 | Set Passing Score (e.g., 80) | Field accepts input | |
| 10 | Scroll to the Quiz section; click **Add Question** | A question form appears | |
| 11 | Select question type **Multiple Choice**; enter a question, 4 answer options, and select the correct answer | Fields accept input | |
| 12 | Add a second question with type **True/False** | True/False question is added with two options | |
| 13 | Add a third question with type **Fill in the Blank**; enter the accepted answer(s) | Fill-in-the-blank question is added | |
| 14 | Click **Save Course** | Success confirmation appears; course appears in the course list | |

---

### TC-010 — Create a PDF Course
**Role:** Manager
**Pre-condition:** Logged in as Manager; have a PDF file ready

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Click **Create Course** then **Start from Blank** | Course form opens | |
| 2 | Enter title (e.g., "Employee Handbook") and description | Fields accept input | |
| 3 | Under Content Type, select **PDF** | PDF upload section appears | |
| 4 | Upload a PDF file and enter a PDF title | PDF uploads successfully | |
| 5 | Set a passing score and add at least 1 quiz question | Fields accept input | |
| 6 | Click **Save Course** | Course saved and appears in the list | |

---

### TC-011 — Quiz Randomization Settings
**Role:** Manager
**Pre-condition:** At least one course exists (TC-009)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the course list, click **Edit** on the course from TC-009 | Course form opens pre-filled with existing data | |
| 2 | Toggle on **Randomize Questions** | Switch turns on | |
| 3 | Toggle on **Randomize Options** | Switch turns on | |
| 4 | Toggle on **Use Question Pool**; set pool size and questions to display | Pool size and questions-to-display fields appear and accept input | |
| 5 | Click **Save Course** | Success confirmation; settings are saved | |

---

### TC-012 — Edit and Delete a Course
**Role:** Manager
**Pre-condition:** At least two courses exist (TC-009, TC-010)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the course list, click **Edit** on the course from TC-009 | The course form opens pre-filled with existing data | |
| 2 | Change the course description to something new | Field accepts the change | |
| 3 | Click **Save Course** | Success confirmation; the updated description is now shown | |
| 4 | Create a throwaway course (title: "Delete Test", any content type) and save it | Course appears in the list | |
| 5 | Click the **Delete** button on the "Delete Test" course | A confirmation dialog appears ("Are you sure?") | |
| 6 | Confirm deletion | Success confirmation; course is removed from the list | |

---

## Phase 5 — Employee Management

---

### TC-013 — Create an Employee
**Role:** Manager
**Pre-condition:** Logged in as Manager; store selected; have a real email address to use for the employee

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Employees** | Employee list loads | |
| 2 | Click **Add Employee** | Employee creation form opens | |
| 3 | Enter employee name, email address, department, and a temporary password | Fields accept input | |
| 4 | Click **Save** | Success confirmation; employee appears in the list with their name, email, and department | |
| 5 | Check the employee's email inbox | A welcome email arrives with the app name, login instructions, and the temporary password | |

---

### TC-014 — View Employee Details
**Role:** Manager
**Pre-condition:** At least one employee exists (TC-013)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the employee list, locate the employee from TC-013 | Employee is listed with their name, email, and department | |
| 2 | Click on the employee to view their profile | Employee detail view opens showing their information and (empty) training history | |

---

## Phase 6 — Course Assignment

---

### TC-015 — Assign a Course to an Employee
**Role:** Manager
**Pre-condition:** At least one course (TC-009) and one employee (TC-013) exist

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Assignments** | Assignment form loads with employee and course dropdowns | |
| 2 | Select the employee from TC-013 | Employee is selected | |
| 3 | Select the video course from TC-009 (you can select multiple courses) | Course(s) selected | |
| 4 | Click **Assign** | Success confirmation appears | |
| 5 | On the Android device, log in as the employee | Employee logs into the mobile app | |
| 6 | Check the course list on mobile | The assigned course appears in the employee's course list with status "Not Started" | |

---

## Phase 7 — Learning Paths (Create, Edit, Assign)

---

### TC-016 — Create a Learning Path
**Role:** Manager
**Pre-condition:** At least 2 courses exist (TC-009 and TC-010)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, expand the **Learning Paths** submenu | Submenu shows: Create Learning Path, Assign Learning Path, Learning Path Progress, Certification Compliance | |
| 2 | Click **Create Learning Path** | The Learning Path list and create form loads | |
| 3 | Enter a title (e.g., "New Employee Onboarding") and description | Fields accept input | |
| 4 | Set the path to **Sequential** (must complete in order) | Toggle is turned on | |
| 5 | From the available courses dropdown, add the course from TC-009 first, then TC-010 | Both courses appear in the selected list in the correct order, each marked as "Required" | |
| 6 | Set status to **Published** | Status changes to Published | |
| 7 | Click **Save** | Success confirmation; learning path appears in the learning path list | |

---

### TC-017 — Create a Certification Learning Path
**Role:** Manager
**Pre-condition:** At least 1 course exists

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Click **Create Learning Path** | Create form opens | |
| 2 | Enter a title (e.g., "Annual Safety Certification") and description | Fields accept input | |
| 3 | Toggle on **Is Certification** | Certification expiration days field appears | |
| 4 | Set certification expiration to 365 days | Field accepts input | |
| 5 | Toggle on **Mandatory for Scheduling** | Toggle turns on | |
| 6 | Add at least one course and set status to **Published** | Course is added; status is set | |
| 7 | Click **Save** | Success confirmation; learning path shows "Certification" tag in the list | |

---

### TC-018 — Edit a Learning Path
**Role:** Manager
**Pre-condition:** A learning path exists (TC-016)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the learning path list, click the **Edit** icon on the path from TC-016 | Edit form opens pre-filled with existing data | |
| 2 | Change the description | Field accepts the change | |
| 3 | Reorder courses by dragging them | Course order updates visually | |
| 4 | Click **Save** | A versioning dialog may appear if there are active assignments; otherwise, success confirmation | |

---

### TC-019 — Archive a Learning Path
**Role:** Manager
**Pre-condition:** A learning path exists (TC-017)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the learning path list, click the **Archive** icon on the certification path from TC-017 | A confirmation prompt appears | |
| 2 | Confirm the archive action | Path moves to the archived section | |
| 3 | Toggle **Show Archived** on | Archived path appears in the list with an "Archived" indicator | |
| 4 | Click **Unarchive** on the path | Path is restored to the active list | |

---

### TC-020 — Assign a Learning Path to an Employee
**Role:** Manager
**Pre-condition:** A published learning path exists (TC-016) and employee exists (TC-013)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the Learning Paths submenu, click **Assign Learning Path** | Assignment screen loads showing available learning paths | |
| 2 | Find the learning path from TC-016 | Path is listed with its title and course count | |
| 3 | Click **Assign** on the learning path | A list of employees appears | |
| 4 | Select the employee from TC-013 | Employee is selected | |
| 5 | Optionally set a due date | Date field accepts input | |
| 6 | Click **Assign** | Success confirmation appears | |
| 7 | Check the employee's email inbox | A learning path assignment notification email is received with the path title and due date (if set) | |
| 8 | On mobile, log in as the employee | The learning path and its courses appear in the course list | |

---

## Phase 8 — Employee Training Experience (Mobile)

*All steps in this phase are performed on the Android device as the Employee.*

---

### TC-021 — Complete a Video Course
**Role:** Employee (mobile)
**Pre-condition:** A video course has been assigned (TC-015); employee is logged in on mobile

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | On the course list, tap the assigned video course | Course details screen opens; video player loads | |
| 2 | Press **Play** on the video | Video plays with audio | |
| 3 | Use the playback speed control (e.g., 1.5x) | Playback speed changes | |
| 4 | Close the app mid-video and re-open it | App resumes the video from approximately where it was left off | |
| 5 | Watch the video to completion | A prompt appears to take the quiz OR the quiz screen loads automatically | |

---

### TC-022 — Pass a Quiz
**Role:** Employee (mobile)
**Pre-condition:** TC-021 completed; quiz has at least 3 questions

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | On the quiz screen, answer all questions correctly (including fill-in-the-blank if present) | All questions are answered | |
| 2 | Submit the quiz | Result screen shows the score (e.g., 100%) and a "Passed" message | |
| 3 | Return to the course list | The course now shows as **Completed** in the list | |
| 4 | On the web portal, log in as the Manager | Manager dashboard loads | |
| 5 | Check the Manager's email inbox | A completion notification email is received with the employee's name, course title, and score | |
| 6 | Navigate to **Training Status Overview** in the sidebar | The employee's course shows as Completed with the correct score | |

---

### TC-023 — Fail a Quiz and Retake
**Role:** Employee (mobile)
**Pre-condition:** A course with a quiz is assigned and the video has been watched

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Begin the quiz and deliberately answer all questions incorrectly | Questions are answered | |
| 2 | Submit the quiz | Result screen shows the score is below the passing threshold and displays "Failed" | |
| 3 | Return to the course list | The course still shows as **In Progress** (not Completed) | |
| 4 | Re-open the course and take the quiz again, this time answering correctly | Quiz accepts a second attempt | |
| 5 | Submit the quiz | Result screen shows "Passed" | |

---

### TC-024 — View a PDF Course
**Role:** Employee (mobile)
**Pre-condition:** A PDF course has been assigned (via learning path TC-020 or individual assignment)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | On the course list, tap the PDF course | Course opens and the PDF document is displayed | |
| 2 | Scroll through the PDF | PDF scrolls and content is readable | |
| 3 | Close the PDF and take the attached quiz | Quiz loads and can be completed | |

---

### TC-025 — Learning Path Sequential Completion (Mobile)
**Role:** Employee (mobile)
**Pre-condition:** Learning path from TC-020 is assigned; it is set to Sequential

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | On the course list, find the Learning Path section | Learning path "New Employee Onboarding" appears with its courses listed in order | |
| 2 | Verify Course 1 (video course) is available to start | Course 1 is tappable / accessible | |
| 3 | Verify Course 2 (PDF course) is locked or greyed out | Course 2 is not accessible until Course 1 is completed (sequential enforcement) | |
| 4 | Complete Course 1 (watch video + pass quiz) | Course 1 status changes to Completed | |
| 5 | Verify Course 2 is now unlocked | Course 2 is now tappable / accessible | |
| 6 | Complete Course 2 (read PDF + pass quiz) | Course 2 status changes to Completed; learning path shows as Completed | |

---

### TC-026 — Employee Adds Banking Information (Mobile)
**Role:** Employee (mobile)
**Pre-condition:** Employee is logged in on mobile

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to the **Profile** screen | Profile screen loads with employee's name and email | |
| 2 | Tap **Edit Profile** or the banking section | Banking information form appears | |
| 3 | Enter Transit Number, Institution Number, and Account Number | Fields accept numeric input | |
| 4 | Upload a void cheque or direct deposit form image | File upload prompt appears; file is uploaded successfully | |
| 5 | Save the changes | Success confirmation; banking info is saved | |
| 6 | On the web portal, log in as Manager and view the employee's profile | Banking fields are visible to the manager (read-only) | |

---

## Phase 9 — Learning Path Progress Tracking

---

### TC-027 — Track Learning Path Progress
**Role:** Manager
**Pre-condition:** A learning path has been assigned (TC-020) and the employee has completed at least 1 course in it (TC-025)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, expand Learning Paths and click **Learning Path Progress** | Progress tracking screen loads | |
| 2 | Find the learning path from TC-016 in the list | Path is listed with its title | |
| 3 | Expand or click on the learning path to view employee progress | Employee from TC-013 appears with their progress details | |
| 4 | Verify progress bar and status | Progress shows number of courses completed out of total; overall status shows "Completed" or "In Progress" | |
| 5 | Verify due date is displayed (if one was set in TC-020) | Due date column shows the correct date | |

---

### TC-028 — Certification Compliance Dashboard
**Role:** Manager
**Pre-condition:** A certification learning path has been assigned (TC-017 assigned to an employee)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the Learning Paths submenu, click **Certification Compliance** | Certification compliance screen loads with tabs: Expiring Soon, Expired, Valid | |
| 2 | Check the **Valid** tab | Any employees who have completed a certification path are listed with their expiration date | |
| 3 | Check the **Expiring Soon** tab | Employees whose certifications are approaching expiration appear here (if any) | |
| 4 | Check the **Expired** tab | Employees whose certifications have expired appear here (if any) | |

---

## Phase 10 — Analytics & Reporting

*Performed by the Manager on the web portal.*

---

### TC-029 — View Training Status Dashboard
**Role:** Manager
**Pre-condition:** At least one employee has completed a course (TC-022)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Training Status Overview** | Dashboard loads with a table of employees and their training status | |
| 2 | Locate the employee who completed the course | Their row shows the course as Completed with a completion date | |
| 3 | Use the search/filter to filter by "Completed" status | Only completed records are shown | |
| 4 | Click on the employee's row to drill in | Detailed training history for that employee is displayed | |

---

### TC-030 — View Quiz Performance Analytics
**Role:** Manager
**Pre-condition:** At least one quiz has been attempted (TC-022 or TC-023)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Quiz Performance Analytics** | Analytics screen loads | |
| 2 | Select the video course from TC-009 from the dropdown | Quiz data for that course is shown (pass rate, score distribution, number of attempts) | |
| 3 | Review the charts | Charts display and data matches what was recorded during TC-022/TC-023 | |

---

### TC-031 — View Training Leaderboard
**Role:** Manager
**Pre-condition:** At least one employee has completed training

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Training Leaderboard** | Leaderboard screen loads | |
| 2 | Review the ranking | Employees are ranked by courses completed and average score | |
| 3 | Verify the employee from TC-022 appears on the leaderboard | Employee is listed with correct course count and score | |

---

### TC-032 — Export a Training Report
**Role:** Manager
**Pre-condition:** At least one employee has completed training

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Training Reports** | Reports screen loads | |
| 2 | Select "Completion Report" and click **Export** | A prompt appears to download as PDF, Excel, or JSON | |
| 3 | Download as Excel | File downloads to the computer | |
| 4 | Open the file | File opens with employee names, course titles, completion dates, and scores | |

---

## Phase 11 — Employee Support

---

### TC-033 — View Employees Needing Support
**Role:** Manager
**Pre-condition:** An employee has failed a quiz (TC-023)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the sidebar, click **Employees Needing Support** | Screen loads showing employees who are flagged (failed quizzes, low scores, no progress) | |
| 2 | Locate the employee who failed in TC-023 | Employee appears with flag type "Failed Quizzes" | |
| 3 | Click on the employee | Support details and training history appear | |
| 4 | Log a support action (e.g., "Called employee to discuss training") | Support action is saved | |
| 5 | Click **Send Support Message** | Email is sent to the employee with an encouraging message | |
| 6 | Check the employee's email inbox | A support email is received from the manager | |

---

## Phase 12 — Scheduling Eligibility

---

### TC-034 — Verify Scheduling Eligibility
**Role:** Manager
**Pre-condition:** Employee has completed all mandatory-for-scheduling learning paths and has submitted banking information (TC-026)

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | In the employee list, locate the employee from TC-013 | Employee is visible | |
| 2 | Check if a "Scheduling Eligible" indicator is shown | Employee who has completed mandatory learning paths AND submitted banking info shows as scheduling eligible | |
| 3 | Verify an employee who has NOT completed mandatory paths does NOT show as scheduling eligible | The indicator is absent or shows "Not Eligible" | |

---

## Test Summary Checklist

| Phase | Test Cases | Status |
|---|---|---|
| Phase 1 — Authentication | TC-001 to TC-004 | |
| Phase 2 — Organisation Setup | TC-005 to TC-007 | |
| Phase 3 — Store Selection | TC-008 | |
| Phase 4 — Course Management | TC-009 to TC-012 | |
| Phase 5 — Employee Management | TC-013 to TC-014 | |
| Phase 6 — Course Assignment | TC-015 | |
| Phase 7 — Learning Paths (Create, Edit, Assign) | TC-016 to TC-020 | |
| Phase 8 — Mobile Training Experience | TC-021 to TC-026 | |
| Phase 9 — Learning Path Progress Tracking | TC-027 to TC-028 | |
| Phase 10 — Analytics & Reporting | TC-029 to TC-032 | |
| Phase 11 — Employee Support | TC-033 | |
| Phase 12 — Scheduling Eligibility | TC-034 | |

---

## Notes for the UAT Session

- **Test data:** Use real but non-sensitive email addresses for all accounts. Emails will be sent.
- **APK installation:** On the Android device, ensure "Install from unknown sources" is enabled in settings before installing the APK.
- **Order matters:** Do not skip test cases — each phase builds on the previous one's data.
- **Email checks:** Keep the employee and manager email inboxes open throughout the session — several test cases require verifying email delivery.
- **Failed tests:** Do not try to work around a failure — log it and move to the next test case.
- **Blocked tests:** If a test is blocked (e.g., Phase 8 blocked because Phase 6 failed), mark it Blocked and note the dependency.
- **Store selection:** The Manager must select a store after login before accessing any features. If only one store is assigned, it auto-selects.
