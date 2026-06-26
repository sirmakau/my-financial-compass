INSERT INTO public.transactions(user_id, account_id, category_id, amount, occurred_at, description, source, status, completed_at)
SELECT '65b92164-06c9-4b5d-b375-3d94b9c228af'::uuid,
       '4c6939ff-9c99-49cb-9713-f4d33d15df49'::uuid,
       (SELECT id FROM public.categories WHERE user_id='65b92164-06c9-4b5d-b375-3d94b9c228af' AND name='Fees & Charges' LIMIT 1),
       -3.00, now(),
       'Reconcile to SMS UFQR58YTAJ (outstanding 383.31)',
       'manual'::txn_source, 'completed', now();