/**
 * Utility function to check which Cognito groups the current user belongs to
 */

import { fetchAuthSession } from 'aws-amplify/auth';

export interface UserGroupInfo {
  groups: string[];
  userId: string | undefined;
  email: string | undefined;
  isSuperAdmin: boolean;
  isBusinessUnit: boolean;
  isStore: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

/**
 * Get the current user's Cognito groups
 * @param forceRefresh - Force refresh the token to get latest groups
 * @returns User group information
 */
export async function getUserGroups(forceRefresh: boolean = false): Promise<UserGroupInfo> {
  try {
    const session = await fetchAuthSession({ forceRefresh });
    const token = session.tokens?.idToken?.payload;
    
    if (!token) {
      throw new Error('No token found. User may not be authenticated.');
    }

    // Extract groups from token
    let groups: string[] = [];
    const groupsClaim = token['cognito:groups'];
    
    if (typeof groupsClaim === 'string') {
      groups = [groupsClaim];
    } else if (Array.isArray(groupsClaim)) {
      // Type assertion: ensure all items are strings
      groups = groupsClaim.filter((g): g is string => typeof g === 'string');
    }

    const userId = token['sub'] as string | undefined;
    const email = token['email'] as string | undefined;

    return {
      groups,
      userId,
      email,
      isSuperAdmin: groups.includes('SuperAdmin'),
      isBusinessUnit: groups.includes('BusinessUnit'),
      isStore: groups.includes('Store'),
      isManager: groups.includes('Managers'),
      isEmployee: groups.includes('Employees')
    };
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  }
}

/**
 * Check if user has a specific group
 */
export async function hasGroup(groupName: string, forceRefresh: boolean = false): Promise<boolean> {
  try {
    const info = await getUserGroups(forceRefresh);
    return info.groups.includes(groupName);
  } catch (error) {
    console.error('Error checking group:', error);
    return false;
  }
}

/**
 * Get the highest priority role (based on precedence)
 */
export async function getHighestRole(forceRefresh: boolean = false): Promise<string | null> {
  try {
    const info = await getUserGroups(forceRefresh);
    
    // Check in order of precedence (highest to lowest)
    if (info.isSuperAdmin) return 'SuperAdmin';
    if (info.isBusinessUnit) return 'BusinessUnit';
    if (info.isStore) return 'Store';
    if (info.isManager) return 'Manager';
    if (info.isEmployee) return 'Employee';
    
    return null;
  } catch (error) {
    console.error('Error getting highest role:', error);
    return null;
  }
}

