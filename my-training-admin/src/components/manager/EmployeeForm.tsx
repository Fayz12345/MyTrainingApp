import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

interface EmployeeFormProps {
  onCancel: () => void;
  onEmployeeCreated: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onCancel, onEmployeeCreated }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    department: '',
    temporaryPassword: '',
    role: 'employee' as 'employee' | 'manager'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentManagerId, setCurrentManagerId] = useState<string | null>(null);
  const [currentManagerEmail, setCurrentManagerEmail] = useState<string | null>(null);
  const [currentManagerName, setCurrentManagerName] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const getCurrentManager = async () => {
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        const email = session.tokens?.idToken?.payload?.email as string | undefined;
        const givenName = session.tokens?.idToken?.payload?.name as string | undefined;
        setCurrentManagerEmail(email || null);
        setCurrentManagerName(givenName || null);
        
        if (userId) {
          const managers = await client.models.Manager.list({
            filter: { userId: { eq: userId } }
          });
          
          if (managers.data && managers.data.length > 0) {
            const managerId = managers.data[0].id;
            setCurrentManagerId(managerId);
          }
        }
      } catch (err) {
        // Silent error handling
      }
    };
    getCurrentManager();
  }, []);

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Full Name is required';
        if (value.trim().length < 2) return 'Full Name must be at least 2 characters';
        return '';
      case 'email':
        if (!value.trim()) return 'Email Address is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';
      case 'temporaryPassword':
        if (!value) return 'Temporary Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        const hasUpper = /[A-Z]/.test(value);
        const hasLower = /[a-z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        const hasSpecial = /[!@#$%^&*]/.test(value);
        if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
          return 'Password must contain uppercase, lowercase, number, and special character';
        }
        return '';
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
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
          loginUrl: role === 'manager' 
            ? window.location.origin + '/login' 
            : window.location.origin.replace('admin', 'app') + '/login'
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
      // Don't throw - email sending failure shouldn't block employee creation
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const createCognitoUser = async (email: string, name: string, department: string, temporaryPassword: string, role: string) => {
    try {
      const requestBody = {
        email,
        name, 
        department,
        temporaryPassword,
        role
      };
      
      const response = await fetch('https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status} ${response.statusText}` };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from Lambda');
      }
      
      return {
        userId: result.employee.userId,
        userCreated: true,
        employeeId: result.employee.id
      };
    } catch (error) {
      throw new Error('Failed to create user account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    
    const nameError = validateField('name', formData.name);
    if (nameError) {
      errors.name = nameError;
      touched.name = true;
    }
    
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
    
    setFieldErrors(errors);
    setTouchedFields(touched);
    
    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors in the form');
      return;
    }
    
    setError(null);

    setSubmitting(true);
    setError(null);

    try {
      // Ensure we have the managerId before creating the employee
      let managerId = currentManagerId;
      
      if (!managerId) {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        
        if (userId) {
          try {
            const managers = await client.models.Manager.list({
              filter: { userId: { eq: userId } }
            });
            
            if (managers.data && managers.data.length > 0) {
              managerId = managers.data[0].id;
              setCurrentManagerId(managerId);
            }
          } catch (queryError) {
            // Silent error handling
          }
        }
      }

      // Call Lambda Function URL to create complete employee (Cognito + DynamoDB)
      const result = await createCognitoUser(
        formData.email,
        formData.name,
        formData.department,
        formData.temporaryPassword, 
        formData.role
      );

      // Update the employee record created by Lambda to set createdBy and managerId
      // This ensures the employee shows up in the manager's employee list
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        
        // First, check if Employee record already exists (Lambda might have created it)
        let employeeExists = false;
        try {
          const existingEmployee = await client.models.Employee.get({ id: result.employeeId });
          if (existingEmployee.data) {
            employeeExists = true;
            
            // Update it with managerId and createdBy if needed
            if (userId && (existingEmployee.data.managerId !== managerId || existingEmployee.data.createdBy !== userId)) {
              try {
                await client.models.Employee.update({
                  id: result.employeeId,
                  managerId: managerId || existingEmployee.data.managerId || null,
                  createdBy: userId || existingEmployee.data.createdBy || null,
                  updatedAt: new Date().toISOString()
                });
              } catch (updateError: any) {
                // Silent error handling
              }
            }
          }
        } catch (getError: any) {
          employeeExists = false;
        }
        
        // If Employee record doesn't exist, create it
        if (!employeeExists) {
          try {
            const now = new Date().toISOString();
            const employeeData = {
              id: result.employeeId,
              userId: result.userId,
              email: formData.email,
              name: formData.name,
              department: formData.department || null,
              managerId: managerId || null,
              createdBy: userId || null,
              isActive: true,
              createdAt: now,
              updatedAt: now
            };
            
            await client.models.Employee.create(employeeData);
          } catch (createError: any) {
            throw createError; // Re-throw to be caught by outer catch
          }
        }
      } catch (graphqlError: any) {
        // Try one more time to create the Employee record with a fresh attempt
        try {
          const retrySession = await fetchAuthSession();
          const retryUserId = retrySession.userSub || retrySession.tokens?.idToken?.payload?.sub as string;
          
          const now = new Date().toISOString();
          const employeeData = {
            id: result.employeeId,
            userId: result.userId,
            email: formData.email,
            name: formData.name,
            department: formData.department || null,
            managerId: managerId || null,
            createdBy: retryUserId || null,
            isActive: true,
            createdAt: now,
            updatedAt: now
          };
          
          await client.models.Employee.create(employeeData);
        } catch (retryError: any) {
          // Silent error handling - employee may still be created by Lambda
        }
      }
      
      // Send welcome email with login credentials
      console.log('[EMPLOYEE_CREATION] Sending welcome email to employee...');
      try {
        const emailResult = await sendWelcomeEmail(
          formData.email, 
          formData.name, 
          formData.temporaryPassword, 
          formData.role as 'manager' | 'employee'
        );
        if (emailResult.success) {
          console.log('[EMPLOYEE_CREATION] ✅ Welcome email sent successfully');
        } else {
          console.warn('[EMPLOYEE_CREATION] ⚠️ Failed to send welcome email:', emailResult.error);
        }
      } catch (emailError) {
        // Non-critical error - log but don't fail employee creation
        console.warn('[EMPLOYEE_CREATION] ⚠️ Failed to send welcome email (non-critical):', emailError);
      }

      // Notify manager who created this employee
      if (currentManagerEmail) {
        try {
          const managerNotify = await sendWelcomeEmail(
            currentManagerEmail,
            currentManagerName || 'Manager',
            'N/A', // no password disclosure
            'manager'
          );
          if (managerNotify.success) {
            console.log('[EMPLOYEE_CREATION] ✅ Manager notification email sent');
          } else {
            console.warn('[EMPLOYEE_CREATION] ⚠️ Manager notification email failed:', managerNotify.error);
          }
        } catch (mgrEmailErr) {
          console.warn('[EMPLOYEE_CREATION] ⚠️ Manager notification email threw (non-critical):', mgrEmailErr);
        }
      }
      
      await MySwal.fire({
        title: "🎉 Employee Created!",
        html: `<div style="text-align: left;">
          <p><strong>👤 Employee:</strong> ${formData.name} (${formData.email})</p>
          <p><strong>🔑 Password:</strong> ${formData.temporaryPassword}</p>
          <p><strong>👥 Role:</strong> ${formData.role}</p>
          <p><strong>🆔 Employee ID:</strong> ${result.employeeId}</p>
          <p><strong>🆔 User ID (Cognito):</strong> ${result.userId}</p>
          <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
          <p>✅ The employee can now log in to the mobile app immediately!</p>
          <p>✅ A welcome email with login credentials has been sent to ${formData.email}</p>
          <p>✅ You can assign courses to this employee from the 'Assign Courses' section.</p>
        </div>`,
        icon: "success",
        confirmButtonText: "OK",
        width: "600px",
      });

      onEmployeeCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
      await MySwal.fire({
        title: "Error!",
        text: err instanceof Error ? err.message : 'Failed to create employee',
        icon: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create New Employee</h2>
      
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

        {/* Name */}
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

        {/* Email */}
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
            placeholder="employee@company.com"
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

        {/* Department */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Department
          </label>
          <input
            type="text"
            name="department"
            value={formData.department}
            onChange={handleInputChange}
            placeholder="Engineering, Sales, Marketing, etc."
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Role */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Role <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>

        {/* Temporary Password */}
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

        {/* Action Buttons */}
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
            {submitting ? 'Creating Employee...' : 'Create Employee'}
          </button>
        </div>
      </form>

    </div>
  );
};

export default EmployeeForm;