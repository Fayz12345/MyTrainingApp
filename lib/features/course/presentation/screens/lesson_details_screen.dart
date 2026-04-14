import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../data/models/course_model.dart';
import '../bloc/lesson_details/lesson_details_bloc.dart';

class LessonDetailsScreen extends StatelessWidget {
  const LessonDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<LessonDetailsBloc, LessonDetailsState>(
      builder: (context, state) {
        if (state is LessonDetailsLoading) {
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              elevation: 0,
              backgroundColor: Colors.white,
              foregroundColor: AppColors.textBlack87,
              title: const Text('Lesson'),
            ),
            body: const Center(child: CircularProgressIndicator()),
          );
        }
        if (state is LessonDetailsLoadError) {
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              elevation: 0,
              backgroundColor: Colors.white,
              foregroundColor: AppColors.textBlack87,
              title: const Text('Lesson'),
            ),
            body: Center(child: Text(state.message)),
          );
        }
        if (state is LessonDetailsReady) {
          return _LessonDetailsBody(ready: state);
        }
        return const SizedBox.shrink();
      },
    );
  }
}

class _LessonDetailsBody extends StatefulWidget {
  const _LessonDetailsBody({required this.ready});

  final LessonDetailsReady ready;

  @override
  State<_LessonDetailsBody> createState() => _LessonDetailsBodyState();
}

class _LessonDetailsBodyState extends State<_LessonDetailsBody> {
  ScrollController? _textScrollController;
  bool _textEngagementFired = false;
  int _layoutRetries = 0;

  LessonDetailsReady get ready => widget.ready;

  bool get _shouldTrackTextScroll =>
      ready.isTextOnlyLessonContent &&
      ready.blocks.isNotEmpty &&
      !ready.lessonPersistedComplete;

  bool _hasValidKey(dynamic key) =>
      key != null &&
      key.toString().trim().isNotEmpty &&
      key.toString() != 'null';

  Course _courseWithOverride(
    Course original, {
    String? videoKey,
    String? pdfKey,
    String? pdfTitle,
  }) {
    return Course(
      id: original.id,
      title: original.title,
      videoKey: videoKey ?? original.videoKey,
      imageKey: original.imageKey,
      description: original.description,
      passingScore: original.passingScore,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      duration: original.duration,
      category: original.category,
      tag: original.tag,
      assignmentStatus: original.assignmentStatus,
      assignmentId: original.assignmentId,
      assignmentUpdatedAt: original.assignmentUpdatedAt,
      pdfKey: pdfKey ?? original.pdfKey,
      pdfTitle: pdfTitle ?? original.pdfTitle,
      contentType: original.contentType,
      randomizeQuestions: original.randomizeQuestions,
      randomizeOptions: original.randomizeOptions,
      useQuestionPool: original.useQuestionPool,
      poolSize: original.poolSize,
      questionsToDisplay: original.questionsToDisplay,
      lessons: original.lessons,
    );
  }

  @override
  void initState() {
    super.initState();
    _ensureTextScrollTracking();
  }

