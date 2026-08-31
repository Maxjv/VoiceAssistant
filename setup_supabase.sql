-- 1. Asegúrate de eliminar la tabla antigua si existía para crear la nueva estructura correcta
DROP TABLE IF EXISTS public.licenses;

-- 2. Crear la tabla correcta con todos los campos necesarios
CREATE TABLE public.licenses (
    license_key text PRIMARY KEY,
    hwid text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz
);

-- 3. Habilitar Seguridad de Nivel de Fila (RLS) para proteger la tabla
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 4. Crear la función RPC segura para activar licencias
CREATE OR REPLACE FUNCTION public.activate_license(p_key text, p_hwid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos elevados para ignorar RLS en esta operación
AS $$
DECLARE
    v_hwid text;
    v_is_active boolean;
BEGIN
    -- Buscar la licencia
    SELECT hwid, is_active INTO v_hwid, v_is_active
    FROM public.licenses
    WHERE license_key = p_key;

    -- Si no existe la licencia o no está activa
    IF NOT FOUND OR NOT v_is_active THEN
        RAISE EXCEPTION 'La clave de licencia es inválida o está desactivada.';
    END IF;

    -- Si el HWID ya está asignado a OTRA PC
    IF v_hwid IS NOT NULL AND v_hwid != p_hwid THEN
        RAISE EXCEPTION 'Esta licencia ya está en uso por otro equipo.';
    END IF;

    -- Si todo está correcto, asignamos el HWID a la licencia y ponemos expiración de 7 días (como me pediste)
    UPDATE public.licenses
    SET hwid = p_hwid,
        expires_at = now() + interval '7 days'
    WHERE license_key = p_key;

    RETURN true;
END;
$$;

-- 5. INSERTAR algunas licencias de prueba para que puedas usarlas
INSERT INTO public.licenses (license_key) VALUES 
('TFTE-PRO-A1B2C3D4'),
('TFTE-PRO-Z9Y8X7W6'),
('TFTE-PRO-PRUEBA1');
