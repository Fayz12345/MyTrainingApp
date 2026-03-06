/**
 * Certification Expiration Check Lambda
 *
 * Runs on a schedule (EventBridge cron, e.g. daily). For each completed learning path
 * assignment with an expiration date:
 * - Sends reminder emails at 30, 14, and 7 days before expiration (SES).
 * - At 7 days, also notifies manager via SNS.
 * - On expiration, marks assignment as expired and auto re-assigns the learning path.
 */

import * as https from 'https';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'ca-central-1' });
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'ca-central-1' });

const APPSYNC_ENDPOINT = process.env.APPSYNC_API_URL || process.env.APPSYNC_ENDPOINT || '';
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || '';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';

const REMINDER_DAYS = [30, 14, 7] as const;

function daysUntil(dateStr: string): number {
  const exp = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function queryAppSync(query: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(APPSYNC_ENDPOINT);
    const postData = JSON.stringify(query);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APPSYNC_API_KEY,
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendReminderEmail(toEmail: string, employeeName: string, pathTitle: string, daysLeft: number): Promise<void> {
  if (!FROM_EMAIL || !toEmail) return;
  const subject = `Certification expiring in ${daysLeft} days: ${pathTitle}`;
  const body = `Hi ${employeeName},\n\nYour certification for "${pathTitle}" will expire in ${daysLeft} days. Please complete the recertification before the expiration date.\n\nThank you.`;
  try {
    await sesClient.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: body },
        },
      },
    }));
  } catch (err) {
    console.error('[CERT_CHECK] SES send failed:', err);
  }
}

async function notifyManagerSNS(managerMessage: string): Promise<void> {
  if (!SNS_TOPIC_ARN) return;
  try {
    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: 'Certification expiration warning (7 days)',
      Message: managerMessage,
    }));
  } catch (err) {
    console.error('[CERT_CHECK] SNS publish failed:', err);
  }
}

