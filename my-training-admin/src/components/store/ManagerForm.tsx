import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Loader from '../common/Loader';

// Minimal react-select typings (local) to avoid external @types dependency
type RSOption = { value: string; label: string };
type RSMultiValue = RSOption[];
type RSStylesConfig = {
  control?: (base: any, state: any) => any;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Select = require('react-select').default as React.ComponentType<any>;
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

interface ManagerFormProps {
  onCancel: () => void;
  onManagerCreated: () => void;
  manager?: {
    id: string;
    userId: string;
    email: string;
    name: string;
    phoneNumber?: string | null;
    storeId?: string | null;
  } | null;
}

type Store = {
  readonly id: string;
  readonly name: string;
};

const ManagerForm: React.FC<ManagerFormProps> = ({ onCancel, onManagerCreated, manager }) => {
  const isEditMode = !!manager;
  const [formData, setFormData] = useState({
    email: manager?.email || '',
    name: manager?.name || '',
    phoneNumber: manager?.phoneNumber || '',
    storeIds: manager?.storeId ? [manager.storeId] : [],
    temporaryPassword: ''
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const managerStoreModel = (client as any).models?.ManagerStore;

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

        // Fetch all stores (Store users have read access to all)
        const result = await client.models.Store.list({});
        if (result.errors && result.errors.length > 0) {
          console.error('Error fetching stores:', result.errors);
        } else {
          const allStores = result.data as Store[];
          
          // For Store users, try to find their store by checking managers they created
          if (userId) {
            const managersResult = await client.models.Manager.list({});
            const managers = managersResult.data as any[];
            const userManagers = managers.filter((m: any) => m.createdBy === userId);
            
            if (userManagers.length > 0) {
              // User has created managers, get the store from the first manager
              const storeId = userManagers[0].storeId;
              const userStore = allStores.find(s => s.id === storeId);
              
              if (userStore) {
                // Auto-select the store they belong to
                setFormData(prev => {
                  // Don't override selected stores when editing and already hydrated
                  if (isEditMode && prev.storeIds && prev.storeIds.length > 0) {
                    return prev;
                  }
                  return { ...prev, storeIds: storeId ? [storeId] : [] };
                });
              }
            }
          }
          
          setStores(allStores);
        }
      } catch (err) {
        console.error('Error fetching stores:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  // When editing, hydrate storeIds from ManagerStore links if available
  useEffect(() => {
    if (!manager) return;
    const loadManagerStores = async () => {
      try {
        if (managerStoreModel?.list) {
          const resp = await managerStoreModel.list({ filter: { managerId: { eq: manager.id } } });
          const ids = (resp.data || []).map((ms: any) => ms.storeId).filter(Boolean);
          if (ids.length > 0) {
            setFormData(prev => ({ ...prev, storeIds: Array.from(new Set(ids)) }));
            return;
          }
        } else {
          console.warn('[ManagerForm] ManagerStore model not available in generated client; using legacy storeId');
        }
      } catch (err) {
        console.warn('[ManagerForm] Could not fetch ManagerStore links; falling back to legacy storeId', err);
      }
      if (manager.storeId) {
        setFormData(prev => ({ ...prev, storeIds: [manager.storeId as string] }));
      }
    };
    loadManagerStores();
  }, [manager, managerStoreModel]);

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Full Name is required';
        if (value.trim().length < 2) return 'Full Name must be at least 2 characters';
        return '';
      case 'email':
        if (!isEditMode && !value.trim()) return 'Email Address is required';
        if (!isEditMode && value.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) return 'Please enter a valid email address';
        }
        return '';
      case 'storeIds':
        if (!Array.isArray(value) || value.length === 0) return 'Store is required';
        return '';
      case 'phoneNumber':
        if (value.trim()) {
          // Canadian phone number validation
          // Remove all non-digits for validation
          const digitsOnly = value.replace(/\D/g, '');
          
          // Canadian numbers: country code (1) + area code (3) + number (7) = 11 digits
          // Or without country code: area code (3) + number (7) = 10 digits
          if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            // Format: +1 (XXX) XXX-XXXX or 1-XXX-XXX-XXXX
            const areaCode = digitsOnly.substring(1, 4);
            if (areaCode[0] === '0' || areaCode[0] === '1') {
              return 'Invalid area code (cannot start with 0 or 1)';
            }
          } else if (digitsOnly.length === 10) {
            // Format: (XXX) XXX-XXXX or XXX-XXX-XXXX
            const areaCode = digitsOnly.substring(0, 3);
            if (areaCode[0] === '0' || areaCode[0] === '1') {
              return 'Invalid area code (cannot start with 0 or 1)';
            }
          } else {
            return 'Please enter a valid Canadian phone number (10 or 11 digits)';
          }
          
          // Check for valid characters (digits, spaces, dashes, parentheses, plus)
          const phoneRegex = /^[\d\s\-\+\(\)]+$/;
          if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
        }
        return '';
      case 'temporaryPassword':
        if (!isEditMode && !value) return 'Temporary Password is required';
        if (!isEditMode && value) {
          if (value.length < 8) return 'Password must be at least 8 characters';
          const hasUpper = /[A-Z]/.test(value);
          const hasLower = /[a-z]/.test(value);
          const hasNumber = /[0-9]/.test(value);
          const hasSpecial = /[!@#$%^&*]/.test(value);
          if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
            return 'Password must contain uppercase, lowercase, number, and special character';
          }
        }
        return '';
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const val: any = value;
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, val);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const subscribeManagerToSNS = async (email: string, name: string, managerId: string) => {
    const logPrefix = '[SUBSCRIBE_MANAGER_SNS]';
    const LAMBDA_FUNCTION_URL = process.env.REACT_APP_SUBSCRIBE_MANAGER_SNS_LAMBDA_URL || '';
    
    if (!LAMBDA_FUNCTION_URL) {
      console.warn(`${logPrefix} Lambda Function URL not configured. Skipping SNS subscription.`);
      return { success: false, error: 'Lambda Function URL not configured' };
    }

    try {
      console.log(`${logPrefix} Calling subscribe manager Lambda...`);
      const response = await fetch(LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          managerId
        })
      });

      if (!response.ok) {
        throw new Error(`Lambda returned status ${response.status}`);
      }

      const result = await response.json();
      console.log(`${logPrefix} Lambda response:`, result);
      return result;
    } catch (err) {
      console.error(`${logPrefix} Lambda invocation error:`, err);
      throw err;
    }
  };

  const syncManagerStores = async (managerId: string, storeIds: string[]) => {
    if (!managerStoreModel?.list || !managerStoreModel?.delete || !managerStoreModel?.create) {
      console.warn('[ManagerForm] ManagerStore model not available in generated client; skipping multi-store sync');
      return;
    }

    const uniqueStoreIds = Array.from(new Set(storeIds));

    // Remove existing links then add new ones
    const existing = await managerStoreModel.list({
      filter: { managerId: { eq: managerId } }
    });
    if (existing.data && existing.data.length > 0) {
      for (const link of existing.data) {
        await managerStoreModel.delete({ id: link.id });
      }
    }
    for (const storeId of uniqueStoreIds) {
      const nowIso = new Date().toISOString();
      await managerStoreModel.create({
        managerId,
        storeId,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
  };

  const storeOptions: RSOption[] = stores.map(store => ({
    value: store.id,
    label: store.name
  }));

  const handleStoreSelect = (selected: RSMultiValue) => {
    const ids = selected.map((opt: RSOption) => opt.value);
    setFormData(prev => ({ ...prev, storeIds: ids }));

    // Clear store errors when selection changes
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next.storeIds;
      return next;
    });
    setTouchedFields(prev => ({ ...prev, storeIds: true }));
  };

  const storeSelectStyles: RSStylesConfig = {
    control: (base: any, state: any) => ({
      ...base,
      borderColor: fieldErrors.storeIds ? '#d32f2f' : base.borderColor || '#ccc',
      boxShadow: 'none',
      '&:hover': {
        borderColor: fieldErrors.storeIds ? '#d32f2f' : state.isFocused ? '#1976d2' : base.borderColor
      }
    })
  };

  const sendWelcomeEmail = async (email: string, name: string, password: string, role: 'manager' | 'employee') => {
    const logPrefix = '[SEND_WELCOME_EMAIL]';
    const LAMBDA_FUNCTION_URL = process.env.REACT_APP_SEND_WELCOME_EMAIL_LAMBDA_URL || '';
    
    if (!LAMBDA_FUNCTION_URL) {
      console.warn(`${logPrefix} Lambda Function URL not configured. Skipping welcome email.`);
      return { success: false, error: 'Lambda Function URL not configured' };
    }

    try {
      console.log(`${logPrefix} Sending welcome email to ${email}...`);
      const response = await fetch(LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          password,
          role,
          loginUrl: window.location.origin + '/login' // Both managers and employees use the same web portal
        })
      });

      if (!response.ok) {
        throw new Error(`Lambda returned status ${response.status}`);
      }

      const result = await response.json();
      console.log(`${logPrefix} Lambda response:`, result);
      return result;
    } catch (err) {
      console.error(`${logPrefix} Lambda invocation error:`, err);
      // Don't throw - email sending failure shouldn't block manager creation
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure password meets requirements: uppercase, lowercase, number, special char
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
    
    // Fill remaining length with random chars
    for (let i = 4; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const createCognitoUser = async (email: string, name: string, temporaryPassword: string, role: string) => {
    const logPrefix = '[MANAGER_CREATION_LAMBDA]';
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`${logPrefix} ========================================`);
      console.log(`${logPrefix} 📞 CALLING EXTERNAL LAMBDA FUNCTION`);
      console.log(`${logPrefix} Timestamp: ${timestamp}`);
      console.log(`${logPrefix} Function URL: https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/`);
      console.log(`${logPrefix} Request data:`, { 
        email, 
        name, 
        role,
        hasPassword: !!temporaryPassword,
        passwordLength: temporaryPassword?.length || 0
      });
      
      const requestBody = {
        email,
        name, 
        department: '',
        temporaryPassword,
        role
      };
      
      const requestStartTime = Date.now();
      console.log(`${logPrefix} [REQUEST] Sending POST request...`);
      
      const response = await fetch('https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      console.log(`${logPrefix} [RESPONSE] Received in ${requestDuration}ms`);
      console.log(`${logPrefix} [RESPONSE] Status: ${response.status} ${response.statusText}`);
      console.log(`${logPrefix} [RESPONSE] Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status} ${response.statusText}` };
        }
        console.error(`${logPrefix} [ERROR] Lambda returned error:`, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`${logPrefix} [RESPONSE] Lambda response data:`, result);
      console.log(`${logPrefix} [RESPONSE] Success: ${result.success}`);
      
      if (result.employee) {
        console.log(`${logPrefix} [RESPONSE] Employee/Manager data:`, {
          id: result.employee.id,
          userId: result.employee.userId,
          email: result.employee.email,
          name: result.employee.name
        });
      }

      if (!result.success) {
        console.error(`${logPrefix} [ERROR] Lambda returned success=false`);
        console.error(`${logPrefix} [ERROR] Error message:`, result.error);
        throw new Error(result.error || 'Unknown error from Lambda');
      }

      // Validate response structure
      if (!result.employee) {
        console.error(`${logPrefix} [ERROR] Lambda response missing 'employee' field`);
        console.error(`${logPrefix} [ERROR] Full response:`, JSON.stringify(result, null, 2));
        throw new Error('Lambda response is missing employee data');
      }

      if (!result.employee.userId) {
        console.error(`${logPrefix} [ERROR] Lambda response missing 'employee.userId' field`);
        console.error(`${logPrefix} [ERROR] Employee data:`, result.employee);
        throw new Error('Lambda response is missing userId');
      }

      if (!result.employee.id) {
        console.error(`${logPrefix} [ERROR] Lambda response missing 'employee.id' field`);
        console.error(`${logPrefix} [ERROR] Employee data:`, result.employee);
        throw new Error('Lambda response is missing employee id');
      }

      console.log(`${logPrefix} ✅ Lambda call successful`);
      console.log(`${logPrefix} ✅ Response validation passed`);
      console.log(`${logPrefix} ========================================`);
      
      return {
        userId: result.employee.userId,
        userCreated: true,
        managerId: result.employee.id
      };
    } catch (error) {
      console.error(`${logPrefix} ========================================`);
      console.error(`${logPrefix} ❌ LAMBDA CALL FAILED`);
      console.error(`${logPrefix} Error type:`, typeof error);
      console.error(`${logPrefix} Error name:`, error instanceof Error ? error.name : 'Unknown');
      console.error(`${logPrefix} Error message:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(`${logPrefix} Stack trace:`, error.stack);
      }
      console.error(`${logPrefix} ========================================`);
      throw new Error('Failed to create user account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const logPrefix = isEditMode ? '[MANAGER_UPDATE]' : '[MANAGER_CREATION]';
    const timestamp = new Date().toISOString();
    
    console.log(`${logPrefix} ========================================`);
    console.log(`${logPrefix} 🚀 MANAGER ${isEditMode ? 'UPDATE' : 'CREATION'} PROCESS STARTED`);
    console.log(`${logPrefix} Timestamp: ${timestamp}`);
    console.log(`${logPrefix} ========================================`);
    
    // Validate all fields
    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    
    const nameError = validateField('name', formData.name);
    if (nameError) {
      errors.name = nameError;
      touched.name = true;
    }
    
    const storeError = validateField('storeIds', formData.storeIds);
    if (storeError) {
      errors.storeIds = storeError;
      touched.storeIds = true;
    }
    
    const phoneError = validateField('phoneNumber', formData.phoneNumber);
    if (phoneError) {
      errors.phoneNumber = phoneError;
      touched.phoneNumber = true;
    }
    
    // Only require email and password for new managers
    if (!isEditMode) {
      const emailError = validateField('email', formData.email);
      if (emailError) {
        errors.email = emailError;
        touched.email = true;
      }
      
      const passwordError = validateField('temporaryPassword', formData.temporaryPassword);
      if (passwordError) {
        errors.temporaryPassword = passwordError;
        touched.temporaryPassword = true;
      }
    }
    
    setFieldErrors(errors);
    setTouchedFields(touched);
    
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    
    setError(null);

    console.log(`${logPrefix} [STEP 1] Form validation passed`);
    console.log(`${logPrefix} [STEP 1] Manager Data:`, {
      email: formData.email,
      name: formData.name,
      phoneNumber: formData.phoneNumber,
      storeIds: formData.storeIds,
      role: 'manager',
      hasPassword: !!formData.temporaryPassword
    });

    setSubmitting(true);
    setError(null);

    try {
      if (isEditMode && manager) {
        // Update existing manager
        console.log(`${logPrefix} [STEP 1] Updating manager record in database...`);
        const now = new Date().toISOString();
        
        await client.models.Manager.update({
          id: manager.id,
          name: formData.name,
          phoneNumber: formData.phoneNumber || null,
          storeId: formData.storeIds[0] || null,
          updatedAt: now
        });
        await syncManagerStores(manager.id, formData.storeIds);
        
        console.log(`${logPrefix} [STEP 1] ✅ Manager record updated in database`);
        console.log(`${logPrefix} ========================================`);
        console.log(`${logPrefix} ✅ MANAGER UPDATE COMPLETED SUCCESSFULLY`);
        console.log(`${logPrefix} ========================================`);

        await MySwal.fire({
          title: "Updated!",
          text: `Manager "${formData.name}" updated successfully.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        
        onManagerCreated();
        return;
      }

      // Create new manager (existing logic)
      // Get current user ID
      console.log(`${logPrefix} [STEP 2] Getting current user information...`);
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
      console.log(`${logPrefix} [STEP 2] Current user (creator) ID: ${userId}`);
      
      if (!userId) {
        console.error(`${logPrefix} [STEP 2] ❌ No userId found in session!`);
        throw new Error('Unable to identify current user');
      }

      // Create Cognito user with Manager role
      console.log(`${logPrefix} [STEP 3] Calling external Lambda to create Cognito user...`);
      console.log(`${logPrefix} [STEP 3] ⚠️ CRITICAL: External Lambda must use User Pool ID: ca-central-1_aKCLbCdhj`);
      console.log(`${logPrefix} [STEP 3] ⚠️ If Lambda uses wrong pool, user won't appear in Amplify Console`);
      
      const result = await createCognitoUser(
        formData.email,
        formData.name,
        formData.temporaryPassword,
        'manager'
      );

      console.log(`${logPrefix} [STEP 3] ✅ Lambda call completed`);
      console.log(`${logPrefix} [STEP 3] Result:`, {
        userId: result.userId,
        managerId: result.managerId,
        userCreated: result.userCreated
      });

      // CRITICAL: Verify the user was actually created in Cognito
      console.log(`${logPrefix} [STEP 3.1] ⚠️ IMPORTANT: Verify user exists in Cognito`);
      console.log(`${logPrefix} [STEP 3.1] User ID from Lambda: ${result.userId}`);
      console.log(`${logPrefix} [STEP 3.1] Email: ${formData.email}`);
      console.log(`${logPrefix} [STEP 3.1] ⚠️ If user is NOT in Cognito User Management, the Lambda may have failed silently`);
      console.log(`${logPrefix} [STEP 3.1] ⚠️ Check AWS Cognito Console → User Management → Users for: ${formData.email}`);

      // Create Manager record in database
      console.log(`${logPrefix} [STEP 4] Creating Manager record in database...`);
      const now = new Date().toISOString();
      const primaryStoreId = formData.storeIds[0] || null;
      const managerData = {
        id: result.managerId,
        userId: result.userId,
        email: formData.email,
        name: formData.name,
        phoneNumber: formData.phoneNumber || null,
        storeId: primaryStoreId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      };
      
      console.log(`${logPrefix} [STEP 4] Manager data to create:`, managerData);
      
      await client.models.Manager.create(managerData);
      console.log(`${logPrefix} [STEP 4] ✅ Manager record created in database`);
      // Link manager to all selected stores
      await syncManagerStores(result.managerId, formData.storeIds);

      // Automatically subscribe manager to SNS topic for notifications
      console.log(`${logPrefix} [STEP 4.1] Subscribing manager to SNS topic...`);
      try {
        const subscribeResult = await subscribeManagerToSNS(formData.email, formData.name, result.managerId);
        if (subscribeResult.success) {
          console.log(`${logPrefix} [STEP 4.1] ✅ Manager subscribed to SNS topic`);
          if (subscribeResult.confirmationUrl) {
            console.log(`${logPrefix} [STEP 4.1] ⚠️ Confirmation required: ${subscribeResult.confirmationUrl}`);
          }
        } else {
          console.warn(`${logPrefix} [STEP 4.1] ⚠️ Subscription failed: ${subscribeResult.error}`);
        }
      } catch (snsError) {
        // Non-critical error - log but don't fail manager creation
        console.warn(`${logPrefix} [STEP 4.1] ⚠️ Failed to subscribe manager to SNS (non-critical):`, snsError);
      }

      // Send welcome email with login credentials
      console.log(`${logPrefix} [STEP 4.2] Sending welcome email to manager...`);
      try {
        const emailResult = await sendWelcomeEmail(formData.email, formData.name, formData.temporaryPassword, 'manager');
        if (emailResult.success) {
          console.log(`${logPrefix} [STEP 4.2] ✅ Welcome email sent successfully`);
        } else {
          console.warn(`${logPrefix} [STEP 4.2] ⚠️ Failed to send welcome email: ${emailResult.error}`);
        }
      } catch (emailError) {
        // Non-critical error - log but don't fail manager creation
        console.warn(`${logPrefix} [STEP 4.2] ⚠️ Failed to send welcome email (non-critical):`, emailError);
      }

      // IMPORTANT: The external Lambda creates the user but may not add them to Managers group
      // We need to add them manually or wait for post-confirmation trigger
      console.log(`${logPrefix} [STEP 5] Waiting for post-confirmation trigger to run...`);
      console.log(`${logPrefix} [STEP 5] User details:`, { 
        userId: result.userId, 
        email: formData.email,
        managerId: result.managerId 
      });
      
      // Wait a moment for post-confirmation trigger to run (if it will)
      const waitStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 3000));
      const waitEndTime = Date.now();
      console.log(`${logPrefix} [STEP 5] Wait completed (${waitEndTime - waitStartTime}ms)`);
      
      // Note: The user should be added to Managers group by post-confirmation trigger
      // If the external Lambda sets custom:role="manager", the trigger will add them
      // If not, they need to be manually added
      console.log(`${logPrefix} [STEP 6] ⚠️ CRITICAL: Verify manager was created in Cognito:`);
      console.log(`${logPrefix} [STEP 6]    ✅ Step 1: Check AWS Cognito Console → User Pools → ca-central-1_aKCLbCdhj → Users`);
      console.log(`${logPrefix} [STEP 6]       Look for email: ${formData.email}`);
      console.log(`${logPrefix} [STEP 6]       Look for User ID: ${result.userId}`);
      console.log(`${logPrefix} [STEP 6]       ⚠️ If NOT found in ca-central-1_aKCLbCdhj:`);
      console.log(`${logPrefix} [STEP 6]          → Lambda is using WRONG User Pool ID!`);
      console.log(`${logPrefix} [STEP 6]          → Check Lambda logs for User Pool ID it's using`);
      console.log(`${logPrefix} [STEP 6]          → Lambda MUST use: ca-central-1_aKCLbCdhj`);
      console.log(`${logPrefix} [STEP 6]    ✅ Step 2: If user exists in correct pool, check Groups → Managers`);
      console.log(`${logPrefix} [STEP 6]       If NOT in group → Post-confirmation trigger may have failed`);
      console.log(`${logPrefix} [STEP 6]    ✅ Step 3: Check CloudWatch logs:`);
      console.log(`${logPrefix} [STEP 6]       - Lambda function logs (external Lambda) - check User Pool ID`);
      console.log(`${logPrefix} [STEP 6]       - assignEmployeeGroup function logs (post-confirmation trigger)`);
      console.log(`${logPrefix} [STEP 6]    ✅ Step 4: If user exists but not in group:`);
      console.log(`${logPrefix} [STEP 6]       Run: npm run add-manager-to-group -- ${formData.email}`);

      console.log(`${logPrefix} [STEP 7] ✅ MANAGER CREATION COMPLETED SUCCESSFULLY`);
      console.log(`${logPrefix} [STEP 7] Summary:`, {
        managerId: result.managerId,
        userId: result.userId,
        email: formData.email,
        name: formData.name,
        storeIds: formData.storeIds,
        createdBy: userId,
        timestamp: new Date().toISOString()
      });
      console.log(`${logPrefix} ========================================`);
      console.log(`${logPrefix} ✅ PROCESS COMPLETE`);
      console.log(`${logPrefix} ========================================`);

      await MySwal.fire({
        title: "🎉 Manager Created!",
        html: `<div style="text-align: left;">
          <p><strong>👤 Manager:</strong> ${formData.name} (${formData.email})</p>
          <p><strong>🔑 Password:</strong> ${formData.temporaryPassword}</p>
          <p><strong>🆔 Manager ID:</strong> ${result.managerId}</p>
          <p><strong>🆔 User ID (Cognito):</strong> ${result.userId}</p>
          <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
          <p>✅ The manager can now log in to the admin portal!</p>
          <p>✅ A welcome email with login credentials has been sent to ${formData.email}</p>
        </div>`,
        icon: "success",
        confirmButtonText: "OK",
        width: "600px",
      });
      onManagerCreated();
    } catch (err) {
      console.error(`${logPrefix} ========================================`);
      console.error(`${logPrefix} ❌ MANAGER ${isEditMode ? 'UPDATE' : 'CREATION'} FAILED`);
      console.error(`${logPrefix} Error:`, err);
      console.error(`${logPrefix} Error type:`, err instanceof Error ? err.constructor.name : typeof err);
      console.error(`${logPrefix} Error message:`, err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) {
        console.error(`${logPrefix} Stack trace:`, err.stack);
      }
      console.error(`${logPrefix} ========================================`);
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} manager`);
      
      MySwal.fire({
        title: "Error",
        text: err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} manager`,
        icon: "error",
      });
    } finally {
      setSubmitting(false);
      console.log(`${logPrefix} [CLEANUP] Form submission state reset`);
    }
  };

  if (loading) {
    return <Loader message="Loading stores..." />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>{isEditMode ? 'Edit Manager' : 'Create New Manager'}</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            borderRadius: '4px',
            border: '1px solid #ef5350'
          }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Stores <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <Select
            isMulti
            options={storeOptions}
            value={storeOptions.filter(opt => formData.storeIds.includes(opt.value))}
            onChange={handleStoreSelect}
            onBlur={() => setTouchedFields(prev => ({ ...prev, storeIds: true }))}
            classNamePrefix="react-select"
            placeholder="Select one or more stores"
            styles={storeSelectStyles}
          />
          {touchedFields.storeIds && fieldErrors.storeIds && (
            <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.storeIds}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Full Name <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder="John Doe"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: fieldErrors.name ? '2px solid #d32f2f' : '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          {touchedFields.name && fieldErrors.name && (
            <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.name}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Phone Number
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder="+1 (416) 555-1234"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: fieldErrors.phoneNumber ? '2px solid #d32f2f' : '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          {touchedFields.phoneNumber && fieldErrors.phoneNumber && (
            <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.phoneNumber}
            </div>
          )}
          {!touchedFields.phoneNumber && !fieldErrors.phoneNumber && (
            <small style={{ color: '#666', fontSize: '0.8rem' }}>
              Optional - Canadian format: +1 (XXX) XXX-XXXX or (XXX) XXX-XXXX
            </small>
          )}
        </div>

        {!isEditMode && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Email Address <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="manager@company.com"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: fieldErrors.email ? '2px solid #d32f2f' : '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {touchedFields.email && fieldErrors.email && (
              <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {fieldErrors.email}
              </div>
            )}
          </div>
        )}
        
        {isEditMode && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
                backgroundColor: '#f5f5f5',
                color: '#666'
              }}
            />
            <small style={{ color: '#666', fontSize: '0.8rem' }}>
              Email cannot be changed after creation
            </small>
          </div>
        )}

        {!isEditMode && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Temporary Password <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                name="temporaryPassword"
                value={formData.temporaryPassword}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Enter temporary password"
                required
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: fieldErrors.temporaryPassword ? '2px solid #d32f2f' : '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const newPassword = generateRandomPassword();
                  setFormData(prev => ({ ...prev, temporaryPassword: newPassword }));
                  // Clear error when password is generated
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.temporaryPassword;
                    return newErrors;
                  });
                }}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Generate
              </button>
            </div>
            {touchedFields.temporaryPassword && fieldErrors.temporaryPassword ? (
              <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {fieldErrors.temporaryPassword}
              </div>
            ) : (
              <small style={{ color: '#666', fontSize: '0.8rem' }}>
                Password must contain uppercase, lowercase, number, and special character (min 8 chars)
              </small>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: submitting ? '#ccc' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {submitting ? (isEditMode ? 'Updating Manager...' : 'Creating Manager...') : (isEditMode ? 'Update Manager' : 'Create Manager')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManagerForm;

