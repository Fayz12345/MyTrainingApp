# Debugging Guide: Course Description and Image Not Showing

## Quick Debugging Steps

### 1. Open Browser Console
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
- Go to the **Console** tab
- Clear the console (click the 🚫 icon)

### 2. Check Console Logs
Look for logs with these prefixes:
- `[CourseList]` - Shows what data is fetched from the list
- `[ManagerDashboard]` - Shows what course is passed to edit form
- `[CourseForm]` - Shows what data the form receives

### 3. Use the Debug Panel
When you click "Edit" on a course, you'll see a debug panel at the top of the form that shows:
- ✅/❌ Whether `list()` query includes description/imageKey
- ✅/❌ Whether `get()` query includes description/imageKey
- The actual values of description and imageKey
- Full course data from both queries

### 4. Check These Specific Logs

#### When Loading Course List:
```
[CourseList] Sample course from list(): {...}
[CourseList] Has description?: true/false
[CourseList] Has imageKey?: true/false
[CourseList] Full course data for {courseId}: {...}
```

#### When Clicking Edit:
```
[ManagerDashboard] Course received for editing: {...}
[ManagerDashboard] Full course data fetched: {...}
```

#### When Form Loads:
```
[CourseForm] Course data received: {...}
[CourseForm] Course data details: {...}
[CourseForm] Setting form values: {...}
[CourseForm] Loading existing image: {imageKey}
[CourseForm] Image URL fetched successfully: ...
```

## Common Issues and Solutions

### Issue 1: `list()` doesn't return description/imageKey
**Symptom:** Console shows `Has description?: false` and `Has imageKey?: false`

**Solution:** 
- The backend schema is out of sync
- The code automatically fetches full details using `get()` for each course
- Check if `get()` is working: Look for `[CourseList] Full course data for...` logs

### Issue 2: `get()` also doesn't return description/imageKey
**Symptom:** Even `get()` query shows `Has description?: false`

**Solution:**
- The fields might not exist in the database (they're null)
- OR the backend needs to be redeployed
- Check the debug panel "Step 3: Data Analysis" to see if fields exist but are null

### Issue 3: Description is null/empty in database
**Symptom:** Debug panel shows "Is Null: ⚠️ Yes" or "Is Empty: ⚠️ Yes"

**Solution:**
- The course was created without a description
- Edit the course and add a description, then save

### Issue 4: ImageKey exists but image doesn't load
**Symptom:** Description shows but image preview doesn't appear

**Check:**
- Look for `[CourseForm] Failed to load existing image:` error
- Check if imageKey is a valid S3 path
- Verify S3 permissions (should be fixed after backend redeploy)

### Issue 5: Form shows but fields are empty
**Symptom:** Form loads but description textarea is empty

**Check:**
- Look for `[CourseForm] Setting form values:` log
- Check if `description` value is in the log
- If it shows `description: ''` or `description: null`, the data isn't being fetched

## Step-by-Step Debugging

1. **Open the course list page**
   - Check console for `[CourseList]` logs
   - Verify courses are being fetched

2. **Click "Edit" on a course**
   - Check console for `[ManagerDashboard]` logs
   - Verify course data is being passed

3. **Check the debug panel**
   - Look at Step 1: Does `list()` have description/imageKey?
   - Look at Step 2: Does `get()` have description/imageKey?
   - Look at Step 3: What are the actual values?

4. **Check form initialization**
   - Look for `[CourseForm]` logs
   - Verify `description` and `imageKey` are in the logs
   - Check if image URL is being fetched

5. **Check for errors**
   - Look for red error messages in console
   - Check network tab for failed API calls
   - Check for S3 permission errors

## What to Report

If the issue persists, provide:
1. Screenshot of the debug panel
2. Console logs (copy all `[CourseList]`, `[ManagerDashboard]`, `[CourseForm]` logs)
3. Network tab showing the GraphQL queries (check the request/response)
4. The course ID you're trying to edit

## Removing Debug Panel

Once debugging is complete, remove the debug panel by:
1. Remove the import: `import CourseDebugPanel from './CourseDebugPanel';`
2. Remove the debug panel JSX from CourseForm.tsx
3. Delete the CourseDebugPanel.tsx file

