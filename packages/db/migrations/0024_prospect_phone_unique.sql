-- ליד אחד לכל מספר טלפון — נאכף במסד, לא רק במסכים.
--
-- בדיקה במסך עוצרת רק את הדרך שבה נכתבה: הוספה ידנית, ייבוא רשימה,
-- Google Places, דף הנחיתה ועריכת טלפון בכרטיס הם חמש דרכים, ובדיקה
-- שנשכחה באחת מהן היא בדיוק הכפילות שנגלה אחרי חודש. אינדקס ייחודי
-- נכשל סגור בכולן, גם בדרך שעוד לא נכתבה.
--
-- ההשוואה היא על מספר מנורמל ולא על הטקסט: "+972 9-887-3565" ו-
-- "09-8873565" הם אותו מספר. אותו כלל כמו normalizePhone ב-apps/web/lib/phone.ts.

create function platform_phone_key(phone text) returns text
  language sql immutable parallel safe
  return nullif(
    case
      when regexp_replace(coalesce(phone, ''), '\D', '', 'g') like '972%'
        then '0' || substr(regexp_replace(phone, '\D', '', 'g'), 4)
      else regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    end,
    ''
  );

alter table platform_prospects
  add column phone_key text generated always as (platform_phone_key(phone)) stored;

-- כפילויות שכבר קיימות מתמזגות לליד הוותיק, בלי לאבד דבר: ההערות
-- עוברות אליו, פרטי הכפיל נשמרים כהערה, והדגלים לוקחים את המתקדם.
-- בלי זה האינדקס היה נכשל על נתונים קיימים והמיגרציה כולה נעצרת.
create temp table _prospect_dups on commit drop as
  select id, keeper from (
    select id,
           first_value(id) over (partition by phone_key order by created_at, id) as keeper
      from platform_prospects
     where phone_key is not null
  ) ranked
  where id <> keeper;

update platform_prospect_notes n
   set prospect_id = d.keeper
  from _prospect_dups d
 where n.prospect_id = d.id;

insert into platform_prospect_notes (prospect_id, body, created_at)
select d.keeper,
       'מוזג ליד כפול: ' || p.name || ' · ' || p.source || coalesce(' · ' || p.note, ''),
       p.created_at
  from _prospect_dups d
  join platform_prospects p on p.id = d.id;

update platform_prospects k
   set contacted         = k.contacted or agg.contacted,
       booked_at         = coalesce(k.booked_at, agg.booked_at),
       next_follow_up_at = coalesce(k.next_follow_up_at, agg.next_follow_up_at),
       address           = coalesce(k.address, agg.address),
       website           = coalesce(k.website, agg.website)
  from (
    select d.keeper,
           bool_or(p.contacted)        as contacted,
           min(p.booked_at)            as booked_at,
           min(p.next_follow_up_at)    as next_follow_up_at,
           min(p.address)              as address,
           min(p.website)              as website
      from _prospect_dups d
      join platform_prospects p on p.id = d.id
     group by d.keeper
  ) agg
 where k.id = agg.keeper;

delete from platform_prospects p using _prospect_dups d where p.id = d.id;

create unique index platform_prospects_phone_key_uniq
  on platform_prospects (phone_key) where phone_key is not null;
