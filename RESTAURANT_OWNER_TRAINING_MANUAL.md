# MyTrainingApp — Restaurant Owner Training Manual

**Welcome to MyTrainingApp.** This guide shows restaurant owners and managers how to set up training, assign it to employees, and track progress in the admin portal.

No technical experience is required.

---

## What Is MyTrainingApp?

MyTrainingApp is a training platform for restaurant teams. It lets you:

- Create training courses using video, PDF, text, images, and quizzes
- Assign training to employees
- Track course completion and quiz performance
- Build learning paths for onboarding and certifications
- Review employees who need extra support
- Check scheduling eligibility based on training and banking information

The platform has two parts:

- **Admin Web Portal** — used by owners, managers, and administrators
- **Mobile App** — used by employees to complete training

---

## Quick Glossary

| Term | What It Means |
|---|---|
| **Business Unit** | A group of stores, brands, or regions |
| **Store** | One restaurant location |
| **Manager** | A user who manages employees and training for one or more stores |
| **Employee** | A team member who completes training in the mobile app |
| **Course** | A training module with content and a quiz |
| **Learning Path** | A group of courses assigned together |
| **Assignment** | Training given to one or more employees |
| **Scheduling Eligible** | A status showing an employee has completed required training and submitted banking information |

---

## Part 1 — Logging In

### Logging In to the Admin Portal

1. Open the admin portal link provided by your setup team
2. Enter your email address and password
3. Click **Sign In**

If you forgot your password, click **Forgot Password** on the login screen and follow the reset instructions.

### Selecting a Store

If you manage more than one store, you may see a **Select Store** screen after logging in. Choose the location you want to manage.

If only one store is assigned to you, it opens automatically.

The selected store name appears in the dashboard so you always know which location you are working in.

---

## Part 2 — Initial Setup (Admin Roles)

This section is for whoever sets up the organization structure. Store-level managers can skip to Part 3 if their account is already active.

### Step 1 — Create a Business Unit

1. Open **Business Units**
2. Click **Create Business Unit**
3. Enter the business unit name and an optional description
4. Click **Save**

### Step 2 — Create a Store

1. Open **Stores**
2. Click **Create Store**
3. Enter the store name
4. Select the business unit it belongs to
5. Click **Save**

### Step 3 — Create a Manager

1. Open **Managers**
2. Click **Create Manager**
3. Enter the manager's name, email address, phone number, and store
4. Click **Save**

The manager receives a welcome email with login details.

---

## Part 3 — Creating Courses

Courses are built in the **Courses** area of the manager portal.

### Starting a New Course

1. In the left menu, click **Courses**
2. Click **+ Create New Course**
3. Choose one of these options:
   - **Create blank course**
   - **Start from template**

If you start from a template, the system copies the course structure and quiz into a new editable course.

### Course Details

In the course builder, start in **Course details**:

1. Enter the **Course title**
2. Enter **Duration**
3. Enter **Category**

### Building Course Content

The builder uses content blocks instead of one fixed upload form.

1. Go to **Course content**
2. Click **Add block**
3. Add the content you need:
   - **Text / Rich Text**
   - **Video**
   - **Image**
   - **PDF Viewer**
   - **Callout / Tip Box**
   - **Divider**
4. Upload files where needed
5. Drag blocks to reorder them

You can also use **Lessons** if you want to split a course into multiple sections.

### Adding a Quiz

Every course can include a quiz.

1. Open the **Quiz** section
2. Set the **Passing score %**
3. Click **Add question**
4. Choose the question type:
   - **Multiple choice**
   - **True / False**
   - **Fill in the blank**
5. Enter the question and correct answer(s)

For fill-in-the-blank questions, you can add multiple accepted answers separated by commas.

### Quiz Settings

Optional quiz settings include:

- **Randomize question order**
- **Randomize answer options**
- **Question pool mode**

If you use question pool mode, you can set:

- **Total questions in pool**
- **Questions to display per quiz**

### Previewing and Saving

- Use **Preview as learner** to see how the course will look to employees
- Course edits save automatically while you work
- Existing courses can also be saved as templates for reuse

### Editing or Deleting a Course

- To edit a course, open **Courses** and click **Edit**
- To delete a course, click **Delete** and confirm

---

## Part 4 — Adding Employees

### Creating an Employee

1. Open **Employees**
2. Click **Add Employee**
3. Enter:
   - **Name**
   - **Email address**
   - **Department**
   - **Temporary password**
4. Click **Save**

The employee receives a welcome email with their login credentials.

### Viewing Employee Information

In the **Employees** list you can view:

- Name and email
- Department
- Scheduling eligibility
- Banking information
- Number of course assignments
- Number of learning path assignments