export const handler = async (): Promise<{ processed: number; reminders: number; expired: number }> => {
  const logPrefix = '[CERT_EXPIRATION_CHECK]';
  const now = new Date().toISOString();
  let remindersSent = 0;
  let expiredCount = 0;

  console.log(`${logPrefix} Running at ${now}`);

  if (!APPSYNC_ENDPOINT || !APPSYNC_API_KEY) {
    console.warn(`${logPrefix} AppSync config missing; skipping`);
    return { processed: 0, reminders: 0, expired: 0 };
  }

  try {
    // List all learning path assignments (we filter for completed + expiration in code)
    let items: any[] = [];
    let nextToken: string | undefined;
    do {
      const q = {
        query: `
          query ListLearningPathAssignments($nextToken: String) {
            listLearningPathAssignments(nextToken: $nextToken) {
              items {
                id
                learningPathId
                employeeId
                status
                completedDate
                expirationDate
                lastReminderSentAt
                reminderCount
                employee { id name email }
                learningPath { id title certificationExpirationDays }
              }
              nextToken
            }
          }
        `,
        variables: nextToken ? { nextToken } : {},
      };
      const res: any = await queryAppSync(q);
      const data = res?.data?.listLearningPathAssignments;
      if (data?.items) items = items.concat(data.items);
      nextToken = data?.nextToken || undefined;
    } while (nextToken);

    const withExpiration = items.filter(
      (a: any) => a.status === 'completed' && a.expirationDate && a.learningPath?.certificationExpirationDays
    );
    console.log(`${logPrefix} Found ${withExpiration.length} assignments with expiration`);

    for (const assignment of withExpiration) {
      const daysLeft = daysUntil(assignment.expirationDate);
      const lastReminder = assignment.lastReminderSentAt ? new Date(assignment.lastReminderSentAt) : null;
      const reminderCount = assignment.reminderCount ?? 0;

      // Expired: mark as expired and re-assign
      if (daysLeft <= 0) {
        try {
          await queryAppSync({
            query: `
              mutation UpdateLearningPathAssignment($input: UpdateLearningPathAssignmentInput!) {
                updateLearningPathAssignment(input: $input) { id status certificationStatus }
              }
            `,
            variables: {
              input: {
                id: assignment.id,
                status: 'expired',
                certificationStatus: 'expired',
                updatedAt: now,
              },
            },
          });

          // Create new LearningPathAssignment (re-assign)
          const createLpa = await queryAppSync({
            query: `
              mutation CreateLearningPathAssignment($input: CreateLearningPathAssignmentInput!) {
                createLearningPathAssignment(input: $input) { id }
              }
            `,
            variables: {
              input: {
                learningPathId: assignment.learningPathId,
                employeeId: assignment.employeeId,
                status: 'not_started',
                assignedDate: now,
                createdAt: now,
                updatedAt: now,
              },
            },
          });
          const newLpaId = createLpa?.data?.createLearningPathAssignment?.id;

          // Create individual Assignment records for each course in the path
          const pathCoursesRes: any = await queryAppSync({
            query: `
              query ListLearningPathCourses($filter: ModelLearningPathCourseFilterInput) {
                listLearningPathCourses(filter: $filter) {
                  items { id courseId order }
                }
              }
            `,
            variables: {
              filter: { learningPathId: { eq: assignment.learningPathId } },
            },
          });
          const pathCourses = pathCoursesRes?.data?.listLearningPathCourses?.items || [];
          for (const pc of pathCourses) {
            await queryAppSync({
              query: `
                mutation CreateAssignment($input: CreateAssignmentInput!) {
                  createAssignment(input: $input) { id }
                }
              `,
              variables: {
                input: {
                  employeeId: assignment.employeeId,
                  courseId: pc.courseId,
                  status: 'assigned',
                  assignmentSource: 'learning_path',
                  learningPathId: assignment.learningPathId,
                  createdAt: now,
                  updatedAt: now,
                },
              },
            });
          }

          expiredCount++;
          console.log(`${logPrefix} Expired and re-assigned: ${assignment.learningPath?.title} for ${assignment.employee?.email}`);
        } catch (err) {
          console.error(`${logPrefix} Failed to expire/reassign ${assignment.id}:`, err);
        }
        continue;
      }

      // Reminders at 7, 14, 30 days
      if (daysLeft <= 7 && reminderCount < 3) {
        await sendReminderEmail(
          assignment.employee?.email,
          assignment.employee?.name || 'Employee',
          assignment.learningPath?.title || 'Certification',
          7
        );
        await notifyManagerSNS(
          `Certification "${assignment.learningPath?.title}" for ${assignment.employee?.name} (${assignment.employee?.email}) expires in 7 days.`
        );
        await queryAppSync({
          query: `
            mutation UpdateLearningPathAssignment($input: UpdateLearningPathAssignmentInput!) {
              updateLearningPathAssignment(input: $input) { id lastReminderSentAt reminderCount }
            }
          `,
          variables: {
            input: {
              id: assignment.id,
              lastReminderSentAt: now,
              reminderCount: 3,
              updatedAt: now,
            },
          },
        });
        remindersSent++;
      } else if (daysLeft <= 14 && reminderCount < 2) {
        await sendReminderEmail(
          assignment.employee?.email,
          assignment.employee?.name || 'Employee',
          assignment.learningPath?.title || 'Certification',
          14
        );
        await queryAppSync({
          query: `
            mutation UpdateLearningPathAssignment($input: UpdateLearningPathAssignmentInput!) {
              updateLearningPathAssignment(input: $input) { id lastReminderSentAt reminderCount }
            }
          `,
          variables: {
            input: {
              id: assignment.id,
              lastReminderSentAt: now,
              reminderCount: 2,
              updatedAt: now,
            },
          },
        });
        remindersSent++;
      } else if (daysLeft <= 30 && reminderCount < 1) {
        await sendReminderEmail(
          assignment.employee?.email,
          assignment.employee?.name || 'Employee',
          assignment.learningPath?.title || 'Certification',
          30
        );
        await queryAppSync({
          query: `
            mutation UpdateLearningPathAssignment($input: UpdateLearningPathAssignmentInput!) {
              updateLearningPathAssignment(input: $input) { id lastReminderSentAt reminderCount }
            }
          `,
          variables: {
            input: {
              id: assignment.id,
              lastReminderSentAt: now,
              reminderCount: 1,
              updatedAt: now,
            },
          },
        });
        remindersSent++;
      }
    }

    console.log(`${logPrefix} Done. Reminders: ${remindersSent}, Expired/Re-assigned: ${expiredCount}`);
    return { processed: withExpiration.length, reminders: remindersSent, expired: expiredCount };
  } catch (err) {
    console.error(`${logPrefix} Error:`, err);
    throw err;
  }
};
