-- Reviewer decisions extend the author-only lesson-note state machine.
-- Approval is not publication. Existing rows and history are preserved.
ALTER TYPE "LessonNoteStatus" ADD VALUE 'APPROVED';
ALTER TYPE "LessonNoteStatus" ADD VALUE 'RETURNED';
ALTER TYPE "LessonNoteEventType" ADD VALUE 'APPROVED';
ALTER TYPE "LessonNoteEventType" ADD VALUE 'RETURNED';

