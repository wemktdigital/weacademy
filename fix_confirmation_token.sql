-- Corrigir campos NULL na tabela auth.users

UPDATE auth.users 
SET 
    confirmation_token = '',
    email_change = '',
    email_change_token_new = '',
    recovery_token = ''
WHERE 
    email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com')
    AND (
        confirmation_token IS NULL 
        OR email_change IS NULL 
        OR email_change_token_new IS NULL 
        OR recovery_token IS NULL
    );
