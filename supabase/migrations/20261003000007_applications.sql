-- Programme applications ("Başvuru"): a detailed request from someone who wants to work with the
-- dietitian — programme length (at least three months), format, goal, health background. Stored
-- as a lead of its own kind, under the same rules as every lead: inserted only by the server's
-- lead intake (service role, rate-limited, consent recorded), read only by the dietitian.
--
-- Until this runs, the intake stores applications as 'contact' leads with payload.form =
-- 'application', and the panel shows them as applications all the same.

alter type public.lead_kind add value if not exists 'application';
