# AI Chatbot Feature — Manager Training Assistant

## Prerequisites

### 1. Anthropic Account & API Key *(external setup — do this first)*
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Add a payment method and purchase credits (pay-as-you-go; Haiku is very cheap)
- Generate an API key — treat it like a password, never commit it to git
- Store it as a Lambda environment variable: `CLAUDE_API_KEY`

### 2. Fix AppSync Authorization for the Chatbot Lambda *(critical blocker)*
Your existing Lambdas call AppSync using the public API key (`x-api-key` header). That works for models that have `allow.publicApiKey()` in their auth rules. But several models the chatbot needs do **not** have that permission:

| Model | publicApiKey access? | Chatbot needs it? |
|---|---|---|
| `Assignment` | read ✓ | Yes |
| `Employee` | read ✓ | Yes |
| `Course` | read ✓ | Yes |
| `Result` | **None** ✗ | Yes — quiz scores |
| `EmployeeSupport` | **None** ✗ | Yes — support history |
| `LearningPathAssignment` | **None** ✗ | Yes — path progress |
| `LearningPath` | **None** ✗ | Yes |

**Solution:** Pass the manager's Cognito JWT token from the React frontend to the Lambda with each chat request. The Lambda then calls AppSync using `Authorization: Bearer <token>` instead of the API key. This means all existing auth rules apply automatically — the Lambda queries data as the manager, so it can only see what the manager is allowed to see. No schema changes required.

### 3. Install the Anthropic SDK in the Lambda
Add `@anthropic-ai/sdk` as a dependency in the new `chatbotQuery` Lambda package. Amplify Gen 2 uses esbuild to bundle Lambdas, so the SDK will be included automatically at deploy time.

```bash
# In the new Lambda directory
npm install @anthropic-ai/sdk
```

### 4. Lambda Invocation Method from the React Frontend
Your existing Lambdas (e.g. `quizCompletion`) use Function URLs for HTTP invocation. Use the same pattern for the chatbot Lambda — give it a Function URL and call it from `ChatWidget.tsx` using a standard `fetch()` with the manager's JWT token in the request body.

### 5. No Other AWS Services Needed
- No new DynamoDB tables
- No new S3 buckets
- No SNS, SES, or other services
- Reuses your existing AppSync endpoint entirely

---

## Overview

A conversational AI assistant embedded in the manager admin portal that answers cross-dataset training questions in plain English. Instead of navigating multiple dashboards, managers can ask questions naturally and get immediate, synthesized answers pulled directly from live AppSync data.

**Scope:** Manager-facing only (admin portal). Employee-facing is a separate future consideration.

---

## Architecture

```
Manager types question (chat widget in ManagerDashboard.tsx)
        ↓
New Lambda: chatbotQuery
        ↓
Calls Claude API (Haiku model) with tool definitions + question
        ↓
Claude selects which tool(s) to call
        ↓
Lambda executes the corresponding GraphQL query against AppSync
        ↓
Claude receives query result and generates a plain English response
        ↓
Response returned to chat widget
```

**Key decisions:**
- Claude API key lives in Lambda env vars — never exposed to the frontend
- No new database models required
- No vector store, embeddings, or RAG — data is already structured in DynamoDB
- Reuses existing AppSync API and Cognito auth entirely
- Model: `claude-haiku-4-5-20251001` — sufficient for structured tool-use tasks at a fraction of the cost of Sonnet

---

## Tool Definitions

Each tool is a description + a pre-written GraphQL query the Lambda executes when Claude calls it.

| Tool | Queries | Example Use |
|---|---|---|
| `get_training_completion` | `Assignment` + `Employee` | "Who hasn't finished the onboarding course?" |
| `get_quiz_performance` | `Result` + `Course` | "What's the average score on the food safety quiz?" |
| `get_employees_needing_support` | `EmployeeSupport` + `Result` | "Which employees are struggling this month?" |
| `get_learning_path_progress` | `LearningPathAssignment` + `Employee` | "Where is my team on the manager training path?" |
| `get_employee_summary` | All of the above for one employee | "Give me a full update on Sarah's training" |
| `get_team_overview` | Aggregate counts across all employees | "How is my team doing overall?" |

