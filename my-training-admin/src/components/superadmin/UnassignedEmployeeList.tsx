import React, { useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Stack,
  Box,
} from '@mui/material';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import Loader from '../common/Loader';

const client = generateClient<Schema>();

type Employee = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly department?: string | null;
  readonly managerId?: string | null;
  readonly createdBy?: string | null;
  readonly createdAt: string;
};

type Manager = {
  readonly id: string;
  readonly userId?: string | null;
  readonly email?: string | null;
  readonly name?: string | null;
};

interface UnassignedEmployeeListProps {
  refreshTrigger?: number;
}

type Store = {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
};

const UnassignedEmployeeList: React.FC<UnassignedEmployeeListProps> = ({ refreshTrigger }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [managerStores, setManagerStores] = useState<Record<string, Store[]>>({}); // managerId -> stores[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<Record<string, string>>({});
  const [selectedStore, setSelectedStore] = useState<Record<string, string>>({}); // employeeId -> storeId

  const fetchUnassignedEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await client.models.Employee.list({});
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e: { message: string }) => e.message).join(', '));
      }

      const allEmployees = (result.data || []) as Employee[];
      const unassigned = allEmployees.filter(emp => !emp.managerId);
      setEmployees(unassigned);
    } catch (err) {
      console.error('[UnassignedEmployeeList] Error fetching employees', err);
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const result = await client.models.Manager.list({});
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e: { message: string }) => e.message).join(', '));
      }
      const managersData = (result.data || []) as Manager[];
      setManagers(managersData);
      
      // Fetch stores for all managers
      const storesMap: Record<string, Store[]> = {};
      for (const manager of managersData) {
        const managerStores = await fetchStoresForManager(manager.id);
        storesMap[manager.id] = managerStores;
      }
      setManagerStores(storesMap);
    } catch (err) {
      console.error('[UnassignedEmployeeList] Error fetching managers', err);
      // non-blocking
    }
  };

  const fetchStoresForManager = async (managerId: string): Promise<Store[]> => {
    try {
      // Get manager's primary storeId
      const managerResult = await client.models.Manager.get({ id: managerId });
      const manager = managerResult.data as any;
      
      const storeIds: string[] = [];
      
      // Check primary storeId
      if (manager?.storeId) {
        storeIds.push(manager.storeId);
      }
      
      // Get stores from ManagerStore relationship
      const managerStoresResult = await client.models.ManagerStore.list({
        filter: { managerId: { eq: managerId } }
      });
      
      if (managerStoresResult.data) {
        const managerStores = managerStoresResult.data as any[];
        managerStores.forEach(ms => {
          if (ms.storeId && !storeIds.includes(ms.storeId)) {
            storeIds.push(ms.storeId);
          }
        });
      }
      
      // Fetch store details
      const storesData: Store[] = [];
      for (const storeId of storeIds) {
        try {
          const storeResult = await client.models.Store.get({ id: storeId });
          if (storeResult.data && storeResult.data.id) {
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
      
      return storesData;
    } catch (err) {
      console.error(`[UnassignedEmployeeList] Error fetching stores for manager ${managerId}:`, err);
      return [];
    }
  };

  const handleManagerSelect = async (employeeId: string, managerId: string) => {
    setSelectedManager((prev) => ({ ...prev, [employeeId]: managerId }));
    
    // Clear store selection when manager changes
    setSelectedStore((prev) => {
      const newState = { ...prev };
      delete newState[employeeId];
      return newState;
    });
    
    // Fetch stores for selected manager if not already cached
    if (!managerStores[managerId]) {
      const stores = await fetchStoresForManager(managerId);
      setManagerStores((prev) => ({ ...prev, [managerId]: stores }));
      
      // Auto-select store if manager has only one store
      if (stores.length === 1) {
        setSelectedStore((prev) => ({ ...prev, [employeeId]: stores[0].id }));
      }
    } else if (managerStores[managerId].length === 1) {
      // Auto-select if already cached and only one store
      setSelectedStore((prev) => ({ ...prev, [employeeId]: managerStores[managerId][0].id }));
    }
  };

  const handleAssign = async (employee: Employee) => {
    const managerId = selectedManager[employee.id];
    const storeId = selectedStore[employee.id];
    
    if (!managerId) {
      setError('Please select a manager');
      return;
    }
    
    // Check if manager has stores and store selection is required
    const managerStoresList = managerStores[managerId] || [];
    if (managerStoresList.length > 0 && !storeId) {
      setError('Please select a store for this employee');
      return;
    }
    
    try {
      setAssigning(employee.id);
      setError(null);

      const manager = managers.find(m => m.id === managerId);
      const nowIso = new Date().toISOString();

      console.log('[UnassignedEmployeeList] Assigning employee to manager:', {
        employeeId: employee.id,
        managerId,
        storeId,
        hasStoreId: !!storeId
      });

      await client.models.Employee.update({
        id: employee.id,
        managerId,
        storeId: storeId || null, // Set storeId when assigning to manager
        createdBy: manager?.userId || employee.createdBy || null,
        updatedAt: nowIso
      });

      // Clear selections after successful assignment
      setSelectedManager((prev) => {
        const newState = { ...prev };
        delete newState[employee.id];
        return newState;
      });
      setSelectedStore((prev) => {
        const newState = { ...prev };
        delete newState[employee.id];
        return newState;
      });

      await fetchUnassignedEmployees();
    } catch (err) {
      console.error('[UnassignedEmployeeList] Error assigning manager', err);
      setError(err instanceof Error ? err.message : 'Failed to assign manager');
    } finally {
      setAssigning(null);
    }
  };

  useEffect(() => {
    fetchUnassignedEmployees();
    fetchManagers();
  }, [refreshTrigger]);

  if (loading) {
    return <Loader message="Loading unassigned employees..." fullHeight />;
  }

  return (
    <Card>
      <CardHeader
        title="Unassigned Employees"
        subheader="Employees without a manager"
        action={
          <Typography variant="body2" color="text.secondary">
            Total: {employees.length}
          </Typography>
        }
      />
      <CardContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {employees.length === 0 ? (
            <Alert severity="info">All employees are assigned to managers.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Manager</TableCell>
                    <TableCell>Store</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} hover>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.department || '—'}</TableCell>
                      <TableCell>{emp.createdBy || '—'}</TableCell>
                      <TableCell>{new Date(emp.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                          <InputLabel id={`mgr-label-${emp.id}`}>Select Manager</InputLabel>
                          <Select
                            labelId={`mgr-label-${emp.id}`}
                            label="Select Manager"
                            value={selectedManager[emp.id] || ''}
                            onChange={(e) => handleManagerSelect(emp.id, e.target.value as string)}
                          >
                            {managers.map((m) => (
                              <MenuItem key={m.id} value={m.id}>
                                {m.name || m.email || m.id}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        {selectedManager[emp.id] && managerStores[selectedManager[emp.id]] ? (
                          managerStores[selectedManager[emp.id]].length > 0 ? (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel id={`store-label-${emp.id}`}>Select Store</InputLabel>
                              <Select
                                labelId={`store-label-${emp.id}`}
                                label="Select Store"
                                value={selectedStore[emp.id] || ''}
                                onChange={(e) =>
                                  setSelectedStore((prev) => ({ ...prev, [emp.id]: e.target.value as string }))
                                }
                                required
                              >
                                {managerStores[selectedManager[emp.id]].map((store) => (
                                  <MenuItem key={store.id} value={store.id}>
                                    {store.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No stores assigned
                            </Typography>
                          )
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Select manager first
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={
                            !selectedManager[emp.id] ||
                            (managerStores[selectedManager[emp.id]]?.length > 0 && !selectedStore[emp.id]) ||
                            assigning === emp.id
                          }
                          onClick={() => handleAssign(emp)}
                        >
                          {assigning === emp.id ? 'Assigning...' : 'Assign'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box display="flex" justifyContent="flex-end">
            <Typography variant="caption" color="text.secondary">
              Updates automatically when you navigate back here.
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default UnassignedEmployeeList;

