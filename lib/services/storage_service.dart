import 'package:amplify_flutter/amplify_flutter.dart';

class StorageService {
  static Future<String> getVideoUrl(String videoKey) async {
    try {
      final result = await Amplify.Storage.getUrl(
        path: StoragePath.fromString(videoKey),
      );
      return (await result.result).url.toString();
    } catch (e) {
      safePrint('Error getting video URL: $e');
      rethrow;
    }
  }
}
