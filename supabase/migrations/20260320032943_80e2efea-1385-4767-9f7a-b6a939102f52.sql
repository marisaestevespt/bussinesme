
-- Add Instagram-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_accounts_reached integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_total_impressions integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_profile_visits integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_bio_link_clicks integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_avg_likes numeric;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_avg_comments numeric;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_avg_saves numeric;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN ig_engagement_rate numeric;

-- Add YouTube-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN yt_total_views integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN yt_watch_hours numeric;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN yt_new_subscribers integer;

-- Add TikTok-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN tt_total_views integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN tt_total_likes integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN tt_total_shares integer;

-- Add LinkedIn-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN li_total_impressions integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN li_page_visits integer;

-- Add Pinterest-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN pt_monthly_impressions integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN pt_total_clicks integer;

-- Add Email-specific columns
ALTER TABLE public.channel_monthly_metrics ADD COLUMN em_list_total integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN em_list_growth integer;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN em_avg_open_rate numeric;
ALTER TABLE public.channel_monthly_metrics ADD COLUMN em_avg_click_rate numeric;

-- Add unique constraint for upsert
ALTER TABLE public.channel_monthly_metrics ADD CONSTRAINT channel_monthly_metrics_channel_month_year_key UNIQUE (channel_id, month, year);
