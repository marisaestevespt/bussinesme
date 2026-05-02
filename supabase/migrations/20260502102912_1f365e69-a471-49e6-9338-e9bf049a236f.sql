-- 1) Apagar entrega "Reunião inicial" duplicada na fase Onboarding (ficou do template antigo)
DELETE FROM project_deliverables
WHERE id = 'aef6dd92-d0b7-4a7f-89bb-bc8df923373b';

-- 2) Ligar a entrega "Reunião inicial" da fase Diagnóstico à reunião confirmada
UPDATE project_deliverables
SET meeting_id = '4ce07041-4862-487c-aa85-aacde26e2d4e'
WHERE project_id = '21ccda99-d6b5-4db6-a654-07ef4e1c6ecd'
  AND phase_id = '00015a42-ae74-4b41-9b72-40c400694f46'
  AND is_meeting = true
  AND name = 'Reunião inicial';