-- Pregunta de seguridad para recuperacion de contrasena

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS pregunta_seguridad text,
  ADD COLUMN IF NOT EXISTS respuesta_seguridad_hash text;

CREATE OR REPLACE FUNCTION public.get_security_question_by_email(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question text;
BEGIN
  SELECT p.pregunta_seguridad
    INTO v_question
  FROM public.perfiles p
  WHERE lower(trim(p.email)) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_question;
END;
$$;

REVOKE ALL ON FUNCTION public.get_security_question_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_security_question_by_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_password_with_security_answer(
  p_email text,
  p_answer_hash text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN false;
  END IF;

  SELECT p.id
    INTO v_user_id
  FROM public.perfiles p
  WHERE lower(trim(p.email)) = lower(trim(p_email))
    AND p.respuesta_seguridad_hash IS NOT NULL
    AND p.respuesta_seguridad_hash = p_answer_hash
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_password_with_security_answer(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_password_with_security_answer(text, text, text) TO anon, authenticated;
