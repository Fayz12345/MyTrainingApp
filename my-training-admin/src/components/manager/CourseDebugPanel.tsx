import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

const client = generateClient<Schema>();

interface DebugPanelProps {
  courseId?: string;
}

const CourseDebugPanel: React.FC<DebugPanelProps> = ({ courseId }) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    if (!courseId) {
      setDebugInfo({ error: 'No course ID provided' });
      return;
    }

    setLoading(true);
    const steps: any = {};

    try {
      // Step 1: Test list() query
      console.log('=== DEBUG STEP 1: Testing list() ===');
      const listResult = await client.models.Course.list({});
      steps.step1_listQuery = {
        success: true,
        totalCourses: listResult.data?.length || 0,
        sampleCourse: listResult.data?.[0] || null,
        hasDescription: listResult.data?.[0]?.description !== undefined,
        hasImageKey: listResult.data?.[0]?.imageKey !== undefined,
        descriptionValue: listResult.data?.[0]?.description,
        imageKeyValue: listResult.data?.[0]?.imageKey,
        errors: listResult.errors
      };
      console.log('Step 1 result:', steps.step1_listQuery);

      // Step 2: Test get() query for specific course
      console.log('=== DEBUG STEP 2: Testing get() ===');
      const getResult = await client.models.Course.get({ id: courseId });
      steps.step2_getQuery = {
        success: !!getResult.data,
        courseData: getResult.data,
        hasDescription: getResult.data?.description !== undefined,
        hasImageKey: getResult.data?.imageKey !== undefined,
        descriptionValue: getResult.data?.description,
        imageKeyValue: getResult.data?.imageKey,
        errors: getResult.errors
      };
      console.log('Step 2 result:', steps.step2_getQuery);

      // Step 3: Check if data exists in database
      if (getResult.data) {
        steps.step3_dataAnalysis = {
          id: getResult.data.id,
          title: getResult.data.title,
          description: {
            exists: getResult.data.description !== undefined,
            isNull: getResult.data.description === null,
            isEmpty: getResult.data.description === '',
            value: getResult.data.description,
            type: typeof getResult.data.description
          },
          imageKey: {
            exists: getResult.data.imageKey !== undefined,
            isNull: getResult.data.imageKey === null,
            isEmpty: getResult.data.imageKey === '',
            value: getResult.data.imageKey,
            type: typeof getResult.data.imageKey
          }
        };
      }

      setDebugInfo({
        success: true,
        courseId,
        timestamp: new Date().toISOString(),
        steps
      });
    } catch (error: any) {
      setDebugInfo({
        success: false,
        error: error.message,
        stack: error.stack,
        steps
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      runDebug();
    }
  }, [courseId]);

  if (!courseId) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', margin: '1rem 0' }}>
        <p>No course ID provided for debugging</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f8f9fa', 
      border: '1px solid #dee2e6', 
      borderRadius: '8px', 
      margin: '1rem 0',
      fontFamily: 'monospace',
      fontSize: '0.9rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🔍 Course Debug Panel</h3>
        <button 
          onClick={runDebug}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Running...' : 'Refresh Debug'}
        </button>
      </div>

      {loading && <p>Running debug checks...</p>}

      {debugInfo && (
        <div>
          <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: debugInfo.success ? '#d4edda' : '#f8d7da', borderRadius: '4px' }}>
            <strong>Status:</strong> {debugInfo.success ? '✅ Success' : '❌ Error'}
            {debugInfo.error && <div style={{ marginTop: '0.5rem', color: '#721c24' }}>Error: {debugInfo.error}</div>}
          </div>

          {debugInfo.steps && (
            <div>
              {/* Step 1: List Query */}
              {debugInfo.steps.step1_listQuery && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <h4 style={{ marginTop: 0 }}>Step 1: list() Query Result</h4>
                  <div style={{ marginLeft: '1rem' }}>
                    <p><strong>Total Courses:</strong> {debugInfo.steps.step1_listQuery.totalCourses}</p>
                    <p><strong>Has Description:</strong> {debugInfo.steps.step1_listQuery.hasDescription ? '✅ Yes' : '❌ No'}</p>
                    <p><strong>Has ImageKey:</strong> {debugInfo.steps.step1_listQuery.hasImageKey ? '✅ Yes' : '❌ No'}</p>
                    <p><strong>Description Value:</strong> {debugInfo.steps.step1_listQuery.descriptionValue ?? '(null/undefined)'}</p>
                    <p><strong>ImageKey Value:</strong> {debugInfo.steps.step1_listQuery.imageKeyValue ?? '(null/undefined)'}</p>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#007bff' }}>View Full Sample Course</summary>
                      <pre style={{ backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>
                        {JSON.stringify(debugInfo.steps.step1_listQuery.sampleCourse, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              {/* Step 2: Get Query */}
              {debugInfo.steps.step2_getQuery && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <h4 style={{ marginTop: 0 }}>Step 2: get() Query Result</h4>
                  <div style={{ marginLeft: '1rem' }}>
                    <p><strong>Success:</strong> {debugInfo.steps.step2_getQuery.success ? '✅ Yes' : '❌ No'}</p>
                    <p><strong>Has Description:</strong> {debugInfo.steps.step2_getQuery.hasDescription ? '✅ Yes' : '❌ No'}</p>
                    <p><strong>Has ImageKey:</strong> {debugInfo.steps.step2_getQuery.hasImageKey ? '✅ Yes' : '❌ No'}</p>
                    <p><strong>Description Value:</strong> {debugInfo.steps.step2_getQuery.descriptionValue ?? '(null/undefined)'}</p>
                    <p><strong>ImageKey Value:</strong> {debugInfo.steps.step2_getQuery.imageKeyValue ?? '(null/undefined)'}</p>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#007bff' }}>View Full Course Data</summary>
                      <pre style={{ backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>
                        {JSON.stringify(debugInfo.steps.step2_getQuery.courseData, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              {/* Step 3: Data Analysis */}
              {debugInfo.steps.step3_dataAnalysis && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <h4 style={{ marginTop: 0 }}>Step 3: Data Analysis</h4>
                  <div style={{ marginLeft: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Description Field:</strong>
                      <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                        <li>Exists: {debugInfo.steps.step3_dataAnalysis.description.exists ? '✅' : '❌'}</li>
                        <li>Is Null: {debugInfo.steps.step3_dataAnalysis.description.isNull ? '⚠️ Yes' : '✅ No'}</li>
                        <li>Is Empty: {debugInfo.steps.step3_dataAnalysis.description.isEmpty ? '⚠️ Yes' : '✅ No'}</li>
                        <li>Type: {debugInfo.steps.step3_dataAnalysis.description.type}</li>
                        <li>Value: <code>{debugInfo.steps.step3_dataAnalysis.description.value ?? '(null/undefined)'}</code></li>
                      </ul>
                    </div>
                    <div>
                      <strong>ImageKey Field:</strong>
                      <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                        <li>Exists: {debugInfo.steps.step3_dataAnalysis.imageKey.exists ? '✅' : '❌'}</li>
                        <li>Is Null: {debugInfo.steps.step3_dataAnalysis.imageKey.isNull ? '⚠️ Yes' : '✅ No'}</li>
                        <li>Is Empty: {debugInfo.steps.step3_dataAnalysis.imageKey.isEmpty ? '⚠️ Yes' : '✅ No'}</li>
                        <li>Type: {debugInfo.steps.step3_dataAnalysis.imageKey.type}</li>
                        <li>Value: <code>{debugInfo.steps.step3_dataAnalysis.imageKey.value ?? '(null/undefined)'}</code></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <details>
            <summary style={{ cursor: 'pointer', color: '#007bff', marginTop: '1rem' }}>View Raw Debug Data</summary>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', overflow: 'auto', maxHeight: '400px', marginTop: '0.5rem' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default CourseDebugPanel;

