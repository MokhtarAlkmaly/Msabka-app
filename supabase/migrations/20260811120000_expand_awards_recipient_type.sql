ALTER TABLE public.awards
DROP CONSTRAINT IF EXISTS awards_recipient_type_check;

ALTER TABLE public.awards
ADD CONSTRAINT awards_recipient_type_check
CHECK (
  recipient_type IN (
    'teacher',
    'male_teacher',
    'student',
    'male_student',
    'orphan',
    'needy',
    'other'
  )
);
