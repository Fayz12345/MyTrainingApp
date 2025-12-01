import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';

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

  useEffect(() => {
    const getCurrentManager = async () => {
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        
        if (userId) {
          // Find the manager record for this user
          const managers = await client.models.Manager.list({
            filter: { userId: { eq: userId } }
          });
          
          if (managers.data && managers.data.length > 0) {
            setCurrentManagerId(managers.data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching current manager:', err);
      }
    };
    getCurrentManager();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

  const createCognitoUser = async (email: string, name: string, department: string, temporaryPassword: string, role: string) => {
    try {
      console.log('Calling Lambda Function URL to create user:', { email, name, role });
      console.log('Function URL:', 'https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/');
      
      const requestBody = {
        email,
        name, 
        department,
        temporaryPassword,
        role
      };
      console.log('Request body:', requestBody);
      
      const response = await fetch('https://zwkht7afhzzv777hxn6xx56vry0uniix.lambda-url.ca-central-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response received:', response);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status} ${response.statusText}` };
        }
        console.error('Error response:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Lambda response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from Lambda');
      }

      return {
        userId: result.employee.userId,
        userCreated: true,
        employeeId: result.employee.id
      };
    } catch (error) {
      console.error('Detailed error creating user via Lambda:', error);
      console.error('Error type:', typeof error);
      console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to create user account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.name) {
      setError('Email and name are required');
      return;
    }

    if (!formData.temporaryPassword) {
      setError('Temporary password is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Ensure we have the managerId before creating the employee
      let managerId = currentManagerId;
      if (!managerId) {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        if (userId) {
          // Find the manager record for this user
          const managers = await client.models.Manager.list({
            filter: { userId: { eq: userId } }
          });
          if (managers.data && managers.data.length > 0) {
            managerId = managers.data[0].id;
            setCurrentManagerId(managerId);
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

      console.log('Employee creation result:', result);

      // Update the employee record created by Lambda to set createdBy and managerId
      // This ensures the employee shows up in the manager's employee list
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
        
        console.log('Setting createdBy field:', { userId, managerId, employeeId: result.employeeId });
        
        if (!userId) {
          console.warn('Could not get userId to set createdBy field');
        } else {
          // Try to update the existing record first (created by Lambda)
          try {
            await client.models.Employee.update({
              id: result.employeeId,
              managerId: managerId || null,
              createdBy: userId,
              updatedAt: new Date().toISOString()
            });
            console.log('✅ Employee record updated with createdBy and managerId:', { employeeId: result.employeeId, createdBy: userId, managerId });
          } catch (updateError: any) {
            // If update fails (record might not exist yet), try to create it
            if (updateError.errors?.[0]?.errorType === 'Unauthorized' || updateError.message?.includes('not found')) {
              console.log('Record not found, creating new employee record via GraphQL');
              const now = new Date().toISOString();
              await client.models.Employee.create({
                id: result.employeeId,
                userId: result.userId,
                email: formData.email,
                name: formData.name,
                department: formData.department || null,
                managerId: managerId || null,
                createdBy: userId,
                isActive: true,
                createdAt: now,
                updatedAt: now
              });
              console.log('Employee record created via GraphQL');
            } else {
              throw updateError;
            }
          }
        }
      } catch (graphqlError) {
        console.error('Error updating/creating employee record:', graphqlError);
        // Don't fail the whole operation - Lambda already created the employee
        // But log it so we can debug
      }

      // Show success message
      alert(`🎉 Employee created successfully!\n\n👤 Employee: ${formData.name} (${formData.email})\n🔑 Password: ${formData.temporaryPassword}\n👥 Role: ${formData.role}\n🆔 Employee ID: ${result.employeeId}\n\n✅ The employee can now log in to the mobile app immediately!\n✅ You can assign courses to this employee from the 'Assign Courses' section.`);

      onEmployeeCreated();
    } catch (err) {
      console.error('Error creating employee:', err);
      setError(err instanceof Error ? err.message : 'Failed to create employee');
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

        {/* Email */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Email Address *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="employee@company.com"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Name */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Full Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="John Doe"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
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
            Role *
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
            Temporary Password *
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              name="temporaryPassword"
              value={formData.temporaryPassword}
              onChange={handleInputChange}
              placeholder="Enter temporary password"
              required
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, temporaryPassword: generateRandomPassword() }))}
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
          <small style={{ color: '#666', fontSize: '0.8rem' }}>
            Password must contain uppercase, lowercase, number, and special character (min 8 chars)
          </small>
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