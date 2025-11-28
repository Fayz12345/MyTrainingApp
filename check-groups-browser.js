// Copy and paste this into your browser console to check user groups

(async () => {
  try {
    const { fetchAuthSession } = await import('https://esm.sh/aws-amplify@6/auth');
    const session = await fetchAuthSession({ forceRefresh: true });
    const token = session.tokens?.idToken?.payload;
    
    console.log('=== Current User Groups ===');
    console.log('User ID:', token['sub']);
    console.log('Email:', token['email']);
    console.log('Groups:', token['cognito:groups'] || 'No groups found');
    console.log('');
    console.log('Role Checks:');
    const groups = token['cognito:groups'] || [];
    console.log('  SuperAdmin:', groups.includes('SuperAdmin') ? '✅' : '❌');
    console.log('  BusinessUnit:', groups.includes('BusinessUnit') ? '✅' : '❌');
    console.log('  Store:', groups.includes('Store') ? '✅' : '❌');
    console.log('  Managers:', groups.includes('Managers') ? '✅' : '❌');
    console.log('  Employees:', groups.includes('Employees') ? '✅' : '❌');
    console.log('');
    console.log('Token expires:', new Date(token['exp'] * 1000).toLocaleString());
    
    return {
      userId: token['sub'],
      email: token['email'],
      groups: Array.isArray(groups) ? groups : (typeof groups === 'string' ? [groups] : []),
      isSuperAdmin: groups.includes('SuperAdmin')
    };
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
})();
