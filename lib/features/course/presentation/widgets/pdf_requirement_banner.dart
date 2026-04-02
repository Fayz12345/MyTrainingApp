import 'package:flutter/material.dart';
import '../../data/models/course_model.dart';

class PdfRequirementBanner extends StatelessWidget {
  final Course course;

  const PdfRequirementBanner({
    super.key,
    required this.course,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.orange[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.orange[300]!,
          width: 1.5,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.orange[100],
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.info_outline,
              size: 20,
              color: Colors.orange[800],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PDF Document Required',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.orange[900],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  course.pdfTitle != null
                      ? 'Please review "${course.pdfTitle}" before taking the quiz to ensure you have all the necessary information.'
                      : 'Please review the PDF document before taking the quiz to ensure you have all the necessary information.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.orange[800],
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

