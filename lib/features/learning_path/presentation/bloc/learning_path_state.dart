part of 'learning_path_bloc.dart';

abstract class LearningPathState extends BaseState {
  const LearningPathState();
}

class LearningPathInitial extends LearningPathState {
  const LearningPathInitial();
}

class LearningPathLoading extends LearningPathState {
  const LearningPathLoading();
}

class LearningPathLoaded extends LearningPathState {
  final List<LearningPath> paths;

  const LearningPathLoaded(this.paths);

  @override
  List<Object?> get props => [paths];
}

class LearningPathError extends LearningPathState {
  final String message;

  const LearningPathError(this.message);

  @override
  List<Object?> get props => [message];
}
