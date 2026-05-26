-- Revoke public/anon EXECUTE on internal SECURITY DEFINER trigger & helper functions.
-- Triggers continue to fire (they run as the definer regardless of EXECUTE grants).
-- This addresses the 15 "Public Can Execute SECURITY DEFINER Function" linter warnings.

REVOKE EXECUTE ON FUNCTION public.ensure_meeting_creator_participant() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fill_sale_client_id_from_project() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_client_renegotiation_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_id_from_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_id_from_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_team_member_self_privilege_escalation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_kpr_monthly_to_planning_goal() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meeting_client_name() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meeting_participant_to_time_entries() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meeting_project_name() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meeting_to_time_entries() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meetings_on_client_rename() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_meetings_on_project_rename() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_task_timer_to_time_entry() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_meeting_time_entries(uuid) FROM PUBLIC, anon;