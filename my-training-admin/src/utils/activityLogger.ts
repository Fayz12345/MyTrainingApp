/**
 * Activity Logger Utility
 * Creates daily log files for tracking manager activities
 * Logs are stored in S3 under "log/" folder (accessible as files)
 * Also backed up in localStorage for offline access
 * 
 * Log files are saved to: S3 bucket -> log/activity_log_YYYY-MM-DD.txt
 * Physical location: AWS S3 (accessible via Amplify Storage)
 */

export type ActivityType = 
  | 'COURSE_CREATED'
  | 'COURSE_UPDATED'
  | 'COURSE_ASSIGNED'
  | 'LEARNING_PATH_CREATED'
  | 'LEARNING_PATH_UPDATED'
  | 'LEARNING_PATH_ASSIGNED';

export interface ActivityLog {
  timestamp: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: Record<string, any>;
  storeId?: string;
}

class ActivityLogger {
  private readonly STORAGE_KEY = 'activity_logs';
  private readonly LOG_FOLDER_PREFIX = 'log/';
  private readonly MAX_LOCAL_LOGS = 1000; // Keep last 1000 logs in localStorage
  private readonly MAX_LOG_FILES = 90; // Keep last 90 days of log files

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current timestamp in ISO format
   */
  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get log file key for a specific date
   */
  private getLogFileKey(date: string): string {
    return `${this.LOG_FOLDER_PREFIX}activity_log_${date}.txt`;
  }

  /**
   * Format log entry for file output
   */
  private formatLogEntry(log: ActivityLog): string {
    const detailsStr = JSON.stringify(log.details, null, 2);
    return `[${log.timestamp}] ${log.type} | User: ${log.userName} (${log.userEmail}) | ${log.action}\nDetails: ${detailsStr}\n${'='.repeat(80)}\n`;
  }

  /**
   * Get log file content for a specific date
   */
  private getLogFileContent(date: string): string {
    try {
      const key = this.getLogFileKey(date);
      const content = localStorage.getItem(key);
      return content || '';
    } catch (error) {
      console.error('[ActivityLogger] Error reading log file:', error);
      return '';
    }
  }

  /**
   * Save log file content for a specific date
   */
  private saveLogFileContent(date: string, content: string): void {
    try {
      const key = this.getLogFileKey(date);
      localStorage.setItem(key, content);
    } catch (error) {
      console.error('[ActivityLogger] Error saving log file:', error);
    }
  }

  /**
   * Initialize log file for a date (add header if file doesn't exist)
   */
  private initializeLogFile(date: string): void {
    const existingContent = this.getLogFileContent(date);
    if (!existingContent || existingContent.trim() === '') {
      let content = `Activity Log - ${date}\n`;
      content += `${'='.repeat(80)}\n`;
      content += `Total Activities: 0\n`;
      content += `${'='.repeat(80)}\n\n`;
      this.saveLogFileContent(date, content);
    }
  }

  /**
   * Upload log file to S3
   */
  private async uploadLogFileToS3(date: string, content: string): Promise<void> {
    try {
      const { uploadData } = await import('aws-amplify/storage');
      const filename = `activity_log_${date}.txt`;
      const s3Path = `log/${filename}`;
      
      // Create blob from content
      const blob = new Blob([content], { type: 'text/plain' });
      
      // Upload to S3 (overwrite if exists)
      await uploadData({
        path: s3Path,
        data: blob,
        options: {
          contentType: 'text/plain',
        }
      });
      
      console.log(`[ActivityLogger] ✅ Log file saved to S3: ${s3Path}`);
    } catch (error) {
      // Don't throw - just log the error, localStorage backup will still work
      console.error('[ActivityLogger] Error uploading log file to S3:', error);
      console.warn('[ActivityLogger] Log file saved to localStorage as backup');
    }
  }