---

## What It Can Answer

- Cross-dataset questions that no single dashboard covers
- Aggregate summaries before audits or reviews
- Specific employee deep-dives combining quiz, assignment, and support data
- Date-filtered queries (e.g., "last 30 days", "this month")

**Example questions:**
> "Which employees failed a quiz and haven't had any support logged?"
> "Who completed the most courses this month?"
> "Give me a summary of where my team stands before Friday's audit."
> "Has anyone been stuck on the same course for more than 2 weeks?"

---

## What It Won't Replace

The existing dashboards remain the best tool for at-a-glance monitoring:
- `TrainingStatusDashboard` — completion status overview
- `QuizAnalytics` — pass rate trends and score distributions
- `EmployeesNeedingSupport` — at-risk employee flags
- `TrainingLeaderboard` — team rankings

The chatbot complements these — it's for ad-hoc questions, not replacing structured dashboards.

---

## Model Cost

At `claude-haiku-4-5-20251001` pricing, a typical query exchange is ~2,000–5,000 tokens total.
This is a fraction of a cent per query — negligible at any realistic manager usage volume.

For complex multi-step queries (3+ tool calls with reasoning), Sonnet can be used as a fallback if needed.

---

## Files to Build

| File | Type | Purpose |
|---|---|---|
| `amplify/functions/chatbotQuery/handler.ts` | Lambda | Calls Claude API, executes GraphQL tools, returns response |
| `my-training-admin/src/components/manager/ChatWidget.tsx` | React | Floating chat UI in ManagerDashboard |
| `my-training-admin/src/components/manager/ChatMessage.tsx` | React | Individual message bubble (user / assistant) |

---

## User Stories

---

### Story 1 — Ask a Training Question *(Core Foundation)*
**As a** manager, **I want to** type a question into a chat interface and get an instant, plain-English answer about my team's training, **so that** I don't have to navigate multiple dashboards to find the information I need.

**What's new vs. existing:**
- All your dashboards require the manager to know where to look. This is the first time a manager can just ask a question and get a synthesised answer across any data
- Requires a new Lambda (`chatbotQuery`), a new chat widget component, and wiring up the Claude API with tool use
- Reuses your existing AppSync queries and Cognito auth — no new tables

**Acceptance Criteria:**
- A chat button/panel is accessible from `ManagerDashboard.tsx` without leaving the page
- Manager can type any free-form question and submit with Enter or a send button
- A loading indicator is shown while the Lambda is processing
- Response is returned within 3–5 seconds for single-tool questions
- Response always cites numbers concretely (e.g., "3 out of 12 employees have not completed..." not just "some employees")
- Works for questions that touch `Assignment`, `Result`, `EmployeeSupport`, and `LearningPathAssignment` data
- If the Lambda errors, the widget shows a friendly error message rather than crashing

**Technical notes:**
- New Lambda: `amplify/functions/chatbotQuery/handler.ts`
- New React components: `ChatWidget.tsx` (panel shell), `ChatMessage.tsx` (individual bubbles)
- Claude API called with model `claude-haiku-4-5-20251001`
- System prompt scopes the chatbot to training data only and defines the manager's store context
- The manager's `storeId` / `managerId` is passed from the frontend so every query is automatically scoped to their team

---

### Story 2 — Employee-Specific Deep Dive
**As a** manager, **I want to** ask about a specific employee by name and get a complete training summary, **so that** I can quickly prepare for a 1:1 or performance review without opening multiple screens.

**What's new vs. existing:**
- `EmployeeTrainingHistory.tsx` (60KB) already shows this data but requires the manager to navigate to it and know to look there
- This story makes that same data instantly accessible via a single natural language question
- Requires the `get_employee_summary` tool which calls AppSync for assignments, results, support records, and learning path progress for a single employee

