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

const UnassignedEmployeeList: React.FC<UnassignedEmployeeListProps> = ({ refreshTrigger }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<Record<string, string>>({});

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
      setManagers((result.data || []) as Manager[]);
    } catch (err) {
      console.error('[UnassignedEmployeeList] Error fetching managers', err);
      // non-blocking
    }
  };

  const handleAssign = async (employee: Employee) => {
    const managerId = selectedManager[employee.id];
    if (!managerId) return;
    try {
      setAssigning(employee.id);
      setError(null);

      const manager = managers.find(m => m.id === managerId);
      const nowIso = new Date().toISOString();

      await client.models.Employee.update({
        id: employee.id,
        managerId,
        createdBy: manager?.userId || employee.createdBy || null,
        updatedAt: nowIso
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
                    <TableCell>Assign Manager</TableCell>
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
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id={`mgr-label-${emp.id}`}>Manager</InputLabel>
                            <Select
                              labelId={`mgr-label-${emp.id}`}
                              label="Manager"
                              value={selectedManager[emp.id] || ''}
                              onChange={(e) =>
                                setSelectedManager((prev) => ({ ...prev, [emp.id]: e.target.value as string }))
                              }
                            >
                              {managers.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                  {m.name || m.email || m.id}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={!selectedManager[emp.id] || assigning === emp.id}
                            onClick={() => handleAssign(emp)}
                          >
                            {assigning === emp.id ? 'Assigning...' : 'Assign'}
                          </Button>
                        </Stack>
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

