import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = generateClient<Schema>();

interface StoreFormProps {
  onCancel: () => void;
  onStoreCreated: () => void;
}

type BusinessUnit = {
  readonly id: string;
  readonly name: string;
};

const StoreForm: React.FC<StoreFormProps> = ({ onCancel, onStoreCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    businessUnitId: ''
  });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

        // Fetch all business units (BusinessUnit users have read access to all)
        const result = await client.models.BusinessUnit.list({});
        if (result.errors && result.errors.length > 0) {
          console.error('Error fetching business units:', result.errors);
        } else {
          const allBusinessUnits = result.data as BusinessUnit[];
          
          // For BusinessUnit users, try to find their business unit by checking stores they created
          if (userId) {
            const storesResult = await client.models.Store.list({});
            const stores = storesResult.data as any[];
            const userStores = stores.filter((s: any) => s.createdBy === userId);
            
            if (userStores.length > 0) {
              // User has created stores, get the business unit from the first store
              const businessUnitId = userStores[0].businessUnitId;
              const userBusinessUnit = allBusinessUnits.find(bu => bu.id === businessUnitId);
              
              if (userBusinessUnit) {
                // Auto-select the business unit they belong to
                setFormData(prev => ({ ...prev, businessUnitId }));
              }
            }
          }
          
          setBusinessUnits(allBusinessUnits);
        }
      } catch (err) {
        console.error('Error fetching business units:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBusinessUnits();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      setError('Store name is required');
      return;
    }

    if (!formData.businessUnitId) {
      setError('Business Unit is required');
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

      const now = new Date().toISOString();
      await client.models.Store.create({
        name: formData.name,
        description: formData.description || null,
        businessUnitId: formData.businessUnitId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      });

      alert(`✅ Store "${formData.name}" created successfully!`);
      onStoreCreated();
    } catch (err) {
      console.error('Error creating store:', err);
      setError(err instanceof Error ? err.message : 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading business units...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create New Store</h2>
      
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
            Business Unit *
          </label>
          <select
            name="businessUnitId"
            value={formData.businessUnitId}
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
            <option value="">Select a Business Unit</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Store Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Store #123, Downtown Location, etc."
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
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Optional description of the store"
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              fontFamily: 'inherit'
            }}
          />
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
            {submitting ? 'Creating...' : 'Create Store'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreForm;