You can expand the employee card to review assigned courses and learning paths in more detail.

---

## Part 5 — Assigning Training

### Assigning Individual Courses

1. Open **Assignments**
2. Select the employee
3. Select one or more courses
4. Click **Assign**

The assigned course appears in the employee's mobile app.

### Creating a Learning Path

1. Open the **Learning Paths** menu
2. Click **Create Learning Path**
3. Enter the title and description
4. Add courses to the path
5. Choose whether the path is **Sequential**
6. Set the status to **Published** when it is ready
7. Click **Save**

### Creating a Certification Path

For certification-style training:

1. Create the learning path
2. Turn on **Is Certification**
3. Enter **Certification Expiration Days**
4. Turn on **Mandatory for Scheduling** if it must be completed before scheduling
5. Save the learning path

### Assigning a Learning Path

1. Open **Learning Paths > Assign Learning Path**
2. Select a published learning path
3. Select one or more employees
4. Optionally set a due date
5. Click **Assign**

Employees can also receive an assignment notification email if that notification flow is configured in your environment.

---

## Part 6 — Employee Experience in the Mobile App

Employees complete training in the mobile app.

### First-Time Login

1. The employee opens the MyTrainingApp mobile app
2. They enter the email address and password from their welcome email
3. They land on their course list

### Completing a Video Course

1. The employee taps a course
2. They press **Play**
3. They can adjust playback speed
4. If they leave and come back later, the video resumes where they stopped
5. When the video is complete, the quiz opens

### Completing a PDF Course

1. The employee opens the course
2. They review the PDF
3. They complete the attached quiz

### Taking a Quiz

1. The employee answers all questions
2. They submit the quiz
3. If they meet the passing score, the course is marked complete
4. If they do not pass, they can review the course and try again

### Sequential Learning Paths

If a learning path is sequential, employees must finish one course before the next course unlocks.

### Banking Information

Employees can submit banking information in the app:

1. Open **Profile**
2. Open the banking section
3. Enter transit number, institution number, and account number
4. Optionally upload a void cheque or direct deposit form image

Managers can view this information in the employee record in the web portal.

---

## Part 7 — Tracking Progress and Reports

### Training Status Overview

Use **Training Status Overview** to review team-wide completion status.

You can:

- See assigned training by employee
- Filter by completion status
- Drill into employee history

### Learning Path Progress

Use **Learning Path Progress** to see how employees are progressing through a specific learning path.

### Certification Compliance

Use **Certification Compliance** to review:

- Valid certifications
- Expiring soon
- Expired

### Quiz Performance Analytics

Use **Quiz Performance Analytics** to review quiz scores, pass rates, and attempt trends by course.

### Training Leaderboard

Use **Training Leaderboard** to compare employee performance and completion activity.

### Training Reports

Use **Training Reports** when you need downloadable records.

Available export formats include:

- PDF
- Excel
- JSON

---

## Part 8 — Supporting Employees

### Employees Needing Support

Use **Employees Needing Support** to identify employees who may need help, including employees who:

- Failed quizzes multiple times
- Scored poorly
- Have not made progress

From this screen you can:

- Review the flagged reason
- Open training history
- Log a support action
- Send a support message

---

## Part 9 — Scheduling Eligibility

An employee is marked **Scheduling Eligible** when they have:

1. Completed learning paths marked **Mandatory for Scheduling**
2. Submitted required banking information

You can see this status directly in the **Employees** list.

---

## Frequently Asked Questions

**Q: An employee says they did not receive their welcome email. What should I do?**  
Ask them to check spam or junk first. If it still is not there, recreate the user or contact your system administrator.

**Q: Can an employee retake a quiz?**  
Yes. Employees can try again after reviewing the course.

**Q: Can I update a course after assigning it?**  
Yes. Course edits update the existing course. Learning paths with active assignments may show versioning options when edited.

**Q: How do I know when a certification is expiring?**  
Open **Certification Compliance** and review the expiring and expired sections.

**Q: Can multiple managers work with the same store?**  
Yes, if those managers are assigned to that store.

---

## Quick Reference

| I Want To... | Go To... |
|---|---|
| Create a course | Courses |
| Add an employee | Employees |
| Assign a course | Assignments |
| Create a learning path | Learning Paths > Create Learning Path |
| Assign a learning path | Learning Paths > Assign Learning Path |
| Check team progress | Training Status Overview |
| Review quiz scores | Quiz Performance Analytics |
| Find struggling employees | Employees Needing Support |
| Export records | Training Reports |
| Check scheduling readiness | Employees |

---

*For technical support, contact your setup team or system administrator.*