**Acceptance Criteria:**
- Manager can ask "Give me a full update on [name]" or "How is [name] doing?"
- Response includes all of: assigned courses + status, quiz scores per course, pass/fail, support actions logged, learning path progress
- If the name matches multiple employees (e.g., two employees named "Sarah"), the chatbot lists the matches and asks which one
- If no employee with that name exists in the manager's team, the chatbot says so clearly
- Response is structured and readable — uses short sections or bullet points, not a wall of text
- Sensitive fields (banking info, personal details) are never included in the response — query only training-related fields

**Technical notes:**
- `get_employee_summary` tool: resolves name → employeeId, then runs 4 parallel GraphQL queries (assignments, results, support, LPA)
- Name resolution uses a case-insensitive contains filter on the `Employee` table scoped to the manager's `managerId`
- Tool returns a pre-structured summary object so Claude only needs to format it, not reason over raw records

---

### Story 3 — Cross-Dataset Filtering
**As a** manager, **I want to** ask questions that combine multiple conditions across datasets, **so that** I can surface insights that no single dashboard currently provides.

**What's new vs. existing:**
- `EmployeesNeedingSupport.tsx` covers at-risk flags but only shows pre-defined flag types
- This story handles arbitrary combinations the manager defines themselves in natural language
- Requires Claude to call 2–3 tools sequentially, merge the results in memory, and filter the intersection

**Acceptance Criteria:**
- Supports questions combining results from 2+ tools (e.g., quiz results AND support history)
- Supports natural language date ranges: "last 30 days", "this month", "since January", "last week"
- Returns a named list of matching employees with the relevant context for each
- Correctly handles the case where no employees match ("No employees on your team match that criteria")
- For large result sets (10+ employees), summarises rather than listing every detail
- Does not hallucinate employees or data — only returns employees that actually exist in both datasets

**Example questions this must handle:**
- "Who failed a quiz and hasn't had any support logged?"
- "Which employees haven't started any training in the last 2 weeks?"
- "Who completed the most courses this month?"
- "Has anyone been stuck on the same course for more than 2 weeks?"
- "Which employees passed all their quizzes but still haven't finished their learning path?"

**Technical notes:**
- Claude calls `get_quiz_performance` and `get_employees_needing_support` separately, then merges results
- Date filtering is passed as ISO 8601 parameters to the tool; the tool applies the filter in the GraphQL query
- If a question requires 3+ tool calls, Haiku handles this reliably when tool descriptions are clear — no need to fall back to Sonnet for most cases
- Tool responses are pre-aggregated before being returned to Claude (e.g., return employee IDs + summary counts, not raw record arrays) to keep token usage low

---

### Story 4 — Conversation Context (Follow-up Questions)
**As a** manager, **I want to** ask follow-up questions without repeating myself, **so that** the conversation feels natural rather than like filling out a form each time.

**What's new vs. existing:**
- Stories 1–3 treat each question as standalone. This story adds memory within a session
- No new backend or database changes required — conversation history is maintained in React state and passed to the Lambda on each request
- The Lambda forwards the full message history to Claude, which uses prior context to resolve pronouns and references

**Acceptance Criteria:**
- After asking about an employee by name, the manager can ask "What are her quiz scores?" without repeating the name
- After getting a list result, the manager can ask "Tell me more about the first one"
- Conversation history is visible and scrollable in the chat panel
- A "Clear chat" button resets the conversation history
- Context is session-scoped only — it does not persist if the page is refreshed (unless chat history persistence is added later)
- Conversation history sent to the Lambda is capped at the last 10 exchanges to control token costs

**Technical notes:**
- `ChatWidget.tsx` holds `messages: {role, content}[]` in React state
- Each API call to the Lambda includes the full `messages` array
- Lambda forwards the array directly to the Claude API as the `messages` parameter
- Cap at 10 prior exchanges (~2,000 tokens of history) before trimming oldest messages
- No DynamoDB changes needed for session-only context

