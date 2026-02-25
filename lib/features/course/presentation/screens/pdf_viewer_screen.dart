import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:open_filex/open_filex.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/services/storage_service.dart';
import '../../services/pdf_progress_service.dart';
import '../../../../core/services/activity_logger.dart';
import '../../data/models/course_model.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:go_router/go_router.dart';

class PdfViewerScreen extends StatefulWidget {
  final Course course;
  final VoidCallback? onPdfViewed;
  final Function(Course)?
      onPdfViewedAndReadyForQuiz; // Callback when PDF is viewed and ready for quiz

  const PdfViewerScreen({
    super.key,
    required this.course,
    this.onPdfViewed,
    this.onPdfViewedAndReadyForQuiz,
  });

  @override
  State<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends State<PdfViewerScreen> {
  PdfViewerController? _pdfViewerController;
  bool _isLoading = true;
  String? _pdfUrl;
  String? _pdfFilePath; // Store local file path for Syncfusion
  String? _errorMessage;
  bool _hasViewed = false;
  DateTime? _pdfViewStartTime; // Track when PDF viewing started
  int _totalPages = 0;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pdfViewStartTime = DateTime.now(); // Track when PDF viewing started
    _loadPdf();
    _checkViewStatus();
  }

  Future<void> _checkViewStatus() async {
    if (widget.course.assignmentId != null) {
      final progressKey = widget.course.assignmentId ?? widget.course.id;
      final viewed = await PdfProgressService.hasViewedPdf(progressKey);
      setState(() {
        _hasViewed = viewed;
      });
    }
  }

  Future<void> _loadPdf() async {
    if (widget.course.pdfKey == null) {
      setState(() {
        _errorMessage = 'PDF not available for this course';
        _isLoading = false;
      });
      return;
    }

    try {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      final pdfUrl = await StorageService.getPdfUrl(widget.course.pdfKey!);
      safePrint(
          '[PDF_VIEWER] Loading PDF from URL: ${pdfUrl.substring(0, pdfUrl.length > 100 ? 100 : pdfUrl.length)}...');

      // Download PDF to device local storage under app name folder
      safePrint('[PDF_VIEWER] Downloading PDF to local storage...');

      // Create Dio instance with timeout
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        responseType: ResponseType.bytes, // Get response as bytes
      ));

      final response = await dio.get(pdfUrl);

      if (response.statusCode != 200) {
        throw Exception('Failed to download PDF: HTTP ${response.statusCode}');
      }

      final pdfBytes = response.data as List<int>;
      safePrint(
          '[PDF_VIEWER] PDF downloaded successfully, size: ${pdfBytes.length} bytes');

      // Save to device local storage under app name folder
      // Use Documents directory for permanent storage (accessible on both Android and iOS)
      final directory = await getApplicationDocumentsDirectory();
      final appFolder = Directory('${directory.path}/MyTrainingApp/PDFs');
      if (!await appFolder.exists()) {
        await appFolder.create(recursive: true);
      }

      final sanitizedTitle = widget.course.pdfTitle
              ?.replaceAll(RegExp(r'[^\w\s-]'), '')
              .replaceAll(' ', '_') ??
          'course_${widget.course.id}';
      final fileName = '$sanitizedTitle.pdf';
      final filePath = '${appFolder.path}/$fileName';

      // Save file to permanent storage
      final file = File(filePath);
      await file.writeAsBytes(pdfBytes);

      safePrint('[PDF_VIEWER] PDF saved to local storage: $filePath');

      // Initialize Syncfusion PDF viewer controller
      final pdfViewerController = PdfViewerController();

      safePrint(
          '[PDF_VIEWER] Initializing Syncfusion PDF viewer with local file from: $filePath');

