import '../../services/pdf_progress_service.dart';
import '../../data/models/course_model.dart';

/// Helper class for PDF-related operations
/// Provides clean separation of concerns for PDF viewing logic
class PdfViewerHelper {
  /// Check if PDF must be viewed before quiz can be taken
  /// PDF is mandatory only when there's no video (Case 2: PDF + Quiz)
  /// PDF is optional when video exists (Case 3: Video + PDF + Quiz)
  static Future<bool> mustViewPdfBeforeQuiz(Course course) async {
    if (!course.hasPdf) return false;

    // If course has video, PDF is optional (not mandatory)
    if (course.hasVideo) return false;

    // If course has no video, PDF is mandatory
    final progressKey = course.assignmentId ?? course.id;
    final hasViewedPdf = await PdfProgressService.hasViewedPdf(progressKey);
    return !hasViewedPdf;
  }

  /// Get user-friendly message for PDF requirement
  static String getPdfRequirementMessage(Course course) {
    if (course.pdfTitle != null) {
      return 'Please review the PDF document "${course.pdfTitle}" before taking the quiz.';
    }
    return 'Please review the PDF document before taking the quiz.';
  }

  /// Get detailed explanation for PDF requirement
  static String getPdfRequirementExplanation() {
    return 'This ensures you have all the necessary information to complete the quiz successfully.';
  }
}
