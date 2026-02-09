-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM (
  'ceo',
  'gestor_projetos',
  'gestor_ads',
  'sucesso_cliente',
  'design',
  'editor_video',
  'devs',
  'atrizes_gravacao',
  'produtora',
  'gestor_crm',
  'consultor_comercial',
  'financeiro',
  'rh'
);

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is CEO or Gestor de Projetos (admin-level)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo', 'gestor_projetos')
  )
$$;

-- Function to check if user is CEO only
CREATE OR REPLACE FUNCTION public.is_ceo(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'ceo'
  )
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles

-- Everyone authenticated can view profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Only CEO can insert profiles (create users)
CREATE POLICY "CEO can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_ceo(auth.uid()));

-- Only CEO can update profiles
CREATE POLICY "CEO can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_ceo(auth.uid()));

-- Only CEO can delete profiles
CREATE POLICY "CEO can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_ceo(auth.uid()));

-- RLS Policies for user_roles

-- Everyone authenticated can view roles
CREATE POLICY "Users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Only CEO can manage roles
CREATE POLICY "CEO can create roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_ceo(auth.uid()));

CREATE POLICY "CEO can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_ceo(auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();