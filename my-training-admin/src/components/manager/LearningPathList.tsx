import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const client = generateClient<Schema>();

interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  version?: number | null;
  isArchived?: boolean | null;
  isSequential?: boolean | null;
  mandatoryForScheduling?: boolean | null;
  createdAt: string;
  updatedAt: string;
  courses?: {
    items?: Array<{
      id: string;
      order: number;
      isRequired: boolean;
      course?: {
        id: string;
        title: string;
      } | null;
    }> | null;
  } | null;
}

interface LearningPathListProps {
  refreshTrigger?: number;
  onEdit?: (learningPath: LearningPath) => void;
}

const LearningPathList: React.FC<LearningPathListProps> = ({ refreshTrigger, onEdit }) => {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [archivedPaths, setArchivedPaths] = useState<LearningPath[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathVersions, setPathVersions] = useState<LearningPath[]>([]);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    fetchLearningPaths();
  }, [refreshTrigger]);

  const fetchLearningPaths = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current manager's userId
      const session = await fetchAuthSession();
      const currentUserId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      console.log('[LearningPathList] Fetching learning paths for manager:', currentUserId);

      // Fetch learning paths created by the current manager
      const allPathsResult = await client.models.LearningPath.list({
        filter: { createdBy: { eq: currentUserId } }
      });

      if (allPathsResult.errors && allPathsResult.errors.length > 0) {
        throw new Error('Failed to fetch learning paths: ' + allPathsResult.errors.map((e: any) => e.message).join(', '));
      }

      const allPaths = allPathsResult.data as LearningPath[];

      // Fetch courses for each learning path
      const pathsWithCourses = await Promise.all(
        allPaths.map(async (path) => {
          try {
            const coursesResult = await client.models.LearningPathCourse.list({
              filter: { learningPathId: { eq: path.id } }
            });
            return {
              ...path,
              courses: {
                items: coursesResult.data?.map((c: any) => ({
                  id: c.id,
                  order: c.order,
                  isRequired: c.isRequired,
                  course: c.course ? {
                    id: c.course.id,
                    title: c.course.title,
                  } : null,
                })) || []
              }
            };
          } catch (err) {
            console.error(`Error fetching courses for path ${path.id}:`, err);
            return { ...path, courses: { items: [] } };
          }
        })
      );

      // Separate archived and non-archived paths
      const activePaths = pathsWithCourses.filter(path => !path.isArchived);
      const archivedPathsList = pathsWithCourses.filter(path => path.isArchived);

      setLearningPaths(activePaths);
      setArchivedPaths(archivedPathsList);
    } catch (err) {
      console.error('Error fetching learning paths:', err);
      setError(err instanceof Error ? err.message : 'Failed to load learning paths');
    } finally {
      setLoading(false);
    }
  };

  const fetchPathVersions = async (pathId: string) => {
    try {
      setSelectedPathId(pathId);
      
      // Get current manager's userId
      const session = await fetchAuthSession();
      const currentUserId = session.userSub || session.tokens?.idToken?.payload?.sub as string;

      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      
      // Get the path to find its parentPathId or use itself as parent
      const pathResult = await client.models.LearningPath.get({ id: pathId });
      const path = pathResult.data;
      
      if (!path) return;

      // Find all versions created by the current manager
      const allPathsResult = await client.models.LearningPath.list({
        filter: { createdBy: { eq: currentUserId } }
      });
      const allPaths = allPathsResult.data || [];
      
      // Group by parentPathId or by title+createdBy (for original paths)
      const parentId = (path as any).parentPathId || path.id;
      const versions = allPaths.filter((p: any) => 
        ((p.parentPathId === parentId) || 
        (p.id === parentId && !p.parentPathId))
      ).sort((a: any, b: any) => (a.version || 1) - (b.version || 1));

      // Fetch courses for each version
      const versionsWithCourses = await Promise.all(
        versions.map(async (v: any) => {
          try {
            const coursesResult = await client.models.LearningPathCourse.list({
              filter: { learningPathId: { eq: v.id } }
            });
            return {
              ...v,
              courses: {
                items: coursesResult.data?.map((c: any) => ({
                  id: c.id,
                  order: c.order,
                  isRequired: c.isRequired,
                  course: c.course ? {
                    id: c.course.id,
                    title: c.course.title,
                  } : null,
                })) || []
              }
            };
          } catch (err) {
            console.error(`Error fetching courses for version ${v.id}:`, err);
            return { ...v, courses: { items: [] } };
          }
        })
      );

      setPathVersions(versionsWithCourses as LearningPath[]);
      setVersionsDialogOpen(true);
    } catch (err) {
      console.error('Error fetching path versions:', err);
      MySwal.fire({
        title: 'Error',
        text: 'Failed to load versions',
        icon: 'error',
      });
    }
  };

  const handleArchive = async (path: LearningPath, archive: boolean) => {
    const action = archive ? 'archive' : 'unarchive';
    const result = await MySwal.fire({
      title: `Are you sure?`,
      text: `Do you want to ${action} "${path.title}" v${path.version || 1}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      setArchiving(path.id);
      await client.models.LearningPath.update({
        id: path.id,
        isArchived: archive,
        updatedAt: new Date().toISOString(),
      });

      await MySwal.fire({
        title: 'Success!',
        text: `Learning path ${archive ? 'archived' : 'unarchived'} successfully.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });

      fetchLearningPaths();
    } catch (err) {
      console.error(`Error ${action}ing learning path:`, err);
      MySwal.fire({
        title: 'Error!',
        text: `Failed to ${action} learning path: ${err instanceof Error ? err.message : 'Unknown error'}`,
        icon: 'error',
      });
    } finally {
      setArchiving(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (learningPaths.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            No Learning Paths
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first learning path to get started.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const renderPathRow = (path: LearningPath, isArchived: boolean = false) => {
              const courseCount = path.courses?.items?.length || 0;
              return (
      <TableRow 
        key={path.id} 
        hover={!isArchived}
        sx={{ 
          opacity: isArchived ? 0.7 : 1,
          bgcolor: isArchived ? 'grey.50' : 'inherit'
        }}
      >
                  <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {path.title}
                    </Typography>
            {isArchived && (
              <Chip label="Archived" size="small" color="default" />
            )}
          </Box>
                    {path.description && (
                      <Typography variant="body2" color="text.secondary">
                        {path.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={`v${path.version || 1}`} size="small" />
                  </TableCell>
                  <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={path.status === 'published' ? 'Published' : 'Draft'}
                      color={path.status === 'published' ? 'success' : 'default'}
                      size="small"
                    />
            {path.mandatoryForScheduling && (
              <Chip
                label="Mandatory for Scheduling"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {isArchived && (
              <Chip
                label="Cannot be assigned"
                size="small"
                variant="outlined"
                color="warning"
              />
            )}
          </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {courseCount} course{courseCount !== 1 ? 's' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={path.isSequential ? 'Sequential' : 'Flexible'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(path.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => fetchPathVersions(path.id)}
                        title="View versions"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => onEdit && onEdit(path)}
                        title="Edit learning path"
                        color="primary"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleArchive(path, !path.isArchived)}
                        title={path.isArchived ? 'Unarchive' : 'Archive'}
                        disabled={archiving === path.id}
                      >
                        {path.isArchived ? (
                          <UnarchiveIcon fontSize="small" />
                        ) : (
                          <ArchiveIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Active Learning Paths ({learningPaths.length})
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
          }
          label="Show Archived Paths"
        />
      </Box>

      {learningPaths.length === 0 && archivedPaths.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              No Learning Paths
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first learning path to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mb: showArchived && archivedPaths.length > 0 ? 3 : 0 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Title</strong></TableCell>
                  <TableCell><strong>Version</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Courses</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {learningPaths.map((path) => renderPathRow(path, false))}
          </TableBody>
        </Table>
      </TableContainer>

          {showArchived && archivedPaths.length > 0 && (
            <Box>
              <Box sx={{ mb: 2, mt: 3 }}>
                <Typography variant="h6" color="text.secondary">
                  Archived Learning Paths ({archivedPaths.length})
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Archived paths are viewable for historical tracking but cannot be assigned to employees.
                </Typography>
              </Box>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Title</strong></TableCell>
                      <TableCell><strong>Version</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Courses</strong></TableCell>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell><strong>Created</strong></TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {archivedPaths.map((path) => renderPathRow(path, true))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}

      {/* Versions Dialog */}
      <Dialog
        open={versionsDialogOpen}
        onClose={() => setVersionsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Learning Path Versions</DialogTitle>
        <DialogContent>
          {pathVersions.length === 0 ? (
            <Typography>No versions found.</Typography>
          ) : (
            <List>
              {pathVersions.map((version, index) => (
                <React.Fragment key={version.id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6">{version.title}</Typography>
                          <Chip label={`v${version.version || 1}`} size="small" />
                          {version.isArchived && (
                            <Chip label="Archived" size="small" color="default" />
                          )}
                          <Chip
                            label={version.status === 'published' ? 'Published' : 'Draft'}
                            color={version.status === 'published' ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Created: {new Date(version.createdAt).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {version.courses?.items?.length || 0} courses
                          </Typography>
                        </Box>
                      }
                    />
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setVersionsDialogOpen(false);
                          onEdit && onEdit(version);
                        }}
                        title="Edit this version"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < pathVersions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LearningPathList;

