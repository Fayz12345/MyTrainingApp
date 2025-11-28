import React, { useState, useEffect } from 'react';
import { getUserGroups } from '../../utils/checkUserGroups';

/**
 * Debug component to display current user's Cognito groups
 * Add this to your app temporarily to debug group issues
 */
const UserGroupsDebug: React.FC = () => {
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await getUserGroups(true); // Force refresh
      setGroupInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  if (loading) {
    return <div>Loading user groups...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828' }}>
        <p>Error: {error}</p>
        <button onClick={fetchGroups}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f5f5f5', 
      border: '1px solid #ccc',
      borderRadius: '4px',
      margin: '1rem 0'
    }}>
      <h3>Current User Groups (Debug)</h3>
      <div style={{ marginTop: '0.5rem' }}>
        <p><strong>User ID:</strong> {groupInfo?.userId || 'N/A'}</p>
        <p><strong>Email:</strong> {groupInfo?.email || 'N/A'}</p>
        <p><strong>Groups:</strong> {groupInfo?.groups.length > 0 ? groupInfo.groups.join(', ') : 'None'}</p>
        <div style={{ marginTop: '0.5rem' }}>
          <strong>Role Flags:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>SuperAdmin: {groupInfo?.isSuperAdmin ? '✅' : '❌'}</li>
            <li>BusinessUnit: {groupInfo?.isBusinessUnit ? '✅' : '❌'}</li>
            <li>Store: {groupInfo?.isStore ? '✅' : '❌'}</li>
            <li>Manager: {groupInfo?.isManager ? '✅' : '❌'}</li>
            <li>Employee: {groupInfo?.isEmployee ? '✅' : '❌'}</li>
          </ul>
        </div>
        <button 
          onClick={fetchGroups}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}
        >
          🔄 Refresh Groups
        </button>
      </div>
    </div>
  );
};

export default UserGroupsDebug;

