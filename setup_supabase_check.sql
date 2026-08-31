-- 1. Crear tipo de retorno para la función
DROP TYPE IF EXISTS public.license_status CASCADE;
CREATE TYPE public.license_status AS (
    status text,
    days_left integer,
    is_pro boolean,
    message text
);

-- 2. Crear RPC segura para obtener el estado sin exponer la tabla (Bypass RLS)
CREATE OR REPLACE FUNCTION public.check_license(p_hwid text)
RETURNS public.license_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec record;
    v_best_lic record;
    v_max_days integer := -1;
    v_days_left integer;
    v_is_pro boolean;
    v_result public.license_status;
BEGIN
    -- Primero asegurar que tenga el trial (si no lo tiene, lo registra)
    PERFORM public.register_trial(p_hwid);

    -- Buscar la mejor licencia activa para este HWID
    FOR v_rec IN 
        SELECT * FROM public.licenses 
        WHERE hwid = p_hwid AND is_active = true
    LOOP
        IF v_rec.expires_at IS NULL THEN
            v_max_days := 9999;
            v_best_lic := v_rec;
            EXIT;
        END IF;

        v_days_left := CEIL(EXTRACT(EPOCH FROM (v_rec.expires_at - now())) / 86400.0);
        IF v_days_left > v_max_days THEN
            v_max_days := v_days_left;
            v_best_lic := v_rec;
        END IF;
    END LOOP;

    IF v_best_lic IS NOT NULL AND v_max_days > 0 THEN
        v_is_pro := (v_max_days > 30 OR v_best_lic.license_key NOT LIKE 'TRIAL-%');
        v_result.status := CASE WHEN v_is_pro THEN 'pro' ELSE 'trial' END;
        v_result.days_left := v_max_days;
        v_result.is_pro := v_is_pro;
        v_result.message := CASE WHEN v_is_pro THEN 'Licencia PRO verificada.' ELSE 'Período de prueba activo.' END;
        RETURN v_result;
    END IF;

    -- Si expiró o no tiene
    v_result.status := 'expired';
    v_result.days_left := 0;
    v_result.is_pro := false;
    v_result.message := 'Período de prueba expirado. Ingrese una clave válida.';
    RETURN v_result;
END;
$$;
