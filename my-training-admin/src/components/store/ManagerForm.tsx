import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = generateClient<Schema>();

interface ManagerFormProps {
  onCancel: () => void;
  onManagerCreated: () => void;
}

type Store = {
  readonly id: string;
  readonly name: string;
};

const ManagerForm: React.FC<ManagerFormProps> = ({ onCancel, onManagerCreated }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    storeId: '',
    temporaryPassword: ''
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
                setFormData(prev => ({ ...prev, storeId }));
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

  const createCognitoUser = async (email: string, name: string, temporaryPassword: string, role: string) => {
    try {
      console.log('Calling Lambda Function URL to create manager:', { email, name, role });
      
      const requestBody = {
        email,
        name, 
        department: '',
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
        managerId: result.employee.id
      };
    } catch (error) {
      console.error('Detailed error creating user via Lambda:', error);
      throw new Error('Failed to create user account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.name) {
      setError('Email and name are required');
      return;
    }

    if (!formData.storeId) {
      setError('Store is required');
      return;
    }

    if (!formData.temporaryPassword) {
      setError('Temporary password is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get current user ID
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
      
      if (!userId) {
        throw new Error('Unable to identify current user');
      }

      // Create Cognito user with Manager role
      const result = await createCognitoUser(
        formData.email,
        formData.name,
        formData.temporaryPassword,
        'manager'
      );

      // Create Manager record in database
      const now = new Date().toISOString();
      await client.models.Manager.create({
        id: result.managerId,
        userId: result.userId,
        email: formData.email,
        name: formData.name,
        storeId: formData.storeId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      });

      alert(`🎉 Manager created successfully!\n\n👤 Manager: ${formData.name} (${formData.email})\n🔑 Password: ${formData.temporaryPassword}\n🆔 Manager ID: ${result.managerId}\n\n✅ The manager can now log in to the admin portal!`);
      onManagerCreated();
    } catch (err) {
      console.error('Error creating manager:', err);
      setError(err instanceof Error ? err.message : 'Failed to create manager');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading stores...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create New Manager</h2>
      
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
            Store *
          </label>
          <select
            name="storeId"
            value={formData.storeId}
            onChange={handleInputChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">Select a Store</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Email Address *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="manager@company.com"
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
            {submitting ? 'Creating Manager...' : 'Create Manager'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManagerForm;

