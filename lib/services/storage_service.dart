import 'package:amplify_flutter/amplify_flutter.dart';

class StorageService {
  // S3 Base URL (from your bucket configuration)
  // Bucket: amplify-d6c38s8spsb1t-dev-trainingvideosbucket4095-0cjy2dj0frgb
  // Region: ca-central-1
  static const String _s3BaseUrl =
      'https://amplify-d6c38s8spsb1t-dev-trainingvideosbucket4095-0cjy2dj0frgb.s3.ca-central-1.amazonaws.com';

  /// Gets a pre-signed URL for a video file from S3
  /// This generates a complete URL with authentication that expires after ~15 minutes
  static Future<String> getVideoUrl(String videoKey) async {
    try {
      final result = await Amplify.Storage.getUrl(
        path: StoragePath.fromString(videoKey),
      );
      final url = (await result.result).url.toString();
      safePrint('📹 Video URL generated for key: $videoKey');
      safePrint('📹 Complete URL: $url');
      return url;
    } catch (e) {
      safePrint('Error getting video URL: $e');
      rethrow;
    }
  }

  /// Gets a pre-signed URL for an image file from S3
  /// This generates a complete URL with authentication that expires after ~15 minutes
  ///
  /// Example:
  /// - imageKey: "courses/images/1764659469407_natureImage.jpeg"
  /// - Returns: "https://bucket.s3.region.amazonaws.com/courses/images/...?X-Amz-..."
  static Future<String> getImageUrl(String imageKey) async {
    try {
      final result = await Amplify.Storage.getUrl(
        path: StoragePath.fromString(imageKey),
      );
      final url = (await result.result).url.toString();
      safePrint('🖼️ Image URL generated for key: $imageKey');
      safePrint('🖼️ Complete URL: $url');
      return url;
    } catch (e) {
      safePrint('Error getting image URL: $e');
      rethrow;
    }
  }

  /// Gets the S3 base URL pattern (for reference only)
  /// Note: This alone won't work - you need authentication via getImageUrl() or getVideoUrl()
  static String getBaseUrl() {
    return _s3BaseUrl;
  }

  /// Constructs the S3 URL path (without authentication)
  /// Note: This won't work directly - you need to use getImageUrl() or getVideoUrl() for authenticated URLs
  /// This is just for reference/logging purposes
  static String getS3PathUrl(String key) {
    return '$_s3BaseUrl/$key';
  }
}
