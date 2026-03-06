-- ============================================================
-- TRIGGER: Auto-resetear flags de notificación cuando vencimiento cambia
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Cuando el admin actualiza manualmente la fecha de vencimiento a una fecha futura,
-- los flags notified, followup_sent, urgency_sent se resetean automáticamente.
-- Esto evita que los clientes que ya pagaron sigan recibiendo remarketing.

CREATE OR REPLACE FUNCTION reset_notification_flags()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar si el vencimiento cambió
    IF OLD.vencimiento IS DISTINCT FROM NEW.vencimiento THEN
        -- Parsear la nueva fecha (DD/MM/YYYY o YYYY-MM-DD)
        DECLARE
            exp_date DATE;
        BEGIN
            -- Intentar DD/MM/YYYY
            IF NEW.vencimiento ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
                exp_date := to_date(NEW.vencimiento, 'DD/MM/YYYY');
            -- Intentar YYYY-MM-DD
            ELSIF NEW.vencimiento ~ '^\d{4}-\d{2}-\d{2}$' THEN
                exp_date := to_date(NEW.vencimiento, 'YYYY-MM-DD');
            ELSE
                exp_date := NULL;
            END IF;

            -- Si la nueva fecha es futura (más de 3 días desde hoy), resetear flags
            IF exp_date IS NOT NULL AND exp_date > (CURRENT_DATE + INTERVAL '3 days') THEN
                NEW.notified := false;
                NEW.notified_at := NULL;
                NEW.followup_sent := false;
                NEW.urgency_sent := false;
                RAISE NOTICE 'Reset notification flags for subscription % (new expiry: %)', NEW.id, NEW.vencimiento;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS trg_reset_notification_flags ON subscriptions;
CREATE TRIGGER trg_reset_notification_flags
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION reset_notification_flags();
