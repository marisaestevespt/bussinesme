
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');

-- User roles table (created BEFORE has_role function)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Authenticated can view roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Allow first owner bootstrap"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner')
  );

-- Business settings table
CREATE TABLE public.business_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '222 47% 11%',
  secondary_color TEXT NOT NULL DEFAULT '210 40% 96%',
  background_color TEXT NOT NULL DEFAULT '0 0% 100%',
  text_color TEXT NOT NULL DEFAULT '222 84% 5%',
  font_display TEXT NOT NULL DEFAULT 'Geist Sans',
  font_body TEXT NOT NULL DEFAULT 'Geist Sans',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read business settings"
  ON public.business_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can insert business settings"
  ON public.business_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update business settings"
  ON public.business_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Allow first setup insert"
  ON public.business_settings FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.business_settings));

CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Custom roles table
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom roles"
  ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert custom roles"
  ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update custom roles"
  ON public.custom_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete custom roles"
  ON public.custom_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND NOT is_owner);

CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Role permissions table
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE NOT NULL,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (custom_role_id, module_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  custom_role_id UUID REFERENCES public.custom_roles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view members"
  ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert members"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update members"
  ON public.members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete members"
  ON public.members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Owner role
INSERT INTO public.custom_roles (name, description, is_owner)
VALUES ('Owner', 'Acesso total ao sistema. Não pode ser editado ou eliminado.', true);

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Logo images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