---

### Story 5 — Graceful Handling of Out-of-Scope Questions *(built with Story 1)*
**As a** manager, **I want to** be told clearly when the chatbot can't answer something, **so that** I know to look elsewhere rather than trust an incorrect or made-up answer.

**What's new vs. existing:**
- This is not a standalone feature — it is built into the system prompt from day one as part of Story 1
- Without this, Haiku may attempt to answer questions it cannot actually query, potentially fabricating data
- The guardrails live entirely in the system prompt and tool design — no additional Lambda logic required

**Acceptance Criteria:**
- If the question is entirely outside training data (e.g., payroll, shift scheduling, HR policies), the chatbot declines clearly and suggests the right place to look
- If the question is ambiguous (e.g., "How is everyone doing?" with no further context), the chatbot asks one clarifying question before querying
- The chatbot never invents employee names, scores, or completion statuses
- If a tool call returns zero results, the chatbot reports that accurately rather than inferring or filling in gaps
- The chatbot does not answer questions about employees outside the manager's own team

**Technical notes:**
- System prompt explicitly states: "You only answer questions about training data. You have access to [list of tools]. If a question cannot be answered with these tools, say so clearly."
- System prompt includes: "Never guess or infer data. Only report what the tool results contain."
- Manager's `managerId` and `storeId` are injected into the system prompt so Claude knows the scope
- Each tool's GraphQL query filters by `managerId` at the query level — Claude cannot request data outside the manager's team even if it tries

---

## Technical Solutions Per Story

---

### Story 1 — Ask a Training Question

**Files to create:**
- `amplify/functions/chatbotQuery/handler.ts` — the Lambda
- `my-training-admin/src/components/manager/ChatWidget.tsx` — floating chat panel
- `my-training-admin/src/components/manager/ChatMessage.tsx` — individual message bubble

**How it works — Lambda (`chatbotQuery`):**

The Lambda receives this payload from the frontend:
```json
{
  "messages": [{ "role": "user", "content": "How is my team doing?" }],
  "managerId": "abc123",
  "storeId": "store456",
  "jwtToken": "eyJ..."
}
```

It then runs this loop:
1. Call Claude API (`claude-haiku-4-5-20251001`) with the messages array + tool definitions + system prompt
2. If Claude returns a `tool_use` block — run the corresponding GraphQL query against AppSync using the JWT token as `Authorization: Bearer <jwtToken>`
3. Feed the tool result back to Claude as a `tool_result` message
4. Repeat until Claude returns a plain `text` response (no more tool calls)
5. Return the final text to the frontend

AppSync is called using the same raw HTTPS pattern already used in `quizCompletion/handler.ts`, but switching the header from `x-api-key` to `Authorization: Bearer <jwtToken>`. This means all existing schema auth rules apply — the Lambda queries as the manager, automatically scoped to what they can see.

**System prompt (injected into every Claude call):**
```
You are a training assistant for managers. You can only answer questions about
employee training data. You have access to tools that query live training records.
The manager's ID is {managerId} and store ID is {storeId}.
Never fabricate data. Only report what the tools return.
If a question is outside training data, say so clearly and suggest where to look.
```

**How it works — Frontend (`ChatWidget.tsx`):**

1. Get the manager's JWT using `fetchAuthSession()` — already used throughout the admin portal
2. Send `fetch(CHATBOT_LAMBDA_URL, { method: 'POST', body: JSON.stringify({ messages, managerId, storeId, jwtToken }) })`
3. Show a loading spinner while waiting
4. Append the response to the `messages` state array
5. The widget is a floating button (bottom-right) that expands into a chat panel — built with existing MUI components (`Fab`, `Paper`, `Box`)

