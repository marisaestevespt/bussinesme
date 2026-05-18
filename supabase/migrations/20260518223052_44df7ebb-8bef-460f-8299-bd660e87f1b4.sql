UPDATE portal_initial_questions
SET answer = '(respondido offline — fora do portal)',
    answered_at = now()
WHERE portal_id = 'a923bc46-eaa3-4889-8dff-4955ede76e88'
  AND (answer IS NULL OR answer = '');