  /**
   * Append activity to daily log file
   */
  private async appendToLogFile(log: ActivityLog): Promise<void> {
    const date = this.getTodayDate();
    
    // Initialize file if it doesn't exist
    this.initializeLogFile(date);
    
    // Get current content
    let content = this.getLogFileContent(date);
    
    // Extract current activity count from header
    const headerMatch = content.match(/Total Activities: (\d+)/);
    const currentCount = headerMatch ? parseInt(headerMatch[1], 10) : 0;
    const newCount = currentCount + 1;
    
    // Update header with new count
    content = content.replace(
      /Total Activities: \d+/,
      `Total Activities: ${newCount}`
    );
    
    // Append new log entry
    content += this.formatLogEntry(log);
    
    // Save updated content to localStorage (backup)
    this.saveLogFileContent(date, content);
    
    // Upload to S3 (primary storage - async, non-blocking)
    try {
      await this.uploadLogFileToS3(date, content);
    } catch (err) {
      console.error('[ActivityLogger] Failed to upload log file to S3:', err);
      // Continue - localStorage backup is already saved
    }
  }

  /**
   * Log an activity (manager only)
   */
  async logActivity(
    type: ActivityType,
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    details: Record<string, any> = {},
    storeId?: string
  ): Promise<void> {
    const logEntry: ActivityLog = {
      timestamp: this.getCurrentTimestamp(),
      type,
      userId,
      userName,
      userEmail,
      action,
      details,
      storeId,
    };

    try {
      // Store in localStorage for quick access
      const existingLogs = this.getStoredLogs();
      existingLogs.push(logEntry);

      // Keep only the last MAX_LOCAL_LOGS entries
      const trimmedLogs = existingLogs.slice(-this.MAX_LOCAL_LOGS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedLogs));

      // Append to daily log file (no download)
      this.appendToLogFile(logEntry);

      // Also log to console for debugging
      console.log('[ActivityLogger]', logEntry);
    } catch (error) {
      console.error('[ActivityLogger] Error logging activity:', error);
    }
  }

  /**
   * Get all stored logs from localStorage
   */
  getStoredLogs(): ActivityLog[] {
    try {
      const logsJson = localStorage.getItem(this.STORAGE_KEY);
      if (!logsJson) return [];
      return JSON.parse(logsJson) as ActivityLog[];
    } catch (error) {
      console.error('[ActivityLogger] Error reading stored logs:', error);
      return [];
    }
  }

  /**
   * Get logs for a specific date
   */
  getLogsForDate(date: string): ActivityLog[] {
    const allLogs = this.getStoredLogs();
    return allLogs.filter(log => log.timestamp.startsWith(date));
  }

  /**
   * Get today's logs
   */
  getTodayLogs(): ActivityLog[] {
    return this.getLogsForDate(this.getTodayDate());
  }

  /**
   * Get daily log file content from stored file
   */
  getDailyLogFileContent(date?: string): string {
    const targetDate = date || this.getTodayDate();
    const content = this.getLogFileContent(targetDate);
    
    if (!content || content.trim() === '') {
      return `No activities logged for ${targetDate}\n`;
    }

    return content;
  }

  /**
   * List all available log files (from localStorage and optionally from S3)
   */
  listLogFiles(): Array<{ date: string; filename: string; activityCount: number; source: 'localStorage' | 's3' }> {
    const logFiles: Array<{ date: string; filename: string; activityCount: number; source: 'localStorage' | 's3' }> = [];
    
    try {
      // Iterate through localStorage to find all log files
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.LOG_FOLDER_PREFIX)) {
          const dateMatch = key.match(/activity_log_(\d{4}-\d{2}-\d{2})\.txt/);
          if (dateMatch) {
            const date = dateMatch[1];
            const content = this.getLogFileContent(date);
            const countMatch = content.match(/Total Activities: (\d+)/);
            const activityCount = countMatch ? parseInt(countMatch[1], 10) : 0;
            
            logFiles.push({
              date,
              filename: `activity_log_${date}.txt`,
              activityCount,
              source: 'localStorage',
            });
          }
        }
      }
      
      // Sort by date (newest first)
      logFiles.sort((a, b) => b.date.localeCompare(a.date));
      
      return logFiles;
    } catch (error) {
      console.error('[ActivityLogger] Error listing log files:', error);
      return [];
    }
  }

  /**
   * List log files from S3 storage
   */
  async listLogFilesFromS3(): Promise<Array<{ date: string; filename: string; size?: number; lastModified?: Date }>> {
    try {
      const { list } = await import('aws-amplify/storage');
      
      const result = await list({
        path: 'log/',
        options: {
          listAll: true,
        }
      });
      
      const logFiles: Array<{ date: string; filename: string; size?: number; lastModified?: Date }> = [];
      
      if (result.items) {
        for (const item of result.items) {
          const pathMatch = item.path?.match(/log\/activity_log_(\d{4}-\d{2}-\d{2})\.txt/);
          if (pathMatch) {
            const date = pathMatch[1];
            logFiles.push({
              date,
              filename: `activity_log_${date}.txt`,
              size: item.size,
              lastModified: item.lastModified,
            });
          }
        }
      }
      
      // Sort by date (newest first)
      logFiles.sort((a, b) => b.date.localeCompare(a.date));
      
      return logFiles;
    } catch (error) {
      console.error('[ActivityLogger] Error listing log files from S3:', error);
      return [];
    }
  }

  /**
   * Download log file from S3
   */
  async downloadLogFileFromS3(date: string): Promise<void> {
    try {
      const { getUrl } = await import('aws-amplify/storage');
      const filename = `activity_log_${date}.txt`;
      const s3Path = `log/${filename}`;
      
      // Get download URL from S3
      const { url } = await getUrl({
        path: s3Path,
        options: {
          expiresIn: 3600, // 1 hour
        }
      });
      
      // Download the file
      const response = await fetch(url.toString());
      const blob = await response.blob();
      const content = await blob.text();
      
      // Trigger browser download
      const downloadBlob = new Blob([content], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      console.log(`[ActivityLogger] ✅ Downloaded log file from S3: ${s3Path}`);
    } catch (error) {
      console.error('[ActivityLogger] Error downloading log file from S3:', error);
      // Fallback to localStorage
      console.log('[ActivityLogger] Falling back to localStorage version');
      this.downloadLogFile(date);
    }
  }

  /**
   * Get log file content from S3
   */
  async getLogFileContentFromS3(date: string): Promise<string> {
    try {
      const { getUrl } = await import('aws-amplify/storage');
      const filename = `activity_log_${date}.txt`;
      const s3Path = `log/${filename}`;
      
      // Get download URL from S3
      const { url } = await getUrl({
        path: s3Path,
        options: {
          expiresIn: 3600, // 1 hour
        }
      });
      
      // Fetch the file content
      const response = await fetch(url.toString());
      const content = await response.text();
      
      return content;
    } catch (error) {
      console.error('[ActivityLogger] Error getting log file content from S3:', error);
      // Fallback to localStorage
      return this.getDailyLogFileContent(date);
    }
  }

  /**
   * Download a specific log file (from localStorage or S3)
   */
  async downloadLogFile(date: string, preferS3: boolean = true): Promise<void> {
    if (preferS3) {
      try {
        await this.downloadLogFileFromS3(date);
        return;
      } catch (error) {
        console.warn('[ActivityLogger] S3 download failed, falling back to localStorage');
      }
    }
    
    // Fallback to localStorage
    const content = this.getDailyLogFileContent(date);
    const filename = `activity_log_${date}.txt`;
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Download all log files as a zip (or individual files)
   */
  async downloadAllLogFiles(preferS3: boolean = true): Promise<void> {
    let logFiles: Array<{ date: string; filename: string }>;
    
    if (preferS3) {
      try {
        const s3Files = await this.listLogFilesFromS3();
        logFiles = s3Files.map(f => ({ date: f.date, filename: f.filename }));
      } catch (error) {
        console.warn('[ActivityLogger] Failed to list S3 files, using localStorage');
        logFiles = this.listLogFiles().map(f => ({ date: f.date, filename: f.filename }));
      }
    } else {
      logFiles = this.listLogFiles().map(f => ({ date: f.date, filename: f.filename }));
    }
    
    if (logFiles.length === 0) {
      console.warn('[ActivityLogger] No log files to download');
      return;
    }
    
    // Download each file individually
    // Note: Browsers don't support creating zip files natively,
    // so we'll download them one by one with a small delay
    for (let i = 0; i < logFiles.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i * 300)); // 300ms delay between downloads
      await this.downloadLogFile(logFiles[i].date, preferS3);
    }
  }

  /**
   * Get log file as blob (for S3 upload or other uses)
   */
  getDailyLogFileBlob(date?: string): Blob {
    const targetDate = date || this.getTodayDate();
    const content = this.getDailyLogFileContent(targetDate);
    return new Blob([content], { type: 'text/plain' });
  }

  /**
   * Clear old logs and log files (older than specified days)
   */
  clearOldLogs(daysToKeep: number = 30): void {
    try {
      // Clear old activity logs from localStorage
      const allLogs = this.getStoredLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();

      const filteredLogs = allLogs.filter(log => log.timestamp >= cutoffTimestamp);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredLogs));
      
      // Clear old log files
      const logFiles = this.listLogFiles();
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      let deletedCount = 0;
      logFiles.forEach(file => {
        if (file.date < cutoffDateStr) {
          const key = this.getLogFileKey(file.date);
          localStorage.removeItem(key);
          deletedCount++;
        }
      });
      
      console.log(`[ActivityLogger] Cleared old logs. Kept ${filteredLogs.length} logs and deleted ${deletedCount} old log files from last ${daysToKeep} days.`);
    } catch (error) {
      console.error('[ActivityLogger] Error clearing old logs:', error);
    }
  }

  /**
   * Export all logs as JSON
   */
  exportAllLogsAsJSON(): void {
    const allLogs = this.getStoredLogs();
    const jsonContent = JSON.stringify(allLogs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity_logs_export_${this.getTodayDate()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get activity statistics
   */
  getActivityStats(days: number = 7): {
    total: number;
    byType: Record<ActivityType, number>;
    byDate: Record<string, number>;
  } {
    const allLogs = this.getStoredLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = cutoffDate.toISOString();

    const recentLogs = allLogs.filter(log => log.timestamp >= cutoffTimestamp);

    const stats = {
      total: recentLogs.length,
      byType: {} as Record<ActivityType, number>,
      byDate: {} as Record<string, number>,
    };

    recentLogs.forEach(log => {
      // Count by type
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

      // Count by date
      const date = log.timestamp.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const activityLogger = new ActivityLogger();

// Auto-clear logs older than 30 days on initialization
if (typeof window !== 'undefined') {
  activityLogger.clearOldLogs(30);
}

/**
 * Helper function to get current user info for logging
 */
export async function getCurrentUserInfo(): Promise<{
  userId: string;
  userName: string;
  userEmail: string;
}> {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    const userId = session.userSub || session.tokens?.idToken?.payload?.sub as string;
    const email = session.tokens?.idToken?.payload?.email as string | undefined;
    const name = session.tokens?.idToken?.payload?.name as string | undefined;
    const givenName = session.tokens?.idToken?.payload?.given_name as string | undefined;
    const familyName = session.tokens?.idToken?.payload?.family_name as string | undefined;
    
    // If name/email not in token, try to fetch from Manager table
    if ((!name && !givenName) || !email) {
      try {
        const { generateClient } = await import('aws-amplify/data');
        // Import Schema type dynamically
        type Schema = import('../../../amplify/data/resource').Schema;
        const client = generateClient<Schema>();
        
        const managersResult = await client.models.Manager.list({
          filter: { userId: { eq: userId } }
        });
        
        if (managersResult.data && managersResult.data.length > 0) {
          const manager = managersResult.data[0];
          return {
            userId,
            userName: manager.name || name || givenName || `${givenName || ''} ${familyName || ''}`.trim() || 'Unknown User',
            userEmail: manager.email || email || 'unknown@example.com',
          };
        }
      } catch (err) {
        console.warn('[ActivityLogger] Could not fetch manager info:', err);
      }
    }
    
    const fullName = name || givenName || (givenName && familyName ? `${givenName} ${familyName}` : 'Unknown User');
    
    return {
      userId: userId || 'unknown',
      userName: fullName,
      userEmail: email || 'unknown@example.com',
    };
  } catch (error) {
    console.error('[ActivityLogger] Error getting user info:', error);
    return {
      userId: 'unknown',
      userName: 'Unknown User',
      userEmail: 'unknown@example.com',
    };
  }
}

