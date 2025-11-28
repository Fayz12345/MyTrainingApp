# How to Find the Correct API in AppSync Console

## What You're Currently Viewing

You're looking at API **`rq3xk7mcifgy7jhn2yokysdo7e`** in the AppSync Console.

**This is the WRONG API:**
- ❌ Only has 5 models (Assignment, Course, Employee, QuizQuestion, Result)
- ❌ Missing: BusinessUnit, Store, Manager
- ❌ This is why your queries fail

---

## How to Find the Correct API

### Step 1: Go to AppSync Console

**Link:** https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1

### Step 2: Find the Correct API

You'll see **6 APIs** listed. Look for:

**API ID:** `csxrkv7kenai5i4jycdl73t3uy`  
**Name:** `amplifyData` (same name, but different ID)

### Step 3: Click on the Correct API

Click on API `csxrkv7kenai5i4jycdl73t3uy`

### Step 4: Verify in Settings

Go to **Settings** tab. You should see:

- **API ID:** `csxrkv7kenai5i4jycdl73t3uy`
- **GraphQL endpoint:** `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`
- **Real-time endpoint:** `wss://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-realtime-api.ca-central-1.amazonaws.com/graphql`

### Step 5: Verify Models in Schema Tab

Go to **Schema** tab. You should see all 8 model types:
- Assignment
- BusinessUnit ✅
- Course
- Employee
- Manager ✅
- QuizQuestion
- Result
- Store ✅

---

## Direct Links

**Correct API Settings:**
https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/settings

**Correct API Schema:**
https://ca-central-1.console.aws.amazon.com/appsync/home?region=ca-central-1#/csxrkv7kenai5i4jycdl73t3uy/schema

---

## Quick Comparison

| API ID | Models | Status |
|--------|--------|--------|
| `rq3xk7mcifgy7jhn2yokysdo7e` | 5 | ❌ Wrong (what you're viewing) |
| `csxrkv7kenai5i4jycdl73t3uy` | 8 | ✅ Correct (what you need) |

---

## What I've Already Done

✅ **Updated your `amplify_outputs.json`** to point to the correct API:
- URL: `https://nf2ayvu4ebgm3f2bomzsr5wxmq.appsync-api.ca-central-1.amazonaws.com/graphql`
- API ID: `csxrkv7kenai5i4jycdl73t3uy`

✅ **Copied to admin app**

---

## Next Steps

1. **Refresh your browser** (or restart dev server)
2. **Your app will now use the correct API**
3. **Test BusinessUnit query** - should work now!

---

## Why You Have 6 APIs

Each deployment can create a new API. You have:
- 1 correct API (with all 8 models)
- 5 old APIs (with only 5 models)

The old APIs were created before you added BusinessUnit, Store, and Manager.

---

**Your configuration is now correct. Just refresh your app!**

