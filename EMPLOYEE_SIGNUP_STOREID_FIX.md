# Employee Self-Signup StoreId Fix

## Issue
When we added the `storeId` field to the Employee model, we needed to ensure that new employees who self-signup don't encounter any issues. The `storeId` field is optional, but we should explicitly handle it in the signup flow.

## Solution

### 1. Schema Check ✅
The `storeId` field in the Employee model is **optional** (no `.required()`):
```typescript
storeId: a.id(), // Store this employee belongs to (for multi-store managers)
```

This means employees can be created without a `storeId`.

### 2. Lambda Function Update ✅
Updated `assignEmployeeGroup` Lambda function to explicitly set `storeId: null` when creating Employee records for self-signup users.

**File**: `amplify/functions/assignEmployeeGroup/handler.js`

**Change**: Added `storeId: null` to the `createEmployeeMutation` input:
```javascript
input: {
    userId: userIdFromEvent,
    email: emailFromEvent,
    name: nameFromEvent,
    department: null,
    managerId: null,
    storeId: null, // Self-signup employees don't have a store initially
    createdBy: null,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso
}
```

## Flow

### Self-Signup Employee Flow:
1. Employee signs up via mobile app/web
2. `assignEmployeeGroup` Lambda is triggered (post-confirmation)
3. Employee record is created with:
   - `storeId: null` ✅
   - `managerId: null` ✅
   - `createdBy: null` ✅
4. Employee is assigned to "Employees" Cognito group
5. Later, Manager or SuperAdmin can:
   - Assign employee to a manager → `storeId` is set
   - Assign employee to a store → `storeId` is set

### Manager-Created Employee Flow:
1. Manager creates employee via admin dashboard
2. `storeId` is set based on manager's selected store ✅
3. Employee record is created with `storeId` ✅

### SuperAdmin-Assigned Employee Flow:
1. SuperAdmin assigns unassigned employee to manager
2. SuperAdmin selects store from manager's stores
3. Employee record is updated with both `managerId` and `storeId` ✅

## No Breaking Changes

✅ **Existing employees**: Continue to work (storeId is optional)  
✅ **Self-signup employees**: Can sign up without issues (storeId: null)  
✅ **Manager-created employees**: Get storeId automatically  
✅ **SuperAdmin-assigned employees**: Get storeId when assigned  

## Testing Checklist

- [ ] Employee self-signup works (storeId: null)
- [ ] Manager creates employee (storeId is set)
- [ ] SuperAdmin assigns employee to manager with store (storeId is set)
- [ ] Employees without storeId can still log in and use the app
- [ ] Employees can be filtered by storeId when viewing in manager dashboard

## Notes

- `storeId` is optional, so employees can exist without it
- Self-signup employees will have `storeId: null` until assigned by manager/SuperAdmin
- This is intentional - employees need to be assigned to a store by an admin
- The mobile app should handle employees with `storeId: null` gracefully

