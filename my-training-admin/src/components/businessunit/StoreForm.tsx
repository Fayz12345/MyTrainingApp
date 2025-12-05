import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Loader from '../common/Loader';
const MySwal = withReactContent(Swal);

const client = generateClient<Schema>();

interface StoreFormProps {
  onCancel: () => void;
  onStoreCreated: () => void;
  store?: {
    id: string;
    name: string;
    description?: string | null;
    businessUnitId: string;
  } | null;
}

type BusinessUnit = {
  readonly id: string;
  readonly name: string;
};

const StoreForm: React.FC<StoreFormProps> = ({ onCancel, onStoreCreated, store }) => {
  const isEditMode = !!store;
  const [formData, setFormData] = useState({
    name: store?.name || '',
    description: store?.description || '',
    businessUnitId: store?.businessUnitId || ''
  });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

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

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Store name is required';
        if (value.trim().length < 2) return 'Store name must be at least 2 characters';
        return '';
      case 'businessUnitId':
        if (!value) return 'Business Unit is required';
        return '';
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    
    const businessUnitError = validateField('businessUnitId', formData.businessUnitId);
    if (businessUnitError) {
      errors.businessUnitId = businessUnitError;
      touched.businessUnitId = true;
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
      // Get current user ID
      const session = await fetchAuthSession();
      const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
      
      if (!userId) {
        throw new Error('Unable to identify current user');
      }

      const now = new Date().toISOString();
      
      if (isEditMode && store) {
        // Update existing store
        await client.models.Store.update({
          id: store.id,
          name: formData.name,
          description: formData.description || null,
          businessUnitId: formData.businessUnitId,
          updatedAt: now
        });

        await MySwal.fire({
          title: "Updated!",
          text: `Store "${formData.name}" updated successfully.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        // Create new store
        await client.models.Store.create({
          name: formData.name,
          description: formData.description || null,
          businessUnitId: formData.businessUnitId,
          createdBy: userId,
          createdAt: now,
          updatedAt: now
        });

        await MySwal.fire({
          title: "Created!",
          text: `Store "${formData.name}" created successfully.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
      
      onStoreCreated();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} store:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} store`);
      
      MySwal.fire({
        title: "Error",
        text: err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} store`,
        icon: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader message="Loading business units..." />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>{isEditMode ? 'Edit Store' : 'Create New Store'}</h2>
      
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
            onBlur={handleBlur}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: fieldErrors.businessUnitId ? '2px solid #d32f2f' : '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              outline: 'none'
            }}
          >
            <option value="">Select a Business Unit</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </select>
          {touchedFields.businessUnitId && fieldErrors.businessUnitId && (
            <div style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.businessUnitId}
            </div>
          )}
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
            onBlur={handleBlur}
            placeholder="Store #123, Downtown Location, etc."
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
            {submitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Store' : 'Create Store')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreForm;

