# Multi-Store Manager Implementation

## Overview
Implemented store selection functionality for managers who manage multiple stores. When a manager logs in, they can select which store they want to work with. Employees are filtered by the selected store, while courses remain global (shared across all stores).

## Requirements Met

✅ **Courses**: Same across all stores (global, no filtering)  
✅ **Employees**: Different per store (filtered by selected store)  
✅ **Store Selection**: Manager can select store when logging in  
✅ **Employee Creation**: New employees are assigned to the selected store  

## Changes Made

### 1. Data Schema Update
**File**: `amplify/data/resource.ts`

Added `storeId` field to Employee model:
```typescript
Employee: a.model({
  // ... existing fields
  storeId: a.id(), // Store this employee belongs to (for multi-store managers)
  store: a.belongsTo('Store', 'storeId'),
  // ... rest of fields
})
```

### 2. Store Selector Component
**File**: `my-training-admin/src/components/manager/StoreSelector.tsx` (NEW)

- Fetches manager's stores via `ManagerStore` relationship
- Shows store selection UI if manager has multiple stores
- Auto-selects if manager has only one store
- Displays selected store name when only one store

### 3. Manager Dashboard Updates
**File**: `my-training-admin/src/components/manager/ManagerDashboard.tsx`

- Added `selectedStoreId` and `selectedStoreName` state
- Integrated `StoreSelector` component
- Passes `selectedStoreId` to `EmployeeList`
- Shows store name in employee management section

### 4. Employee List Updates
**File**: `my-training-admin/src/components/manager/EmployeeList.tsx`

- Added `selectedStoreId` prop
- Filters employees by `storeId` when store is selected
- Passes `selectedStoreId` to `EmployeeForm`

### 5. Employee Form Updates
**File**: `my-training-admin/src/components/manager/EmployeeForm.tsx`

- Added `selectedStoreId` prop
- Sets `storeId` when creating new employees
- Updates `storeId` when updating existing employees

## How It Works

### Flow for Multi-Store Manager

1. **Manager Logs In**
   - `StoreSelector` component loads
   - Fetches manager's stores from `ManagerStore` table
   - If multiple stores: Shows selection UI
   - If single store: Auto-selects and shows store name

2. **Store Selection**
   - Manager clicks on a store
   - `selectedStoreId` is set in `ManagerDashboard`
   - All employee-related views filter by this store

3. **Viewing Employees**
   - `EmployeeList` filters employees where `employee.storeId === selectedStoreId`
   - Only employees from selected store are shown
   - Courses remain unfiltered (global)

4. **Creating Employees**
   - When manager creates new employee
   - `EmployeeForm` sets `storeId: selectedStoreId`
   - Employee is assigned to the selected store

### Flow for Single-Store Manager

1. **Manager Logs In**
   - `StoreSelector` finds only one store
   - Auto-selects that store
   - Shows store name in header
   - No selection UI needed

## Deployment Steps

### Step 1: Deploy Schema Changes
```bash
cd /var/www/html/MyTrainingApp
npx ampx sandbox
```

This will:
- Add `storeId` field to Employee model
- Add `store` relationship to Employee model
- Update GraphQL schema

### Step 2: Update Existing Employees (Optional)
If you have existing employees without `storeId`, you may want to:
1. Query all employees
2. Determine their store based on their manager's stores
3. Update employees with appropriate `storeId`

### Step 3: Test the Flow
1. Login as a manager with multiple stores
2. Verify store selector appears
3. Select a store
4. Verify employees are filtered by store
5. Create a new employee
6. Verify employee is assigned to selected store
7. Switch stores
8. Verify different employees are shown

## Data Model

### Employee Model (Updated)
```
Employee {
  id: ID
  userId: String (Cognito sub)
  email: String
  name: String
  department: String?
  managerId: ID? (Manager who created)
  storeId: ID? (Store this employee belongs to) ← NEW
  createdBy: String? (userId of creator)
  isActive: Boolean
  assignments: [Assignment]
  createdAt: DateTime
  updatedAt: DateTime
}
```

### ManagerStore Model (Existing)
```
ManagerStore {
  id: ID
  managerId: ID (Manager)
  storeId: ID (Store)
  createdAt: DateTime
  updatedAt: DateTime
}
```

## UI Flow

### Manager Dashboard with Store Selection

```
┌─────────────────────────────────────┐
│  Manager Portal          [Sign Out] │
├─────────────────────────────────────┤
│  Select Store                       │
│  ┌───────────────────────────────┐ │
│  │ 🏪 Store A                    │ │ ← Selected
│  ├───────────────────────────────┤ │
│  │ 🏪 Store B                    │ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│  Employee Management                │
│  Store: Store A                     │
│  ┌───────────────────────────────┐ │
│  │ Employee 1 (Store A)          │ │
│  │ Employee 2 (Store A)          │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Single Store Manager

```
┌─────────────────────────────────────┐
│  Manager Portal          [Sign Out] │
├─────────────────────────────────────┤
│  🏪 Store: Store A                  │ ← Auto-selected
├─────────────────────────────────────┤
│  Employee Management                │
│  ┌───────────────────────────────┐ │
│  │ Employee 1                    │ │
│  │ Employee 2                    │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Notes

- **Courses remain global**: No store filtering applied to courses
- **Backward compatibility**: `storeId` is optional, so existing employees without `storeId` will still work
- **Store assignment**: When creating employees, they are automatically assigned to the selected store
- **Store switching**: Manager can switch stores at any time, and employee list will update

## Testing Checklist

- [ ] Manager with multiple stores sees store selector
- [ ] Manager with single store sees store name (no selector)
- [ ] Selecting a store filters employees correctly
- [ ] Creating employee assigns to selected store
- [ ] Courses are not filtered by store (show all courses)
- [ ] Switching stores shows different employees
- [ ] Store selection persists during session