      // Mark as viewed when PDF is loaded and user has viewed it
      // Wait a bit to ensure user actually views the document
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted && _pdfViewerController != null) {
          _markAsViewed();
        }
      });

      setState(() {
        _pdfUrl = pdfUrl;
        _pdfFilePath = filePath;
        _pdfViewerController = pdfViewerController;
        _isLoading = false;
      });

      // Update current page periodically
      _updatePageNumber();
    } catch (e, stackTrace) {
      safePrint('[PDF_VIEWER] Error loading PDF: $e');
      safePrint('[PDF_VIEWER] Stack trace: $stackTrace');

      String errorMessage = 'Failed to load PDF';
      if (e.toString().contains('channel-error') ||
          e.toString().contains('Unable to establish connection')) {
        errorMessage =
            'PDF viewer initialization error. Please restart the app and try again.';
      } else if (e.toString().contains('timeout')) {
        errorMessage =
            'PDF loading timed out. Please check your internet connection.';
      } else {
        errorMessage =
            'Failed to load PDF: ${e.toString().replaceAll('Exception: ', '')}';
      }

      setState(() {
        _errorMessage = errorMessage;
        _isLoading = false;
      });
    }
  }

  void _updatePageNumber() {
    if (_pdfViewerController == null) return;

    // Periodically update page number
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && _pdfViewerController != null) {
        try {
          // Syncfusion provides page number and count through controller
          final pageNumber = _pdfViewerController!.pageNumber;
          final pageCount = _pdfViewerController!.pageCount;

          if (pageNumber != _currentPage ||
              (pageCount > 0 && _totalPages != pageCount)) {
            setState(() {
              _currentPage = pageNumber;
              if (pageCount > 0) {
                _totalPages = pageCount;
              }
            });
          }

          _updatePageNumber(); // Continue updating
        } catch (e) {
          // Controller might be disposed or not ready yet
        }
      }
    });
  }

  Future<void> _markAsViewed() async {
    if (_hasViewed) return;

    final progressKey = widget.course.assignmentId ?? widget.course.id;
    await PdfProgressService.markPdfViewed(progressKey);

    setState(() {
      _hasViewed = true;
    });

    // Log PDF completion
    if (widget.course.pdfKey != null) {
      // Calculate view duration (approximate - from when PDF was opened)
      final viewDuration = _pdfViewStartTime != null
          ? DateTime.now().difference(_pdfViewStartTime!).inSeconds
          : null;
      
      ActivityLogger.logPdfCompletion(
        courseId: widget.course.id,
        courseTitle: widget.course.title,
        pdfKey: widget.course.pdfKey!,
        assignmentId: widget.course.assignmentId,
        viewDurationSeconds: viewDuration,
      );
    }

    // Notify parent that PDF was viewed
    widget.onPdfViewed?.call();
  }

  /// Open PDF in device's native PDF viewer (downloads temporarily and opens)
  Future<void> _openPdfInExternalViewer() async {
    if (_pdfUrl == null) return;

    try {
      safePrint('[PDF_VIEWER] Opening PDF in device PDF viewer...');

      // Show loading indicator
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Opening PDF in device viewer...',
                    style: TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            backgroundColor: AppColors.primaryBlue,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 3),
          ),
        );
      }

      // No storage permission needed for app's documents directory
      // The app can write to its own documents directory without any permissions
      safePrint(
          '[PDF_VIEWER] Preparing to download and open PDF (no permissions needed for app documents)');

      // Download PDF to local storage using Dio
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        responseType: ResponseType.bytes,
      ));

      final response = await dio.get(_pdfUrl!);

      if (response.statusCode != 200) {
        throw Exception('Failed to download PDF: HTTP ${response.statusCode}');
      }

      final pdfBytes = response.data as List<int>;

      // Get Documents directory and create app folder
      final directory = await getApplicationDocumentsDirectory();
      final appFolder = Directory('${directory.path}/MyTrainingApp/PDFs');
      if (!await appFolder.exists()) {
        await appFolder.create(recursive: true);
      }

      // Create file in app folder
      final sanitizedTitle = widget.course.pdfTitle
              ?.replaceAll(RegExp(r'[^\w\s-]'), '')
              .replaceAll(' ', '_') ??
          'course_${widget.course.id}';
      final fileName = '$sanitizedTitle.pdf';
      final filePath = '${appFolder.path}/$fileName';

      // Save file to local storage
      final file = File(filePath);
      await file.writeAsBytes(pdfBytes);

      safePrint(
          '[PDF_VIEWER] PDF saved to local storage, opening in device viewer...');

      // Mark as viewed when opening in external viewer
      await _markAsViewed();

      // Open file with device's native PDF viewer
      final result = await OpenFilex.open(filePath);

      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();

        if (result.type == ResultType.done) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.white, size: 20),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'PDF opened in device viewer',
                      style: TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
              backgroundColor: Colors.green[600],
              behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.all(16),
              duration: const Duration(seconds: 2),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: Colors.white, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Failed to open PDF: ${result.message}',
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
              backgroundColor: Colors.red[600],
              behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.all(16),
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      safePrint('[PDF_VIEWER] Error opening PDF in device viewer: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Failed to open PDF in device viewer. Please try again.',
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.red[600],
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Retry',
              textColor: Colors.white,
              onPressed: _openPdfInExternalViewer,
            ),
          ),
        );
      }
    }
  }

  Future<void> _downloadAndOpenPdf() async {
    if (widget.course.pdfKey == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('PDF not available for download'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    try {
      // No storage permission needed for app's documents directory
      // The app can write to its own documents directory without permissions
      safePrint(
          '[PDF_VIEWER] Preparing to download PDF (no permissions needed)');

      // Show loading indicator
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Downloading PDF document...',
                    style: TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            backgroundColor: AppColors.primaryBlue,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 3),
          ),
        );
      }

      // Regenerate PDF URL to get a fresh pre-signed URL (prevents expiration issues)
      safePrint('[PDF_VIEWER] Generating fresh PDF URL for download...');
      final pdfUrl = await StorageService.getPdfUrl(widget.course.pdfKey!);
      safePrint('[PDF_VIEWER] Fresh PDF URL generated, starting download...');

      // Download PDF using Dio
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        responseType: ResponseType.bytes,
        validateStatus: (status) {
          // Don't throw for 400/403, we'll handle it
          return status! < 500;
        },
      ));

      final response = await dio.get(pdfUrl);

      // Handle different response status codes
      if (response.statusCode == 200) {
        final pdfBytes = response.data as List<int>;

        // Get download directory - use Documents directory with app name folder
        final directory = await getApplicationDocumentsDirectory();
        final appFolder = Directory('${directory.path}/MyTrainingApp/PDFs');
        if (!await appFolder.exists()) {
          await appFolder.create(recursive: true);
        }

        // Sanitize filename
        final sanitizedTitle = widget.course.pdfTitle
                ?.replaceAll(RegExp(r'[^\w\s-]'), '')
                .replaceAll(' ', '_') ??
            'course_${widget.course.id}';
        final fileName = '$sanitizedTitle.pdf';
        final filePath = '${appFolder.path}/$fileName';

        // Save file
        final file = File(filePath);
        await file.writeAsBytes(pdfBytes);

        safePrint('[PDF_VIEWER] PDF saved to: $filePath');

        // Mark as viewed when downloading and opening
        await _markAsViewed();

        // Open file with external viewer
        final result = await OpenFilex.open(filePath);

        if (mounted) {
          if (result.type == ResultType.done) {
            // Show file location info
            final fileLocation = Platform.isAndroid
                ? 'Internal Storage/Android/data/com.mytrainingapp/files/Documents/MyTrainingApp/PDFs'
                : 'Files app > MyTrainingApp > PDFs';

            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle,
                            color: Colors.white, size: 20),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'PDF downloaded successfully!',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Location: $fileLocation',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.white70,
                      ),
                    ),
                    Text(
                      'File: $fileName',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
                backgroundColor: Colors.green[600],
                behavior: SnackBarBehavior.floating,
                margin: const EdgeInsets.all(16),
                duration: const Duration(seconds: 5),
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: Colors.white, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Failed to open PDF: ${result.message}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
                backgroundColor: Colors.red[600],
                behavior: SnackBarBehavior.floating,
                margin: const EdgeInsets.all(16),
                duration: const Duration(seconds: 4),
              ),
            );
          }
        }
      } else if (response.statusCode == 400 || response.statusCode == 403) {
        // URL expired or invalid - try regenerating
        safePrint(
            '[PDF_VIEWER] URL expired or invalid (${response.statusCode}), regenerating...');
        throw Exception('PDF download link expired. Please try again.');
      } else {
        throw Exception('Failed to download PDF: HTTP ${response.statusCode}');
      }
    } catch (e) {
      safePrint('Error downloading PDF: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    e.toString().contains('expired')
                        ? 'PDF download link expired. Please try again.'
                        : 'Failed to download PDF. Please check your internet connection and try again.',
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.red[600],
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Retry',
              textColor: Colors.white,
              onPressed: _downloadAndOpenPdf,
            ),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _pdfViewerController?.dispose();
    super.dispose();
  }

  /// Show confirmation dialog when user tries to go back
  /// Only shows dialog if course is not completed
  /// If course is completed, allows direct back navigation
  Future<bool> _onWillPop() async {
    // Check if course is already completed
    // If completed, allow direct back navigation without showing dialog
    final bool isCourseCompleted =
        widget.course.assignmentStatus == 'completed';

    if (isCourseCompleted) {
      // Course is completed, allow direct back navigation
      safePrint(
          '[PDF_VIEWER] Course is completed, allowing direct back navigation');
      return true;
    }

    // Course is not completed, show confirmation dialog
    safePrint('[PDF_VIEWER] Course not completed, showing confirmation dialog');
    final result = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.picture_as_pdf,
                  color: AppColors.primaryBlue,
                  size: 32,
                ),
              ),
              const SizedBox(height: 20),
              // Title
              Text(
                'Are you done learning?',
                style: TextStyle(
                  fontSize:
                      20 * AppTheme.getDimensions(context).textScaleFactor,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textBlack87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              // Message
              Text(
                'Have you finished viewing the PDF document?',
                style: TextStyle(
                  fontSize:
                      15 * AppTheme.getDimensions(context).textScaleFactor,
                  color: Colors.grey[700],
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Buttons
              Row(
                children: [
                  // No button
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.grey[700],
                        side: BorderSide(color: Colors.grey[300]!, width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'No, Continue',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Yes button
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryBlue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Yes, Done',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (result == true) {
      // Mark PDF as viewed
      await _markAsViewed();

      // If callback is provided, use it to handle quiz start (updates progress first)
      if (widget.onPdfViewedAndReadyForQuiz != null && mounted) {
        widget.onPdfViewedAndReadyForQuiz!(widget.course);
        return true; // Pop back to course list, callback will handle quiz
      }

      // Fallback: Navigate to quiz directly if no callback (for backward compatibility)
      if (widget.course.assignmentId != null && mounted) {
        context.push(
          '/quiz',
          extra: {
            'course': widget.course,
            'assignmentId': widget.course.assignmentId!,
            'source': 'pdf_viewer',
          },
        );
        return false; // Don't pop, we're navigating to quiz
      }
    }

    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final dims = AppTheme.getDimensions(context);

    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (!didPop) {
          final shouldPop = await _onWillPop();
          if (shouldPop && mounted) {
            Navigator.of(context).pop();
          }
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: AppColors.textBlack87),
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && mounted) {
                Navigator.of(context).pop();
              }
            },
            tooltip: 'Back',
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.course.pdfTitle ?? widget.course.title,
                style: TextStyle(
                  fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textBlack87,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (_totalPages > 0)
                Text(
                  'Page ${_currentPage + 1} of $_totalPages',
                  style: TextStyle(
                    fontSize: (dims.isTablet ? 12 : 11) * dims.textScaleFactor,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),
          actions: [
            if (_pdfUrl != null && !_isLoading) ...[
              // Open in external viewer button
              Tooltip(
                message: 'Open PDF in external viewer',
                child: IconButton(
                  icon: const Icon(Icons.open_in_new,
                      color: AppColors.primaryBlue),
                  onPressed: _openPdfInExternalViewer,
                ),
              ),
              // Download button
              Tooltip(
                message: 'Download and open PDF in external viewer',
                child: IconButton(
                  icon:
                      const Icon(Icons.download, color: AppColors.primaryBlue),
                  onPressed: _downloadAndOpenPdf,
                ),
              ),
            ],
          ],
        ),
        body: _buildBody(dims),
      ),
    );
  }

  Widget _buildBody(ResponsiveDimensions dims) {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primaryBlue),
            ),
            const SizedBox(height: 24),
            Text(
              'Loading PDF Document...',
              style: TextStyle(
                fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
                color: Colors.grey[700],
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Please wait while we prepare the document',
              style: TextStyle(
                fontSize: (dims.isTablet ? 14 : 12) * dims.textScaleFactor,
                color: Colors.grey[500],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(dims.isTablet ? 32.0 : 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Colors.red[400],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Unable to Load PDF',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 22 : 20) * dims.textScaleFactor,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: TextStyle(
                  fontSize: (dims.isTablet ? 16 : 14) * dims.textScaleFactor,
                  color: Colors.grey[600],
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _loadPdf,
                  icon: const Icon(Icons.refresh, size: 20),
                  label: const Text(
                    'Try Again',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryBlue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_pdfFilePath == null || _pdfViewerController == null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(dims.isTablet ? 32.0 : 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.picture_as_pdf_outlined,
                size: 64,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 16),
              Text(
                'PDF Document Not Available',
                style: TextStyle(
                  fontSize: (dims.isTablet ? 18 : 16) * dims.textScaleFactor,
                  color: Colors.grey[700],
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      children: [
        // Syncfusion PDF Viewer - Load from local file (most reliable method)
        SfPdfViewer.file(
          File(_pdfFilePath!),
          controller: _pdfViewerController!,
          onDocumentLoaded: (PdfDocumentLoadedDetails details) {
            // Update total pages when document loads
            if (mounted) {
              setState(() {
                _totalPages = details.document.pages.count;
              });
            }
            safePrint(
                '[PDF_VIEWER] ✅ PDF document loaded successfully: $_totalPages pages');
          },
          onDocumentLoadFailed: (PdfDocumentLoadFailedDetails details) {
            // Handle PDF load failure
            safePrint('[PDF_VIEWER] ❌ PDF load failed: ${details.error}');
            safePrint('[PDF_VIEWER] Error description: ${details.description}');
            if (mounted) {
              setState(() {
                final errorDesc = details.description;
                final errorMsg = details.error;
                _errorMessage = errorDesc.isNotEmpty
                    ? 'Failed to load PDF: $errorDesc'
                    : 'Failed to load PDF: $errorMsg';
                _isLoading = false;
              });
            }
          },
          onPageChanged: (PdfPageChangedDetails details) {
            // Update current page when user navigates
            if (mounted) {
              setState(() {
                _currentPage = details.newPageNumber;
              });
            }
          },
          enableDoubleTapZooming: true,
          enableTextSelection: true,
          canShowScrollHead: true,
          canShowScrollStatus: true,
          canShowPaginationDialog: true,
          enableDocumentLinkAnnotation: true,
          enableHyperlinkNavigation: true,
        ),
        // View status indicator - shows when PDF is being viewed for the first time
        if (!_hasViewed)
          Positioned(
            top: 16,
            right: 16,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primaryBlue.withOpacity(0.95),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.visibility, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Viewing Document',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        // Success indicator when PDF is viewed
        if (_hasViewed)
          Positioned(
            top: 16,
            right: 16,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.95),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Viewed',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
