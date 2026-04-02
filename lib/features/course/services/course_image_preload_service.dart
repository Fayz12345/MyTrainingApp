import 'package:flutter/material.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

import '../../../../core/services/storage_service.dart';
import '../data/models/course_model.dart';

/// Fetches image URLs and precaches network images for assigned courses.
class CourseImagePreloadService {
  CourseImagePreloadService._();

  static Future<void> preloadForCourses({
    required List<Course> courses,
    required Map<String, String> imageUrlCache,
    required BuildContext context,
    required bool Function() isMounted,
    required void Function(VoidCallback fn) scheduleSetState,
  }) async {
    final imagesToLoad = courses
        .where(
          (c) =>
              c.imageKey != null && !imageUrlCache.containsKey(c.imageKey),
        )
        .toList();

    if (imagesToLoad.isEmpty) return;
    if (!isMounted()) return;

    final urlFutures = <Future<MapEntry<String, String>?>>[];
    for (final course in imagesToLoad) {
      urlFutures.add(
        StorageService.getImageUrl(course.imageKey!)
            .then<MapEntry<String, String>?>(
              (url) => MapEntry(course.imageKey!, url),
            )
            .catchError((e) {
          safePrint('Error getting image URL for ${course.title}: $e');
          return null;
        }),
      );
    }

    try {
      final urlResults = await Future.wait(urlFutures)
          .timeout(const Duration(seconds: 30));

      final urlCacheUpdates = <String, String>{};
      for (final result in urlResults) {
        if (result != null) {
          urlCacheUpdates[result.key] = result.value;
        }
      }

      if (isMounted() && urlCacheUpdates.isNotEmpty) {
        scheduleSetState(() {
          imageUrlCache.addAll(urlCacheUpdates);
        });
      }

      if (isMounted()) {
        final precacheFutures = <Future<void>>[];
        for (final entry in urlCacheUpdates.entries) {
          precacheFutures.add(
            precacheImage(NetworkImage(entry.value), context).catchError((e) {
              safePrint('Error precaching image ${entry.key}: $e');
            }),
          );
        }

        try {
          await Future.wait(precacheFutures)
              .timeout(const Duration(seconds: 30));
          safePrint(
            '✅ Precached ${precacheFutures.length} course images',
          );
        } catch (e) {
          if (e.toString().contains('TimeoutException') ||
              e.toString().contains('timeout')) {
            safePrint('Image precaching timed out');
          } else {
            safePrint('Error during image precaching: $e');
          }
        }
      }
    } catch (e) {
      if (e.toString().contains('TimeoutException') ||
          e.toString().contains('timeout')) {
        safePrint('Image URL fetching timed out');
      } else {
        safePrint('Error during image URL fetching: $e');
      }
    }
  }
}
