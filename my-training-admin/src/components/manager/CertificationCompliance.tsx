import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import EventBusyIcon from '@mui/icons-material/EventBusy';

const client = generateClient<Schema>();

interface LearningPath {
  id: string;
  title: string;
  isCertification?: boolean | null;
  certificationExpirationDays?: number | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  storeId?: string | null;
}

interface CertificationAssignment {
  id: string;
  learningPathId: string;
  employeeId: string;
  status: string;
  completedDate?: string | null;
  expirationDate?: string | null;
  certificationStatus?: string | null;
  employee?: Employee | null;
  learningPath?: LearningPath | null;
}

function daysUntil(dateStr: string): number {
  const exp = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface CertificationComplianceProps {
  selectedStoreId?: string | null;
}

const CertificationCompliance: React.FC<CertificationComplianceProps> = ({ selectedStoreId }) => {
  const [assignments, setAssignments] = useState<CertificationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0); // 0: expiring soon, 1: expired, 2: valid

  useEffect(() => {
    fetchData();
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Employees for store filter
      const employeesResult = await client.models.Employee.list({
        filter: { isActive: { eq: true } },
      });
      let employees = (employeesResult.data || []) as Employee[];
      if (selectedStoreId) {
        employees = employees.filter((e: any) => e.storeId === selectedStoreId);
      }
      const storeEmployeeIds = new Set(employees.map((e) => e.id));

      // All learning path assignments with expiration (completed or expired certifications)
      let all: any[] = [];
      let nextToken: string | undefined;
      do {
        const result: any = await client.models.LearningPathAssignment.list({
          nextToken,
        });
        if (result.data) all = all.concat(result.data);
        nextToken = result.nextToken;
      } while (nextToken);

      // Only certification-related: has expirationDate (completed certs) or status expired
      const withExpiration = all.filter(
        (a: any) =>
          (a.expirationDate || a.status === 'expired') &&
          (!selectedStoreId || storeEmployeeIds.has(a.employeeId))
      );

      // Enrich with employee and learningPath (list may not include nested by default)
      const pathIds = Array.from(new Set(withExpiration.map((a: any) => a.learningPathId)));
      const empIds = Array.from(new Set(withExpiration.map((a: any) => a.employeeId)));
      const pathMap = new Map<string, LearningPath>();
      const empMap = new Map<string, Employee>();

      for (const id of pathIds) {
        try {
          const r = await client.models.LearningPath.get({ id });
          if (r.data) pathMap.set(id, r.data as LearningPath);
        } catch (_) {}
      }
      for (const id of empIds) {
        try {
          const r = await client.models.Employee.get({ id });
          if (r.data) empMap.set(id, r.data as Employee);
        } catch (_) {}
      }

      const items: CertificationAssignment[] = withExpiration.map((a: any) => ({
        id: a.id,
        learningPathId: a.learningPathId,
        employeeId: a.employeeId,
        status: a.status || '',
        completedDate: a.completedDate ?? null,
        expirationDate: a.expirationDate ?? null,
        certificationStatus: a.certificationStatus ?? null,
        employee: empMap.get(a.employeeId) ?? null,
        learningPath: pathMap.get(a.learningPathId) ?? null,
      }));

      setAssignments(items);
    } catch (err) {
      console.error('CertificationCompliance fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load certification data');
    } finally {
      setLoading(false);
    }
  };

  const expired = assignments.filter((a) => a.status === 'expired' || (a.expirationDate && daysUntil(a.expirationDate) <= 0));
  const expiringSoon = assignments.filter(
    (a) =>
      a.status === 'completed' &&
      a.expirationDate &&
      daysUntil(a.expirationDate) > 0 &&
      daysUntil(a.expirationDate) <= 30
  );
  const valid = assignments.filter(
    (a) =>
      a.status === 'completed' &&
      a.expirationDate &&
      daysUntil(a.expirationDate) > 30
  );

  const getStatusChip = (a: CertificationAssignment) => {
    if (!a.expirationDate) return <Chip size="small" label="—" variant="outlined" />;
    const days = daysUntil(a.expirationDate);
    if (days <= 0)
      return (
        <Chip
          size="small"
          icon={<ErrorIcon />}
          label="Expired"
          color="error"
          variant="filled"
        />
      );
    if (days <= 7)
      return (
        <Chip
          size="small"
          icon={<WarningAmberIcon />}
          label={`Expires in ${days} days`}
          color="error"
          variant="outlined"
        />
      );
    if (days <= 30)
      return (
        <Chip
          size="small"
          icon={<WarningAmberIcon />}
          label={`Expires in ${days} days`}
          color="warning"
          variant="outlined"
        />
      );
    return (
      <Chip
        size="small"
        icon={<CheckCircleIcon />}
        label="Valid"
        color="success"
        variant="outlined"
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const tables = [
    { label: 'Expiring soon (≤30 days)', data: expiringSoon },
    { label: 'Expired', data: expired },
    { label: 'Valid', data: valid },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Certification Compliance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        View certifications that are expiring soon, already expired, or currently valid. The system sends reminders at 30, 14, and 7 days and auto re-assigns when expired.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Expiring soon (${expiringSoon.length})`} />
        <Tab label={`Expired (${expired.length})`} />
        <Tab label={`Valid (${valid.length})`} />
      </Tabs>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Certification</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tables[tab].data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  {tab === 0 && (
                    <>
                      <EventBusyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography color="text.secondary">No certifications expiring in the next 30 days.</Typography>
                    </>
                  )}
                  {tab === 1 && (
                    <>
                      <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                      <Typography color="text.secondary">No expired certifications.</Typography>
                    </>
                  )}
                  {tab === 2 && (
                    <Typography color="text.secondary">No valid certifications in this view.</Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              tables[tab].data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {a.employee?.name ?? '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.employee?.email ?? a.employeeId}
                    </Typography>
                  </TableCell>
                  <TableCell>{a.learningPath?.title ?? a.learningPathId}</TableCell>
                  <TableCell>{a.completedDate ? formatDate(a.completedDate) : '—'}</TableCell>
                  <TableCell>{a.expirationDate ? formatDate(a.expirationDate) : '—'}</TableCell>
                  <TableCell>{getStatusChip(a)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CertificationCompliance;
