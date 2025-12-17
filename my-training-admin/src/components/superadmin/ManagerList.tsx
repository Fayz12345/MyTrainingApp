import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { Box, Typography, Button, Alert, AlertTitle, IconButton,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,Paper,Chip,} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ManagerForm from '../store/ManagerForm';
import Loader from '../common/Loader';
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
const client = generateClient<Schema>();
const MySwal = withReactContent(Swal);

type Manager = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly phoneNumber?: string | null;
  readonly storeId: string;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type Store = {
  readonly id: string;
  readonly name: string;
};

interface ManagerListProps {
  refreshTrigger?: number;
}

const ManagerList: React.FC<ManagerListProps> = ({ refreshTrigger }) => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [managerStores, setManagerStores] = useState<Record<string, string[]>>({}); // managerId -> storeIds[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('SuperAdmin ManagerList - Starting to fetch managers...');

      const [managersResult, storesResult, managerStoresResult] = await Promise.all([
        client.models.Manager.list({}),
        client.models.Store.list({}),
        client.models.ManagerStore.list({})
      ]);

      console.log('SuperAdmin ManagerList - Managers result:', {
        hasData: !!managersResult.data,
        dataLength: managersResult.data?.length,
        hasErrors: !!managersResult.errors,
        errors: managersResult.errors
      });

      if (managersResult.errors && managersResult.errors.length > 0) {
        console.error('SuperAdmin ManagerList - Errors fetching managers:', managersResult.errors);
        throw new Error('Failed to fetch managers: ' + managersResult.errors.map((e: any) => e.message).join(', '));
      }

      if (storesResult.errors && storesResult.errors.length > 0) {
        console.warn('Warning fetching stores:', storesResult.errors);
      }

      const managersData = (managersResult.data as Manager[]) || [];
      console.log('SuperAdmin ManagerList - Total managers fetched:', managersData.length);
      if (managersData.length > 0) {
        console.log('SuperAdmin ManagerList - Sample manager:', managersData[0]);
      } else {
        console.log('SuperAdmin ManagerList - No managers found. Checking if data is null/undefined:', {
          dataIsNull: managersResult.data === null,
          dataIsUndefined: managersResult.data === undefined,
          dataType: typeof managersResult.data,
          rawData: managersResult.data
        });
      }
      setManagers(managersData);
      
      const storeMap: Record<string, Store> = {};
      if (storesResult.data) {
        (storesResult.data as Store[]).forEach(store => {
          storeMap[store.id] = store;
        });
      }
      setStores(storeMap);

      // Build manager -> stores mapping from ManagerStore relationships
      const managerStoreMap: Record<string, string[]> = {};
      if (managerStoresResult.data) {
        (managerStoresResult.data as any[]).forEach(ms => {
          if (ms.managerId && ms.storeId) {
            if (!managerStoreMap[ms.managerId]) {
              managerStoreMap[ms.managerId] = [];
            }
            if (!managerStoreMap[ms.managerId].includes(ms.storeId)) {
              managerStoreMap[ms.managerId].push(ms.storeId);
            }
          }
        });
      }

      // Also include primary storeId for managers that have one
      managersData.forEach(manager => {
        if (manager.storeId) {
          if (!managerStoreMap[manager.id]) {
            managerStoreMap[manager.id] = [];
          }
          if (!managerStoreMap[manager.id].includes(manager.storeId)) {
            managerStoreMap[manager.id].push(manager.storeId);
          }
        }
      });

      setManagerStores(managerStoreMap);
    } catch (err) {
      console.error('SuperAdmin ManagerList - Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteManager = async (id: string, name: string) => {
    const result = await MySwal.fire({
      title: "Are you sure?",
      text: `Do you want to delete manager "${name}"? This will also remove all their employee assignments.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete!",
    });

    if (!result.isConfirmed) return;

    try {
      await client.models.Manager.delete({ id });

      MySwal.fire({
        title: "Deleted!",
        text: "Manager deleted successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      fetchData();
    } catch (err) {
      console.error("Delete error:", err);

      MySwal.fire({
        title: "Error!",
        text: "Failed to delete manager",
        icon: "error",
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (showCreateForm || editingManager) {
    return (
      <ManagerForm 
        manager={editingManager}
        onCancel={() => {
          setShowCreateForm(false);
          setEditingManager(null);
        }}
        onManagerCreated={() => {
          setShowCreateForm(false);
          setEditingManager(null);
          setTimeout(() => {
            fetchData();
          }, 500);
        }}
      />
    );
  }

  if (loading) {
    return <Loader message="Loading managers..." />;
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={fetchData}>
            Retry
          </Button>
        }
      >
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  if (managers.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No managers found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create your first manager to get started.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateForm(true)}
        >
          Create New Manager
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Managers ({managers.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
          >
            Create Manager
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} elevation={2}>
        <Table sx={{ minWidth: 650 }} aria-label="managers table">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Phone Number</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Store</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {managers.map((manager) => {
              const managerStoreIds = managerStores[manager.id] || [];
              const managerStoresList = managerStoreIds
                .map(storeId => stores[storeId])
                .filter((store): store is Store => store !== undefined);
              
              return (
                <TableRow
                  key={manager.id}
                  sx={{
                    '&:nth-of-type(odd)': {
                      backgroundColor: 'action.hover',
                    },
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium" color="primary">
                      {manager.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {manager.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {manager.phoneNumber || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {managerStoresList.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {managerStoresList.map((store) => (
                      <Chip 
                            key={store.id}
                        label={store.name} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        No store assigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(manager.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => setEditingManager(manager)}
                        aria-label="edit manager"
                        sx={{
                          '&:hover': {
                            backgroundColor: 'primary.light',
                            color: 'white',
                          },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => deleteManager(manager.id, manager.name)}
                        aria-label="delete manager"
                        sx={{
                          '&:hover': {
                            backgroundColor: 'error.light',
                            color: 'white',
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManagerList;
