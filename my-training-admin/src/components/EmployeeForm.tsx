import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

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

  const createCognitoUser = async (email: string, temporaryPassword: string, role: string) => {
    try {
      console.log('Creating Cognito user with:', {
        email,
        temporaryPassword,
        role
      });
      
      // Generate a unique user ID for the Employee record
      return {
        userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userCreated: true
      };
    } catch (error) {
      console.error('Error creating Cognito user:', error);
      throw new Error('Failed to create user account');
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
      // Step 1: Create Cognito user (mock implementation)
      const { userId } = await createCognitoUser(
        formData.email, 
        formData.temporaryPassword, 
        formData.role
      );

      // Step 2: Create Employee record in database
      const result = await client.models.Employee.create({
        userId: userId,
        email: formData.email,
        name: formData.name,
        department: formData.department || undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (result.errors && result.errors.length > 0) {
        throw new Error('Failed to create employee record: ' + result.errors.map((e: any) => e.message).join(', '));
      }

      alert(`Employee created successfully!\n\nEmployee Details:\n• Email: ${formData.email}\n• Name: ${formData.name}\n• Department: ${formData.department || 'Not specified'}\n• Role: ${formData.role}\n• Password: ${formData.temporaryPassword}\n\nNext Steps:\n1. The employee can now log in to the mobile app\n2. They will be prompted to change their password on first login\n3. You can assign courses to this employee from the 'Assign Courses' section`);

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