# QA Environment Setup – Requirements vs Current State

This document maps the **QA Environment with Web URL and Non-Developer Android Testing** requirements to what is **currently in place** and what **still needs to be done**. Use it to drive implementation and to hand off to QA/manual testers.

---

## 1. Acceptance criteria vs status

| # | Acceptance criterion | Status | Notes |
|---|------------------------|--------|--------|
| 1 | Persistent QA environment in AWS Amplify with isolated resources (Cognito, DynamoDB, S3, AppSync) for Admin Portal and Android app | **Partially ready** | Branch-based Amplify deploys give isolation per branch; a dedicated **qa** branch must be created and connected in Amplify Console. |
| 2 | QA environment replicates production backend schema and auth (Cognito groups: Employees, Managers) | **Done** | Same `amplify/data/resource.ts` schema and auth groups (Employees, Managers, Store, BusinessUnit, SuperAdmin) deploy per branch. |
| 3 | Admin Portal deployed to a stable QA-specific URL (e.g. https://qa.mytrainingapp.com) | **Partially ready** | `amplify.yml` builds and deploys the admin app per branch; connecting a **qa** branch in Amplify gives a URL like `https://qa.<app-id>.amplifyapp.com`. Custom domain (e.g. qa.mytrainingapp.com) is optional and configured in Amplify Console. |
| 4 | Non-developer testers can download and install a pre-built Android APK (from QA branch) without Android Studio | **Not done** | No CI build for Android APK, no S3 (or other) distribution, no documented download link or QR code. |
| 5 | User stories deployed to QA by pushing to **qa** branch; automatic Amplify builds | **Partially ready** | Amplify build is defined in `amplify.yml` and uses `$AWS_BRANCH`; **qa** branch must be connected in Amplify Console to trigger builds on push. |
| 6 | Test data (sample users, courses, assignments, videos) seeded into QA | **Not done** | No seeding Lambda, script, or test accounts (e.g. qa-manager@test.com, qa-employee@test.com). |
| 7 | End-to-end flow validated: Manager creates course → assigns to employee → Employee completes in app → Manager gets SNS notification | **Manual only** | No automated E2E tests; flow can be tested manually once QA env and test data exist. |
| 8 | Automated tests (Cypress web, Detox Android) run against QA | **Not done** | No Cypress or Detox; only Jest/React Testing Library in admin. |
| 9 | Manual testing instructions for non-developers (QA URL, APK link, test accounts) | **Not done** | No single doc with QA URL, APK download, and credentials. |
| 10 | QA environment secure; access restricted to authorized testers | **Partially ready** | Cognito and Amplify Console support access control; QA-specific restrictions (e.g. invite-only pool or Amplify access) not yet configured or documented. |

---

## 2. What is currently in place

### 2.1 AWS Amplify and build

- **Region:** ca-central-1.
- **Amplify Gen 2** backend: Auth (Cognito), Data (AppSync + DynamoDB), Storage (S3), and Lambdas (e.g. quizCompletion, assignEmployeeGroup, schedulingEligibility).
- **Build spec:** `amplify.yml` at repo root:
  - Backend: `npx @aws-amplify/backend-cli pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID` → produces `amplify_outputs.json`.
  - Frontend: builds `my-training-admin` (React) and deploys `my-training-admin/build` as the hosting artifact.
- **Branch-based deployment:** The same `amplify.yml` runs for whatever branch is connected in Amplify Console. Connecting a **qa** branch will create a **QA backend** (separate Cognito, AppSync, DynamoDB, S3) and a **QA hosting URL** for the Admin Portal.

### 2.2 Backend and auth

- **Schema:** Course, QuizQuestion, Employee, Assignment, Result, LearningPath, LearningPathCourse, LearningPathAssignment, Manager, Store, BusinessUnit, ManagerStore, EmployeeSupport, etc. (see `amplify/data/resource.ts`).
- **Cognito:** Email sign-in; groups: Employees, Managers, Store, BusinessUnit, SuperAdmin. Post-confirmation trigger: `assignEmployeeGroup`.
- **Callback URLs** (in `amplify/auth/resource.ts`): include `http://localhost:3000` and `https://dev.d6c38s8spsb1t.amplifyapp.com`. **QA URL is not yet added**; it must be added when the QA branch URL is known (or via env vars).

### 2.3 Admin Portal (React)

- **App:** `my-training-admin` (Create React App, React 19, MUI, Amplify).
- **Config:** Uses `amplify_outputs.json` (from build or copied to `src/`). Amplify Hosting injects the correct outputs for the deployed branch.
- **Tests:** `npm test` (Jest + React Testing Library). No Cypress or E2E against a live QA URL.

### 2.4 Mobile app (Flutter)

- **App:** Flutter app in repo root (`lib/`, `pubspec.yaml`); Android in `android/`.
- **Config:** Reads `amplify_outputs.json` from `assets/amplify_outputs.json` at runtime. For QA, the APK must be built with the **QA** `amplify_outputs.json` (or the app must support switching config by build flavor/env).
- **Build:** Manual only: `flutter build apk` (or `flutter build appbundle`). No GitHub Actions (or other CI) building APK on **qa** branch or publishing it.

### 2.5 What is not in place

- No **.github/workflows** (no CI/CD in repo).
- No **qa** branch created or documented as the QA branch.
- No **test data seeding** (no Lambda/script for QA users, courses, assignments, videos).
- No **Android APK** build in CI, no S3 (or other) bucket for APK, no public or signed download link, no QR code.
- No **Cypress** (admin) or **Detox** (mobile) E2E tests.
- No **QA-specific README** for testers (QA URL, APK link, test accounts, manual test steps).
- **Auth:** QA Hosting URL not yet in Cognito callback/logout URLs.

---

## 3. What needs to be done (implementation checklist)

### Phase 1: QA Amplify environment (1–2 days)

1. **Create and use a qa branch**
   - `git checkout -b qa` (if not exists) and push.
   - In **Amplify Console** → App → Connect branch → connect **qa**.
   - Confirm builds run from `amplify.yml` and that the Admin Portal is available at the branch URL (e.g. `https://qa.<app-id>.amplifyapp.com`).

2. **Add QA URL to Cognito**
   - In `amplify/auth/resource.ts`, ensure the QA Hosting URL is in callback and logout URL lists (e.g. via `OAUTH_CALLBACK_URLS` / `OAUTH_LOGOUT_URLS` env in Amplify, or by adding the qa branch URL explicitly).
   - Redeploy backend for the qa branch and verify login from the QA admin URL.

3. **(Optional) Custom domain**
   - In Amplify Console, add a custom domain (e.g. `qa.mytrainingapp.com`) for the qa branch and document the final QA URL.

### Phase 2: GitHub Actions CI/CD (about 1 day)

4. **Add `.github/workflows`**
   - **Option A – Amplify only:** Rely on Amplify’s native branch builds (push to **qa** → Amplify builds and deploys). No workflow required for Admin Portal.
   - **Option B – GitHub Actions:** Add a workflow that triggers on push to **qa** (e.g. build and run tests; optional: trigger Amplify build via CLI or API). Use this for test runs and future APK build.

5. **Branch strategy**
   - Document: “Push to **qa** deploys QA environment” and point to the QA URL in Amplify.

### Phase 3: Android APK build and distribution (about 1 day)

6. **Build APK for QA**
   - **Option A – Manual (minimal):** Document: (1) Checkout **qa**, (2) Copy QA `amplify_outputs.json` to `assets/amplify_outputs.json`, (3) Run `flutter build apk`, (4) Share `build/app/outputs/flutter-apk/app-release.apk` (e.g. internal link or USB).
   - **Option B – CI:** Add a GitHub Actions job (on push to **qa**): checkout, install Flutter, get QA `amplify_outputs.json` (e.g. from Amplify build artifact or a stored QA config), place in `assets/`, run `flutter build apk`, upload artifact (and optionally to S3).

7. **Distribution**
   - Create an S3 bucket (or use existing) for QA artifacts. Enable public read or signed URL for the QA APK.
   - Document the **APK download link** (e.g. `https://<bucket>.s3.<region>.amazonaws.com/MyTrainingApp-qa.apk` or a short link).
   - Optionally generate a **QR code** pointing to that link for testers.

8. **Flutter config for QA**
   - Ensure the Flutter app uses `assets/amplify_outputs.json` for the backend. For CI-built QA APK, this file must be the QA backend outputs (from Amplify qa branch or a stored copy).

### Phase 4: Test data seeding (about 1 day)

9. **Define test data**
   - Sample manager(s): e.g. `qa-manager@test.com` / `TempPass123!`.
   - Sample employee(s): e.g. `qa-employee@test.com` / `TempPass123!`.
   - Sample courses (with video key and quiz), and optionally assignments linking manager/employee.

10. **Implement seeding**
    - **Option A – Script:** Node (or other) script that uses Amplify/Cognito/AppSync to create users and data; run once per QA env (e.g. after first deploy). Requires QA `amplify_outputs.json` and credentials.
    - **Option B – Lambda:** Seeding Lambda triggered manually or by a one-off invocation after QA deploy; creates Cognito users (or uses Admin APIs) and AppSync data. Lambda needs IAM/API key for Cognito and AppSync.

11. **Document credentials**
    - Put test accounts and (if applicable) how to reset data in the “Manual testing instructions” section below.

### Phase 5: Automated testing (2–3 days)

12. **Cypress (Admin Portal)**
    - Add Cypress to `my-training-admin`, add E2E tests for: login as manager, create course, assign to employee (and optionally: trigger notification).
    - Run tests in CI against the QA Admin URL (env: `CYPRESS_BASE_URL=https://qa.<app-id>.amplifyapp.com` or custom QA domain).

13. **Detox or integration_test (Flutter)**
    - Add Detox (or Flutter `integration_test`) for: login as employee, open assigned course, play video, submit quiz, see result.
    - Run against QA backend (APK built with QA `amplify_outputs.json`).

14. **Postman/Newman (optional)**
    - Export AppSync/Cognito requests as a collection; run with Newman in CI against QA AppSync endpoint and QA User Pool.

### Phase 6: Documentation and access (about 1 day)

15. **Manual testing instructions (for non-developers)**
    - **QA Admin URL:** `https://qa.<app-id>.amplifyapp.com` (or `https://qa.mytrainingapp.com`).
    - **APK download:** [link to QA APK].
    - **Test accounts:** e.g. Manager: qa-manager@test.com / TempPass123!; Employee: qa-employee@test.com / TempPass123!.
    - **Steps:** e.g. (1) Manager logs in at QA URL → creates course with video + quiz → assigns to employee; (2) Employee installs APK → logs in → completes course and quiz; (3) Manager receives email (SNS) and sees completion in admin.

16. **Security**
    - Restrict Cognito sign-up to invited users (e.g. invite-only or pre-created test users) and/or restrict Amplify Console access to QA team.
    - Document who has access and how to request it.

---

## 4. Manual testing instructions (template for when QA is ready)

Use this section once the QA URL, APK link, and test accounts exist. Fill in the placeholders.

### 4.1 Access

- **Admin Portal (QA):** [QA_URL e.g. https://qa.xxxxx.amplifyapp.com]
- **Android APK (QA):** [APK_DOWNLOAD_LINK or QR code]
- **Test accounts:**
  - Manager: [e.g. qa-manager@test.com / TempPass123!]
  - Employee: [e.g. qa-employee@test.com / TempPass123!]

### 4.2 Install Android app (non-developer)

1. Open the APK download link on your Android device (or scan the QR code).
2. Download and install the APK (allow “Install from unknown sources” if prompted).
3. Open the app and log in with the Employee test account when testing employee flows.

### 4.3 End-to-end test flow

1. **Manager – Admin Portal**
   - Log in at the QA Admin URL with the Manager account.
   - Create a course: add title, description, upload video (or use existing test video), add quiz questions, set passing score, save/publish.
   - Create or select an employee; assign the course to that employee.

2. **Employee – Android app**
   - Log in with the Employee account.
   - Open “My training” or equivalent; confirm the assigned course appears.
   - Open the course, play the video (or view content), complete the quiz, submit.

3. **Manager – notification**
   - Check the Manager email for the SNS completion notification.
   - In the Admin Portal, confirm the assignment shows as completed and (if applicable) the employee’s result.

### 4.4 Notes

- QA uses a **separate** backend from production; no production data is used.
- To get a fresh QA state, re-run the seeding script or re-create test users/courses as documented by the team.

---

## 5. Summary

| Area | Status | Action |
|------|--------|--------|
| QA Amplify environment | Partial | Create **qa** branch, connect in Amplify, add QA URL to auth. |
| Admin Portal QA URL | Partial | Use branch URL (or custom domain) from Amplify. |
| Android APK for QA | Not done | Add build (manual or CI), distribution (e.g. S3), and QA config (amplify_outputs). |
| Test data | Not done | Add seeding (script or Lambda) and document test accounts. |
| E2E tests | Not done | Add Cypress (admin) and Detox/integration_test (Flutter); run against QA. |
| Docs & access | Not done | Add QA README with URL, APK link, credentials, and steps; tighten access. |

Implementing the phases above in order will satisfy the acceptance criteria: persistent QA environment, stable Admin URL, installable QA APK for non-developers, deployments from **qa** branch, test data, and a clear path to automated and manual testing.