  @override
  void didUpdateWidget(covariant _LessonDetailsBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.ready.lesson.id != oldWidget.ready.lesson.id) {
      _textEngagementFired = false;
      _layoutRetries = 0;
      _disposeTextScrollController();
    }
    _ensureTextScrollTracking();
  }

  @override
  void dispose() {
    _disposeTextScrollController();
    super.dispose();
  }

  void _disposeTextScrollController() {
    if (_textScrollController == null) return;
    _textScrollController!.removeListener(_onTextScroll);
    _textScrollController!.dispose();
    _textScrollController = null;
  }

  void _ensureTextScrollTracking() {
    if (!_shouldTrackTextScroll) {
      _disposeTextScrollController();
      return;
    }
    if (_textScrollController != null) return;
    _textScrollController = ScrollController();
    _textScrollController!.addListener(_onTextScroll);
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _checkTextOnlyFitsOnScreen());
  }

  static const double _textScrollBottomSlack = 48;

  void _checkTextOnlyFitsOnScreen() {
    if (!mounted || _textEngagementFired || !_shouldTrackTextScroll) return;
    final c = _textScrollController;
    if (c == null) return;
    if (!c.hasClients) {
      _layoutRetries++;
      if (_layoutRetries > 24) return;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _checkTextOnlyFitsOnScreen());
      return;
    }
    _layoutRetries = 0;
    if (c.position.maxScrollExtent <= _textScrollBottomSlack) {
      _fireTextOnlyEngagement();
    }
  }

  void _onTextScroll() {
    if (_textEngagementFired || !_shouldTrackTextScroll) return;
    final c = _textScrollController;
    if (c == null || !c.hasClients) return;
    if (c.position.pixels >=
        c.position.maxScrollExtent - _textScrollBottomSlack) {
      _fireTextOnlyEngagement();
    }
  }

  void _fireTextOnlyEngagement() {
    if (_textEngagementFired) return;
    _textEngagementFired = true;
    context.read<LessonDetailsBloc>().add(const LessonTextOnlyEngaged());
  }

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<LessonDetailsBloc>();
    final content = ready.blocks.isEmpty
        ? const Center(
            child: Text(
              'No content available for this lesson.',
              style: TextStyle(color: Colors.grey, fontSize: 16),
            ),
          )
        : ListView.builder(
            controller:
                _shouldTrackTextScroll ? _textScrollController : null,
            padding: const EdgeInsets.all(20.0),
            itemCount: ready.blocks.length,
            itemBuilder: (context, index) {
              return _buildBlock(context, bloc, ready.blocks[index], index);
            },
          );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        final s = bloc.state;
        final needRefresh =
            s is LessonDetailsReady && s.pathProgressChangedThisSession;
        context.pop(needRefresh);
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              final s = bloc.state;
              final needRefresh =
                  s is LessonDetailsReady && s.pathProgressChangedThisSession;
              context.pop(needRefresh);
            },
          ),
          title: Text(ready.lesson.title),
          elevation: 0,
          backgroundColor: Colors.white,
          foregroundColor: AppColors.textBlack87,
        ),
        body: Column(
          children: [
            Expanded(child: content),
            if (ready.course.lessons.isNotEmpty)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  child: Builder(
                    builder: (context) {
                      final already = ready.lessonPersistedComplete;
                      final courseAssignmentCompleted = ready.course.assignmentStatus == 'completed';
                      final showCompletedBanner = already || courseAssignmentCompleted;
                      print('showCompletedBanner $showCompletedBanner');
                      final required = ready.requiredItemCount;
                      final completed = ready.completedItemCount;
                      final progressText = required == 0
                          ? (ready.isTextOnlyLessonContent
                              ? 'Scroll to the bottom to complete. If it fits on screen, it completes automatically.'
                              : ready.blocks.isEmpty
                                  ? 'No content in this lesson.'
                                  : 'No trackable content in this lesson.')
                          : '$completed / $required items completed';
                      final pendingIcon = required == 0 &&
                              ready.isTextOnlyLessonContent
                          ? Icons.menu_book_outlined
                          : Icons.hourglass_top;
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: showCompletedBanner
                              ? Colors.green.withOpacity(0.1)
                              : AppColors.primaryBlue.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: showCompletedBanner
                                ? Colors.green.withOpacity(0.35)
                                : AppColors.primaryBlue.withOpacity(0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              showCompletedBanner
                                  ? Icons.check_circle
                                  : pendingIcon,
                              color: showCompletedBanner
                                  ? Colors.green
                                  : AppColors.primaryBlue,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                showCompletedBanner
                                    ? 'Lesson completed'
                                    : (required == 0 &&
                                            ready.isTextOnlyLessonContent)
                                        ? progressText
                                        : 'Auto progress: $progressText',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: showCompletedBanner
                                      ? Colors.green[700]
                                      : AppColors.primaryBlue,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// First `text` block in the lesson is treated as a section title; later text
  /// blocks use body / description styling (paragraphs + lists).
  Map<String, Style> _lessonTextHtmlStyles({required bool isHeader}) {
    if (isHeader) {
      return {
        'body': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
          color: AppColors.textBlack87,
          fontSize: FontSize(22),
          fontWeight: FontWeight.w700,
          lineHeight: const LineHeight(1.3),
        ),
        'p': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
        ),
        'strong': Style(
          fontWeight: FontWeight.w800,
          color: AppColors.textBlack87,
        ),
      };
    }
    return {
      'body': Style(
        margin: Margins.zero,
        padding: HtmlPaddings.zero,
        color: const Color(0xFF5C5C5C),
        fontSize: FontSize(16),
        lineHeight: const LineHeight(1.55),
      ),
      'p': Style(
        margin: Margins.only(bottom: 12),
      ),
      'ul': Style(
        margin: Margins.only(bottom: 12, top: 4),
        padding: HtmlPaddings.only(left: 20),
      ),
      'li': Style(
        margin: Margins.only(bottom: 10),
        padding: HtmlPaddings.zero,
      ),
      'strong': Style(
        fontWeight: FontWeight.w700,
        color: AppColors.textBlack87,
      ),
    };
  }

  Widget _buildBlock(
    BuildContext context,
    LessonDetailsBloc bloc,
    Map<String, dynamic> block,
    int blockIndex,
  ) {
    final type = block['type'];
    switch (type) {
      case 'text':
        final contentHtml = block['contentHtml'] ?? '';
        final htmlString = contentHtml.toString().trim();
        if (htmlString.isEmpty) return const SizedBox.shrink();
        var priorTextBlocks = 0;
        for (var i = 0; i < blockIndex; i++) {
          if (ready.blocks[i]['type'] == 'text') priorTextBlocks++;
        }
        final isFirstTextBlock = priorTextBlocks == 0;
        return Padding(
          padding: EdgeInsets.only(bottom: isFirstTextBlock ? 16.0 : 24.0),
          child: Html(
            data: htmlString,
            style: _lessonTextHtmlStyles(isHeader: isFirstTextBlock),
          ),
        );

      case 'image':
        final key = block['key'];
        if (!_hasValidKey(key)) return const SizedBox.shrink();
        final imageKey = key.toString();
        return Padding(
          padding: const EdgeInsets.only(bottom: 24.0),
          child: FutureBuilder<String>(
            key: ValueKey<String>(imageKey),
            future: bloc.getCachedImageUrl(imageKey),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.grey(200),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.grey(200),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child:
                        Icon(Icons.broken_image, size: 50, color: Colors.grey),
                  ),
                );
              }
              return ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  snapshot.data!,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 200,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppColors.grey(200),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Icon(Icons.broken_image,
                            size: 50, color: Colors.grey),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        );

      case 'video':
        final key = block['key'];
        if (!_hasValidKey(key)) return const SizedBox.shrink();
        final videoKey = key.toString();
        return Padding(
          padding: const EdgeInsets.only(bottom: 24.0),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryBlue.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primaryBlue.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlue.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.play_circle_fill,
                          color: AppColors.primaryBlue),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Video Lesson',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final updatedCourse = _courseWithOverride(
                        ready.course,
                        videoKey: videoKey,
                      );
                      final completed = await context.push<bool>(
                        '/lesson-video-player',
                        extra: {
                          'course': updatedCourse,
                          'lesson': ready.lesson,
                          'videoKey': videoKey,
                        },
                      );
                      if (completed == true && context.mounted) {
                        context
                            .read<LessonDetailsBloc>()
                            .add(const LessonVideoMarkedWatched());
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryBlue,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Play Video',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );

      case 'pdf':
        final key = block['key'];
        final title = block['title'] ?? 'PDF Document';
        if (!_hasValidKey(key)) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 24.0),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.red.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.red.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child:
                          const Icon(Icons.picture_as_pdf, color: Colors.red),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Document',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final lessonBloc = context.read<LessonDetailsBloc>();
                      final updatedCourse = _courseWithOverride(
                        ready.course,
                        pdfKey: key,
                        pdfTitle: title,
                      );
                      await context.push(
                        '/pdf-viewer',
                        extra: {
                          'course': updatedCourse,
                          'onPdfViewed': () {
                            lessonBloc.add(const LessonPdfMarkedViewed());
                          },
                        },
                      );
                      if (!context.mounted) return;
                      lessonBloc.add(const LessonPdfSyncFromStorage());
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red[600],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('View PDF',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        );

      default:
        return const SizedBox.shrink();
    }
  }
}

