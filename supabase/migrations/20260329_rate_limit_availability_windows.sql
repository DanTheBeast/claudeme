-- Rate-limit availability windows to prevent spam
-- Users can create max 50 availability windows (reasonable limit for 7 days/week)

CREATE OR REPLACE FUNCTION check_availability_window_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.availability_windows 
      WHERE user_id = NEW.user_id) >= 50 THEN
    RAISE EXCEPTION 'Maximum number of availability windows (50) reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_availability_window_limit_trigger ON public.availability_windows;
CREATE TRIGGER check_availability_window_limit_trigger
BEFORE INSERT ON public.availability_windows
FOR EACH ROW
EXECUTE FUNCTION check_availability_window_limit();
