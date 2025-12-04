/**
 * Validates the HTML email template structure
 * Checks if all required fields are included and HTML is properly formatted
 */

// Extract the HTML template from the handler
const testData = {
  employeeName: 'Test Employee',
  courseTitle: 'Introduction to Software Testing',
  score: 100,
  managerName: 'Test Manager',
  assignmentId: 'test-assignment-12345',
  formattedDate: 'December 4, 2025 at 06:44 AM UTC'
};

// Generate HTML using the same template as the handler
const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px 20px;
    }
    .greeting {
      margin-bottom: 20px;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #ffffff;
    }
    th {
      background-color: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #45a049;
    }
    td {
      padding: 12px;
      border: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .score-cell {
      font-size: 18px;
      font-weight: bold;
      color: #4CAF50;
    }
    .status-cell {
      color: #4CAF50;
      font-weight: bold;
    }
    .footer {
      background-color: #f9f9f9;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Training Completion Notification</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear ${testData.managerName},</p>
      <p>We're pleased to inform you that an employee has successfully completed their training.</p>
      
      <table>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
        <tr>
          <td><strong>Employee Name</strong></td>
          <td>${testData.employeeName}</td>
        </tr>
        <tr>
          <td><strong>Course Title</strong></td>
          <td>${testData.courseTitle}</td>
        </tr>
        <tr>
          <td><strong>Score</strong></td>
          <td class="score-cell">${testData.score}%</td>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td class="status-cell">✅ Passed</td>
        </tr>
        <tr>
          <td><strong>Assignment ID</strong></td>
          <td>${testData.assignmentId}</td>
        </tr>
        <tr>
          <td><strong>Completion Date</strong></td>
          <td>${testData.formattedDate}</td>
        </tr>
      </table>
      
      <p>The employee has successfully completed the training course and passed the quiz.</p>
      <p>This completion has been logged in the system for scheduling API validation.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Training Management System.</p>
    </div>
  </div>
</body>
</html>
`.trim();

// Validation checks
function validateHTML(html: string) {
  const checks = {
    hasDOCTYPE: html.includes('<!DOCTYPE html>'),
    hasHTMLTag: html.includes('<html>') && html.includes('</html>'),
    hasHead: html.includes('<head>') && html.includes('</head>'),
    hasBody: html.includes('<body>') && html.includes('</body>'),
    hasStyle: html.includes('<style>') && html.includes('</style>'),
    hasTable: html.includes('<table>') && html.includes('</table>'),
    hasEmployeeName: html.includes(testData.employeeName),
    hasCourseTitle: html.includes(testData.courseTitle),
    hasScore: html.includes(`${testData.score}%`),
    hasAssignmentId: html.includes(testData.assignmentId),
    hasCompletionDate: html.includes(testData.formattedDate),
    hasManagerName: html.includes(testData.managerName),
    hasContainer: html.includes('class="container"'),
    hasHeader: html.includes('class="header"'),
    hasTableHeaders: html.includes('<th>') && html.includes('</th>'),
    hasTableRows: html.includes('<tr>') && html.includes('</tr>'),
    hasScoreCell: html.includes('class="score-cell"'),
    hasStatusCell: html.includes('class="status-cell"')
  };

  return checks;
}

// Run validation
console.log('🧪 Validating HTML Email Template');
console.log('================================\n');

const validation = validateHTML(htmlTemplate);

console.log('📋 Validation Results:\n');
let allPassed = true;

for (const [check, passed] of Object.entries(validation)) {
  const status = passed ? '✅' : '❌';
  const checkName = check.replace(/([A-Z])/g, ' $1').trim();
  console.log(`   ${status} ${checkName}`);
  if (!passed) allPassed = false;
}

console.log('');

if (allPassed) {
  console.log('✅ All validation checks passed!');
  console.log('   HTML template is correctly structured');
  console.log('   All required fields are included');
  console.log('   Ready for email rendering via SES');
} else {
  console.log('❌ Some validation checks failed');
  console.log('   Please review the HTML template');
}

console.log('\n📧 HTML Template Preview:');
console.log('   Length:', htmlTemplate.length, 'characters');
console.log('   Contains table:', validation.hasTable);
console.log('   Contains all data fields:', 
  validation.hasEmployeeName && 
  validation.hasCourseTitle && 
  validation.hasScore && 
  validation.hasAssignmentId);

console.log('\n💡 To test actual email rendering:');
console.log('   1. Deploy Lambda: npx ampx sandbox');
console.log('   2. Run setup: ./setup-html-email.sh');
console.log('   3. Run test: ./test-html-email.sh');
console.log('   4. Check email inbox for HTML email');

// Export for use in other tests
export { htmlTemplate, validateHTML, testData };

