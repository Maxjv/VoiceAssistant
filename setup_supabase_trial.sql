-- 1. Crear la función RPC segura para registrar automáticamente los trials
CREATE OR REPLACE FUNCTION public.register_trial(p_hwid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si el HWID ya está en la tabla, no hacemos nada, ya está registrado
    IF EXISTS (SELECT 1 FROM public.licenses WHERE hwid = p_hwid) THEN
        RETURN true;
    END IF;

    -- Si no existe, lo insertamos como una licencia TRIAL que expira en 7 días
    -- Como license_key ponemos 'TRIAL-' más un id único para evitar colisiones
    INSERT INTO public.licenses (license_key, hwid, expires_at, is_active)
    VALUES ('TRIAL-' || gen_random_uuid()::text, p_hwid, now() + interval '7 days', true);

    RETURN true;
END;
$$;