**First tool to implement for this story:**
```
get_team_overview
  → Lists all employees under the manager with their assignment counts
  → GraphQL: listEmployees filtered by managerId, with nested assignments
  → Returns: [{ name, totalAssigned, completed, inProgress }]
```

---

### Story 2 — Employee-Specific Deep Dive

**Files to modify:**
- `amplify/functions/chatbotQuery/handler.ts` — add the `get_employee_summary` tool

**New tool — `get_employee_summary`:**

The tool takes `{ employeeName: string }` as input and runs this sequence:

**Step 1 — Name resolution:**
```graphql
query {
  listEmployees(filter: {
    managerId: { eq: $managerId },
    name: { contains: $employeeName }
  }) {
    items { id name email department }
  }
}
```
- If 0 results → return `{ error: "No employee found with that name" }`
- If 2+ results → return `{ matches: [{ id, name }] }` and Claude asks the manager to clarify
- If 1 result → proceed to Step 2

**Step 2 — Parallel data fetch (all 4 run simultaneously using `Promise.all`):**
```
Query 1: listAssignments filtered by employeeId
         → nested course { title }, status, isTrainingComplete, trainingCompletedAt

Query 2: listResults filtered by assignmentId (for each assignment)
         → score, passed

Query 3: listEmployeeSupports filtered by employeeId
         → flagType, supportAction, providedAt

Query 4: listLearningPathAssignments filtered by employeeId
         → learningPath { title }, status, dueDate, completedDate
```

**Step 3 — Pre-structure the response before returning to Claude:**
```json
{
  "employee": { "name": "Sarah", "department": "Retail" },
  "courses": [
    { "title": "Food Safety", "status": "completed", "score": 88, "passed": true }
  ],
  "support": [{ "type": "failed_quizzes", "action": "...", "date": "..." }],
  "learningPaths": [{ "title": "Onboarding Path", "status": "in_progress", "due": "..." }]
}
```

Claude receives this clean object and formats it as a readable summary. It never sees raw DynamoDB records.

**Sensitive field protection:** The GraphQL queries explicitly select only training-related fields. `transitNumber`, `institutionNumber`, `accountNumber`, `bankingDocumentKey` are never included in any query.

---

### Story 3 — Cross-Dataset Filtering

**Files to modify:**
- `amplify/functions/chatbotQuery/handler.ts` — add 4 new filtering tools

**New tools:**

```
get_training_completion
  Input: { status?: 'assigned'|'completed', courseTitle?: string,
           startDate?: string, endDate?: string }
  Query: listAssignments filtered by managerId scope + optional filters
  Returns: [{ employeeName, courseTitle, status, completedAt }]

get_quiz_performance
  Input: { passed?: boolean, minScore?: integer, courseTitle?: string,
           startDate?: string, endDate?: string }
  Query: listResults joined with assignments to get employeeName + courseTitle
  Returns: [{ employeeName, courseTitle, score, passed }]

get_employees_needing_support
  Input: { flagType?: string, hasSupport?: boolean, startDate?: string }
  Query: listEmployeeSupports (or absence of) filtered by managerId scope
  Returns: [{ employeeName, flagType, lastSupportDate }]

get_learning_path_progress
  Input: { pathTitle?: string, status?: string, overdue?: boolean }
  Query: listLearningPathAssignments filtered by managerId scope
  Returns: [{ employeeName, pathTitle, status, dueDate, completedDate }]
```

**How cross-dataset merging works:**

For a question like *"Who failed a quiz AND hasn't had support logged?"*:
1. Claude calls `get_quiz_performance({ passed: false })`  → gets list of employee IDs who failed
2. Claude calls `get_employees_needing_support({ hasSupport: false })` → gets employees with no support
3. Claude intersects the two lists by employee ID/name in its reasoning
4. Claude returns the merged result as a plain English answer

The tools return employee IDs alongside names so Claude can join them reliably.

**Date handling:** Natural language dates ("last 30 days", "this month") are resolved by Claude into ISO 8601 strings before passing to the tool. The system prompt instructs Claude to convert date expressions before calling tools.

