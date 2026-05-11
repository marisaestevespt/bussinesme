
DO $$
DECLARE
  fks text[][] := ARRAY[
    ['absence_coverage','substitute_id','profiles','SET NULL'],
    ['business_settings','accountant_member_id','profiles','SET NULL'],
    ['capacity_scenario_products','product_id','products','CASCADE'],
    ['capacity_scenario_products','scenario_id','capacity_scenarios','CASCADE'],
    ['client_activities','client_id','clients','CASCADE'],
    ['client_assignments','profile_id','profiles','CASCADE'],
    ['client_assignments','client_id','clients','CASCADE'],
    ['client_contacts','client_id','clients','CASCADE'],
    ['client_feedback','client_id','clients','CASCADE'],
    ['client_history','lead_id','crm_leads','SET NULL'],
    ['client_history','client_id','clients','CASCADE'],
    ['client_nps_records','product_id','products','SET NULL'],
    ['client_nps_records','task_id','tasks','SET NULL'],
    ['client_nps_records','client_id','clients','CASCADE'],
    ['client_offboarding','client_id','clients','CASCADE'],
    ['client_onboarding','client_id','clients','CASCADE'],
    ['client_portals','client_id','clients','CASCADE'],
    ['client_renewals','client_id','clients','CASCADE'],
    ['client_renewals','project_id','projects','SET NULL'],
    ['client_requests','client_id','clients','CASCADE'],
    ['client_requests','project_id','projects','SET NULL'],
    ['clients','pending_renewal_project_id','projects','SET NULL'],
    ['clients','account_manager_id','profiles','SET NULL'],
    ['clients','current_product_id','products','SET NULL'],
    ['commercial_library_entries','product_id','products','SET NULL'],
    ['commercial_library_entries','project_id','projects','SET NULL'],
    ['commercial_product_goals','product_id','products','CASCADE'],
    ['commercial_sales','client_id','clients','SET NULL'],
    ['commercial_sales','product_id','products','SET NULL'],
    ['commercial_sales','project_id','projects','SET NULL'],
    ['commercial_sales_actions','product_id','products','SET NULL'],
    ['commercial_sales_actions','project_id','projects','SET NULL'],
    ['commercial_strategy_projects','project_id','projects','CASCADE'],
    ['content_attachments','content_id','content_items','CASCADE'],
    ['content_channels','content_id','content_items','CASCADE'],
    ['content_item_comments','content_item_id','content_items','CASCADE'],
    ['content_item_comments','author_id','profiles','CASCADE'],
    ['content_item_comments','parent_id','content_item_comments','CASCADE'],
    ['content_items','project_id','projects','SET NULL'],
    ['content_items','product_id','products','SET NULL'],
    ['content_metrics','content_id','content_items','CASCADE'],
    ['crm_interactions','lead_id','crm_leads','CASCADE'],
    ['crm_labels','pipeline_id','crm_pipelines','CASCADE'],
    ['crm_lead_actions','lead_id','crm_leads','CASCADE'],
    ['crm_lead_labels','lead_id','crm_leads','CASCADE'],
    ['crm_lead_labels','label_id','crm_labels','CASCADE'],
    ['crm_leads','responsible_id','profiles','SET NULL'],
    ['crm_leads','potential_product_id','products','SET NULL'],
    ['crm_pipeline_labels','pipeline_id','crm_pipelines','CASCADE'],
    ['crm_pipeline_leads','pipeline_id','crm_pipelines','CASCADE'],
    ['crm_pipeline_leads','lead_id','crm_leads','CASCADE'],
    ['crm_pipeline_leads','stage_id','crm_pipeline_stages','SET NULL'],
    ['crm_pipeline_stages','pipeline_id','crm_pipelines','CASCADE'],
    ['crm_pipelines','product_id','products','SET NULL'],
    ['crm_pipelines','project_id','projects','SET NULL'],
    ['custom_field_values','field_id','custom_fields','CASCADE'],
    ['digest_settings','user_id','profiles','CASCADE'],
    ['dismissed_ceo_alerts','user_id','profiles','CASCADE'],
    ['event_attachments','event_id','events','CASCADE'],
    ['event_members','event_id','events','CASCADE'],
    ['event_members','profile_id','profiles','CASCADE'],
    ['events','event_type_id','event_types','SET NULL'],
    ['events','product_id','products','SET NULL'],
    ['access_password_audit','user_id','profiles','SET NULL'],
    ['brand_kanban_section_attachments','section_id','brand_kanban_sections','CASCADE']
  ];
  i int;
  child_t text; col text; parent_t text; act text;
  cname text;
  exists_already boolean;
BEGIN
  FOR i IN 1..array_length(fks,1) LOOP
    child_t := fks[i][1]; col := fks[i][2]; parent_t := fks[i][3]; act := fks[i][4];

    -- Skip if any FK already exists on this column
    SELECT EXISTS(
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(c.conkey)
      WHERE c.contype='f' AND n.nspname='public'
        AND cl.relname=child_t AND a.attname=col
    ) INTO exists_already;

    IF exists_already THEN
      RAISE NOTICE 'skip % .% (FK exists)', child_t, col;
      CONTINUE;
    END IF;

    cname := child_t || '_' || col || '_fkey';
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s',
      child_t, cname, col, parent_t, act
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',
      'idx_'||child_t||'_'||col, child_t, col
    );
  END LOOP;
END $$;
