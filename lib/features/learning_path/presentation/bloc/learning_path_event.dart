part of 'learning_path_bloc.dart';

abstract class LearningPathEvent extends BaseEvent {
  const LearningPathEvent();
}

class LoadLearningPaths extends LearningPathEvent {
  const LoadLearningPaths();
}

class RefreshLearningPaths extends LearningPathEvent {
  const RefreshLearningPaths();
}

class LoadActiveLearningPaths extends LearningPathEvent {
  const LoadActiveLearningPaths();
}

class LoadCompletedLearningPaths extends LearningPathEvent {
  const LoadCompletedLearningPaths();
}
