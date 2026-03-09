-- Create strategy_funnel_templates table for custom funnel models
CREATE TABLE IF NOT EXISTS strategy_funnel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'linkedin')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  how_it_works TEXT[] DEFAULT '{}',
  icon_color TEXT NOT NULL DEFAULT 'from-indigo-500 to-indigo-600',
  visible_fields TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE strategy_funnel_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "Anyone authenticated can view funnel templates"
  ON strategy_funnel_templates FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert/update/delete (CEO check is done in the app)
CREATE POLICY "Authenticated users can manage funnel templates"
  ON strategy_funnel_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add custom_funnels JSONB column to client_strategies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_strategies' AND column_name = 'custom_funnels'
  ) THEN
    ALTER TABLE client_strategies ADD COLUMN custom_funnels JSONB DEFAULT '{}';
  END IF;
END $$;
