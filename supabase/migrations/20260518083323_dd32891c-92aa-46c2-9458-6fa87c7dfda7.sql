
DELETE FROM meeting_participants WHERE meeting_id IN ('3978785b-a9fb-475a-9572-b1578ef354fa','6d8342ca-6a0e-4179-8957-537cb8108944');
UPDATE project_recurring_occurrences SET linked_meeting_id = NULL WHERE linked_meeting_id IN ('3978785b-a9fb-475a-9572-b1578ef354fa','6d8342ca-6a0e-4179-8957-537cb8108944');
DELETE FROM project_recurring_occurrences WHERE linked_meeting_id IS NULL AND item_type='reuniao' AND scheduled_date = CURRENT_DATE AND project_id IN ('d27dd6ad-ab6a-4140-a365-aedebbcba00d','605ff99a-4372-4514-90c6-54668cadb62b');
DELETE FROM meetings WHERE id IN ('3978785b-a9fb-475a-9572-b1578ef354fa','6d8342ca-6a0e-4179-8957-537cb8108944');
