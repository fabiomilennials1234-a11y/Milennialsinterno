
CREATE OR REPLACE FUNCTION public.get_day_of_week_portuguese()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  day_num INT;
  brazil_time TIMESTAMPTZ;
BEGIN
  -- Converte para horário de Brasília
  brazil_time := NOW() AT TIME ZONE 'America/Sao_Paulo';
  
  -- EXTRACT(DOW FROM ...) retorna 0=Domingo, 1=Segunda, etc.
  day_num := EXTRACT(DOW FROM brazil_time);
  
  RETURN CASE day_num
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'segunda' -- Sábado -> Segunda
    WHEN 0 THEN 'segunda' -- Domingo -> Segunda
  END;
END;
$function$;
