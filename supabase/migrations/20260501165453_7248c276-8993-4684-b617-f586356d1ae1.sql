-- Adiciona os valores em falta ao enum meeting_status
-- (código já assume estes valores: por_organizar, realizada, cancelada)
ALTER TYPE public.meeting_status ADD VALUE IF NOT EXISTS 'por_organizar';
ALTER TYPE public.meeting_status ADD VALUE IF NOT EXISTS 'realizada';
ALTER TYPE public.meeting_status ADD VALUE IF NOT EXISTS 'cancelada';