**Large result protection:** Each tool caps results at 50 records and includes a `totalCount` field. If `totalCount > 50`, Claude is instructed to summarise ("15 of your 23 employees...") rather than list every name.

---

### Story 4 — Conversation Context

**Files to modify:**
- `my-training-admin/src/components/manager/ChatWidget.tsx` — add messages state + history trimming

**How it works — Frontend only, no Lambda changes:**

`ChatWidget.tsx` holds the full conversation in state:
```typescript
const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
```

Every time the manager sends a message:
1. Append the new user message to the array
2. Send the **full array** to the Lambda (not just the latest message)
3. The Lambda passes it directly to the Claude API `messages` parameter — Claude natively uses prior context to resolve pronouns and references
4. Append the assistant response to the array

**History cap — to control token costs:**
Before sending to the Lambda, trim the array to the last 10 exchanges (20 messages):
```typescript
const trimmedMessages = messages.slice(-20);
```
This keeps history tokens to ~2,000 regardless of how long the conversation runs.

**"Clear chat" button:** Sets `messages` back to `[]`. Context resets immediately — no backend call needed.

**Session scope only:** Messages live in React component state. Refreshing the page resets the conversation. Persistent history (stored in DynamoDB) is listed as an open question for a later decision.

---

### Story 5 — Graceful Handling of Out-of-Scope Questions

**Files to modify:**
- `amplify/functions/chatbotQuery/handler.ts` — system prompt and tool design only

**No additional code logic required.** This story is implemented entirely through the system prompt and how tools are designed.

**System prompt guardrails (added to Story 1's system prompt):**
```
You can ONLY answer questions using the tools provided.
You have no knowledge of payroll, shift scheduling, HR policies, or any
data outside these tools.

If asked about something outside your tools:
- Say clearly: "I can only answer questions about training data. For [topic],
  please check [suggested location]."

If a question is ambiguous:
- Ask ONE clarifying question before calling any tool. Do not guess.

If a tool returns empty results:
- Report it accurately: "No employees match that criteria."
- Never infer or fill in gaps.

You can only access data for manager ID {managerId}.
Never attempt to query data for other managers or stores.
```

**Tool-level enforcement (defence in depth):**
Every single GraphQL query in every tool has `managerId: { eq: $managerId }` hard-coded as a filter — not passed as an optional parameter. Even if Claude somehow tried to query outside the manager's scope, the query would return nothing.

**What "graceful" looks like in practice:**

| Manager asks | Chatbot responds |
|---|---|
| "What are John's hours this week?" | "I can only answer questions about training data. For scheduling, please check your scheduling system." |
| "How is everyone doing?" | "Could you clarify — are you asking about overall training completion, quiz scores, or learning path progress?" |
| "Show me Sarah's training" (two Sarahs exist) | "I found two employees named Sarah: Sarah Johnson and Sarah Kim. Which one did you mean?" |
| "Who failed the quiz?" (no results) | "No employees on your team have failed a quiz in the current records." |

---

## Delivery Order

```
Sprint 1:  Story 1 + Story 5  →  Core chatbot Lambda + basic chat widget + guardrails
Sprint 2:  Story 2            →  Employee-specific deep dive tool
Sprint 3:  Story 3            →  Multi-condition cross-dataset filtering
Sprint 4:  Story 4            →  Conversation context / follow-up support
```

Stories 1 and 5 are built together — the guardrail logic (Story 5) should be part of the system prompt from day one, not bolted on later.

---

## Open Questions

- [ ] Should chat history persist across sessions (stored in DynamoDB) or reset each time?
- [ ] Should the chatbot be scoped to the manager's own employees only, or all employees in the store?
- [ ] Is a floating widget the right UX, or a dedicated full-page chat view?
- [ ] Do we want a feedback mechanism (thumbs up/down) to monitor answer quality?
