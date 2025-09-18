import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import Video from 'react-native-video';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../amplify/data/resource';

type Props = {
  course: Schema['Course']['type'];
  onVideoComplete: () => void;
  onClose: () => void;
};

const { width, height } = Dimensions.get('window');

export function VideoPlayerScreen({ course, onVideoComplete, onClose }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const videoRef = useRef<Video>(null);

  React.useEffect(() => {
    const loadVideo = async () => {
      if (!course.videoKey) {
        setError('No video available for this course');
        setLoading(false);
        return;
      }

      try {
        // Get the video URL from AWS S3
        const result = await getUrl({
          path: course.videoKey,
        });
        
        setVideoUrl(result.url.toString());
        setLoading(false);
      } catch (err) {
        console.error('Error loading video:', err);
        setError('Failed to load video');
        setLoading(false);
      }
    };

    loadVideo();
  }, [course.videoKey]);

  const handleVideoEnd = () => {
    setCompleted(true);
    Alert.alert(
      'Video Complete!',
      'You have finished watching the training video. Ready to take the quiz?',
      [
        { text: 'Watch Again', onPress: () => {
          setCurrentTime(0);
          setCompleted(false);
          videoRef.current?.seek(0);
        }},
        { text: 'Take Quiz', onPress: onVideoComplete }
      ]
    );
  };

  const handleProgress = (data: any) => {
    setCurrentTime(data.currentTime);
    
    // Mark as completed if watched at least 90% of the video
    if (data.currentTime / duration > 0.9 && !completed) {
      setCompleted(true);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  if (error || !videoUrl) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Video not available'}</Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{course.title}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Video Player */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          controls={true}
          paused={paused}
          onEnd={handleVideoEnd}
          onProgress={handleProgress}
          onLoad={(data) => setDuration(data.duration)}
          onError={(error) => {
            console.error('Video error:', error);
            setError('Failed to play video');
          }}
          resizeMode="contain"
        />
      </View>

      {/* Progress Info */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
        {completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Completed</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setPaused(!paused)}
        >
          <Text style={styles.controlButtonText}>
            {paused ? '▶️ Play' : '⏸️ Pause'}
          </Text>
        </TouchableOpacity>

        {completed && (
          <TouchableOpacity
            style={[styles.controlButton, styles.quizButton]}
            onPress={onVideoComplete}
          >
            <Text style={styles.quizButtonText}>Take Quiz</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 34, // Same width as close button for centering
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: width * (9/16), // 16:9 aspect ratio
    maxHeight: height * 0.6,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
  },
  completedBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  controlButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quizButton: {
    backgroundColor: '#007AFF',
  },
  quizButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});