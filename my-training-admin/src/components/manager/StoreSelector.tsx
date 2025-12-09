import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';

const client = generateClient<Schema>();

interface Store {
  id: string;
  name: string;
  description?: string | null;
}

interface StoreSelectorProps {
  onStoreSelect: (storeId: string, storeName: string) => void;
  selectedStoreId?: string | null;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({ onStoreSelect, selectedStoreId }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current user's manager record
        const session = await fetchAuthSession();
        const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

        if (!userId) {
          throw new Error('User not authenticated');
        }

        // Get manager record
        const managersResult = await client.models.Manager.list({
          filter: { userId: { eq: userId } }
        });

        if (managersResult.errors && managersResult.errors.length > 0) {
          throw new Error('Failed to fetch manager: ' + managersResult.errors.map((e: any) => e.message).join(', '));
        }

        const managers = managersResult.data as any[];
        if (!managers || managers.length === 0) {
          throw new Error('Manager record not found');
        }

        const manager = managers[0];

        // Get manager's stores via ManagerStore relationship
        const managerStoresResult = await client.models.ManagerStore.list({
          filter: { managerId: { eq: manager.id } }
        });

        if (managerStoresResult.errors && managerStoresResult.errors.length > 0) {
          throw new Error('Failed to fetch stores: ' + managerStoresResult.errors.map((e: any) => e.message).join(', '));
        }

        const managerStores = managerStoresResult.data as any[];
        const storeIds = managerStores.map(ms => ms.storeId).filter(Boolean);

        if (storeIds.length === 0) {
          // If no stores via ManagerStore, check primary storeId
          if (manager.storeId) {
            storeIds.push(manager.storeId);
          }
        }

        if (storeIds.length === 0) {
          setError('No stores assigned to this manager');
          setLoading(false);
          return;
        }

        // Fetch store details
        const storesData: Store[] = [];
        for (const storeId of storeIds) {
          try {
            const storeResult = await client.models.Store.get({ id: storeId });
            if (storeResult.data) {
              storesData.push({
                id: storeResult.data.id,
                name: storeResult.data.name || 'Unnamed Store',
                description: storeResult.data.description || null
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch store ${storeId}:`, err);
          }
        }

        setStores(storesData);

        // Auto-select if only one store
        if (storesData.length === 1) {
          onStoreSelect(storesData[0].id, storesData[0].name);
        } else if (selectedStoreId && storesData.find(s => s.id === selectedStoreId)) {
          // If a store is already selected and still valid, keep it
          const selectedStore = storesData.find(s => s.id === selectedStoreId);
          if (selectedStore) {
            onStoreSelect(selectedStore.id, selectedStore.name);
          }
        }
      } catch (err) {
        console.error('Error fetching stores:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stores');
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, [onStoreSelect, selectedStoreId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  if (stores.length === 0) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Alert severity="warning">No stores assigned to this manager. Please contact your administrator.</Alert>
      </Paper>
    );
  }

  // If only one store, don't show selector (already auto-selected)
  if (stores.length === 1) {
    return (
      <Box sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'white', borderRadius: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <StoreIcon />
          <Typography variant="h6">Store: {stores[0].name}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Select Store
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        You manage multiple stores. Please select which store you want to work with.
      </Typography>
      <List>
        {stores.map((store, index) => (
          <React.Fragment key={store.id}>
            <ListItem disablePadding>
              <ListItemButton
                selected={selectedStoreId === store.id}
                onClick={() => onStoreSelect(store.id, store.name)}
                sx={{
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                }}
              >
                <StoreIcon sx={{ mr: 2 }} />
                <ListItemText
                  primary={store.name}
                  secondary={store.description || null}
                />
              </ListItemButton>
            </ListItem>
            {index < stores.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default StoreSelector;

