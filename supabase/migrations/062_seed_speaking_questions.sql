-- ============================================
-- Migration 062: Seed Speaking Question Bank
-- High-quality seed questions for all 4 modes
-- Auto-generated from seed script
-- ============================================

DO $$
DECLARE
  v_uid UUID := 'c3afa71b-6994-4028-9df8-8374faa44b3b';
  v_norm TEXT;
BEGIN

  DELETE FROM speaking_questions WHERE user_id = v_uid AND source_type = 'seed';

  RAISE NOTICE 'Seeding speaking questions...';

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you work or are you a student?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you work or are you a student?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'personal'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What subject are you studying and why did you choose it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What subject are you studying and why did you choose it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'motivation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer studying alone or in a group?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you prefer studying alone or in a group?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you find most challenging about your studies?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you find most challenging about your studies?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'challenge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has your education prepared you for your future career?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has your education prepared you for your future career?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'career'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of school did you go to as a child?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kind of school did you go to as a child?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['education', 'childhood'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think teachers have an important role in society?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think teachers have an important role in society?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['education', 'society'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Are there any skills you would like to learn in the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Are there any skills you would like to learn in the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['education', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually prepare for exams?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you usually prepare for exams?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['education', 'exam'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think makes a good student?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you think makes a good student?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['education', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your job and how long have you been doing it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is your job and how long have you been doing it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['work', 'personal'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you enjoy most about your work?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you enjoy most about your work?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['work', 'satisfaction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Would you like to change your job or career path in the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Would you like to change your job or career path in the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['work', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of work environment helps you be most productive?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kind of work environment helps you be most productive?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['work', 'productivity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you get along well with your colleagues?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you get along well with your colleagues?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['work', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is work-life balance to you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How important is work-life balance to you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['work', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What was your first job and what did you learn from it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What was your first job and what did you learn from it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['work', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('At what age do you think people should start working?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'At what age do you think people should start working?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['work', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your typical daily routine like?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is your typical daily routine like?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['routine', 'daily'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you usually do on weekends?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you usually do on weekends?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['weekend', 'leisure'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually spend your evenings after work or study?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you usually spend your evenings after work or study?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['evening', 'routine'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Has your daily routine changed much in the last few years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Has your daily routine changed much in the last few years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['routine', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you consider yourself an organized person?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you consider yourself an organized person?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['organization', 'personality'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you manage your time between different responsibilities?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you manage your time between different responsibilities?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['time-management', 'productivity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What time of day do you feel most productive?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What time of day do you feel most productive?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['productivity', 'routine'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you usually wake up early or stay up late?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you usually wake up early or stay up late?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['sleep', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy traveling? What kind of places do you like to visit?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you enjoy traveling? What kind of places do you like to visit?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['travel', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the most interesting place you have traveled to?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is the most interesting place you have traveled to?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['travel', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer traveling alone or with others?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you prefer traveling alone or with others?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['travel', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually learn about the culture of a place before visiting?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you usually learn about the culture of a place before visiting?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['travel', 'culture'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What forms of transport do you prefer when traveling?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What forms of transport do you prefer when traveling?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['transport', 'travel'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Is there a place you would like to visit again? Why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Is there a place you would like to visit again? Why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['travel', 'reflection'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of food do you enjoy eating?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kind of food do you enjoy eating?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['food', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How often do you cook at home?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How often do you cook at home?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['cooking', 'food'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think your diet is healthy? Why or why not?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think your diet is healthy? Why or why not?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['diet', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is a traditional dish from your country that you would recommend?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is a traditional dish from your country that you would recommend?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['food', 'culture'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you do any sports or regular exercise?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you do any sports or regular exercise?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['exercise', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you do to stay healthy?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you do to stay healthy?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['health', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Tell me about your family. How many people are there in your immediate family?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Tell me about your family. How many people are there in your immediate family?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['family', 'personal'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Who are you closest to in your family?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Who are you closest to in your family?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['family', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How often do you spend time with your friends?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How often do you spend time with your friends?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['friends', 'social'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What qualities do you value most in a friend?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What qualities do you value most in a friend?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['friendship', 'values'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think it is better to have a few close friends or many acquaintances?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think it is better to have a few close friends or many acquaintances?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['friendship', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually keep in touch with friends and family?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you usually keep in touch with friends and family?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['communication', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How often do you use your smartphone?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How often do you use your smartphone?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['technology', 'daily'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your favorite app and why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is your favorite app and why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['app', 'technology'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has technology changed the way you communicate with others?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has technology changed the way you communicate with others?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['technology', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think people rely too much on technology these days?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think people rely too much on technology these days?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['technology', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What piece of technology could you not live without?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What piece of technology could you not live without?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['technology', 'necessity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy keeping up with the latest gadgets and technology news?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you enjoy keeping up with the latest gadgets and technology news?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['technology', 'interest'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What type of music do you enjoy listening to?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What type of music do you enjoy listening to?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['music', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you play any musical instruments or sing?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you play any musical instruments or sing?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['music', 'skill'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of movies or TV shows do you prefer?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kind of movies or TV shows do you prefer?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['movies', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer watching films at home or in the cinema?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you prefer watching films at home or in the cinema?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['movies', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How often do you read books for pleasure?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How often do you read books for pleasure?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ielts-academic.com/sample-questions', ARRAY['reading', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What was the last book you read and did you enjoy it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What was the last book you read and did you enjoy it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['reading', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is one of your happiest childhood memories?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is one of your happiest childhood memories?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['childhood', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you ever tried a new activity that surprised you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Have you ever tried a new activity that surprised you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['experience', 'discovery'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the most important decision you have made in your life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is the most important decision you have made in your life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['decision', 'life'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy trying new things or do you prefer familiar experiences?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you enjoy trying new things or do you prefer familiar experiences?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['preference', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Can you describe a time when you helped someone?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Can you describe a time when you helped someone?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['help', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something you have done that you are proud of?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What is something you have done that you are proud of?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['pride', 'achievement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / opinions / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer living in a big city or a small town? Why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you prefer living in a big city or a small town? Why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'opinions', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['lifestyle', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / opinions / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think makes a person successful?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you think makes a person successful?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'opinions', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['success', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / emotions / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kinds of things make you feel happy?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kinds of things make you feel happy?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'emotions', 'part1', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['happiness', 'emotion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / emotions / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually deal with stress?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you usually deal with stress?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'emotions', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['stress', 'coping'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What are your main goals for the next five years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What are your main goals for the next five years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part1', 'intermediate', 'seed', 'ielts-academic.com/sample-questions', ARRAY['goals', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part1
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Where do you see yourself living in the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Where do you see yourself living in the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part1', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-1-topics', ARRAY['future', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a person who has had a significant influence on your life.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a person who has had a significant influence on your life.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this person is","how you know this person","what influence they have had on you","and explain why this person is important to you"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['person', 'influence'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a family member you admire.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a family member you admire.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this family member is","what your relationship is like","what qualities they have","and explain why you admire them"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['family', 'admiration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a good friend you have known for a long time.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a good friend you have known for a long time.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this friend is","how and when you first met","what you do together","and explain why your friendship has lasted"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['friend', 'relationship'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a neighbor you remember well.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a neighbor you remember well.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this neighbor was","where you lived at the time","what kind of person they were","and explain why you remember them well"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['neighbor', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe an interesting person you met recently.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe an interesting person you met recently.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this person is","when and where you met them","what you talked about","and explain why you found them interesting"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['person', 'encounter'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe someone who is very good at their job.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe someone who is very good at their job.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this person is","what their job is","what skills or qualities make them good at their job","and explain what you can learn from them"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['work', 'skill'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a person you admire for their creativity.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a person you admire for their creativity.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this person is","how you know about them","what creative things they do","and explain why you admire their creativity"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['creativity', 'admiration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a teacher who had a positive impact on you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a teacher who had a positive impact on you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this teacher was","what subject they taught","what made them special","and explain how they influenced you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['teacher', 'education'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a place you would like to visit in the future.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a place you would like to visit in the future.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where this place is","what you know about this place","what you would like to do there","and explain why you want to visit this place"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['travel', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / life_routine / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe your favorite room in your home.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe your favorite room in your home.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'life_routine', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["which room it is","what it looks like","what you usually do in this room","and explain why it is your favorite"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['home', 'comfort'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a city you have visited that you really liked.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a city you have visited that you really liked.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["which city it was","when you visited it","what you did there","and explain why you liked it so much"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['city', 'travel'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a quiet place you like to go to.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a quiet place you like to go to.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where this place is","how you discovered it","what you do there","and explain why you find it peaceful"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['place', 'peace'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a public building you have visited that impressed you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a public building you have visited that impressed you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what building it is","where it is located","when you visited it","and explain why it impressed you"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['architecture', 'impression'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a place near water that you have visited.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a place near water that you have visited.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where this place is","when you went there","what you did there","and explain how you felt being near the water"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['water', 'nature'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a memorable trip you have taken.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a memorable trip you have taken.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where you went","who you went with","what you did during the trip","and explain why this trip was memorable"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['trip', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a special event or celebration you attended.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a special event or celebration you attended.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the event was","when and where it took place","who was there","and explain why it was special to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['event', 'celebration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe an achievement you are proud of.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe an achievement you are proud of.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what you achieved","when it happened","what you did to achieve it","and explain why you feel proud of it"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['achievement', 'pride'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you had to make a difficult decision.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time when you had to make a difficult decision.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the decision was about","when you had to make it","what factors you considered","and explain how you felt after making the decision"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['decision', 'challenge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you learned something new.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time when you learned something new.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what you learned","when and where you learned it","who taught you or how you learned","and explain how this new knowledge or skill has been useful"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['learning', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you helped a stranger.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time when you helped a stranger.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["when and where it happened","who the stranger was","what kind of help you gave","and explain how you felt afterward"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['help', 'kindness'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe an outdoor activity you enjoy doing.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe an outdoor activity you enjoy doing.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what activity it is","when and where you usually do it","who you do it with","and explain why you enjoy this outdoor activity"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['activity', 'outdoor'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a difficult challenge you overcame.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a difficult challenge you overcame.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the challenge was","when you faced it","what steps you took to overcome it","and explain what you learned from the experience"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['challenge', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you received good news.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time when you received good news.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the news was about","when you received it","how you reacted","and explain why this news was important to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['news', 'emotion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time you gave advice to someone.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time you gave advice to someone.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who you gave advice to","what the situation was","what advice you gave","and explain whether the advice was helpful"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['advice', 'help'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe an item of clothing you like wearing.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe an item of clothing you like wearing.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the item is","when you got it","how often you wear it","and explain why you like it"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['fashion', 'personal'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a gift you received that was special to you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a gift you received that was special to you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the gift was","who gave it to you","on what occasion you received it","and explain why it was special to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['gift', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a piece of technology you use frequently.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a piece of technology you use frequently.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the technology is","how long you have had it","how you use it in your daily life","and explain why it is important to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['technology', 'daily-use'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / experiences / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a photograph that means a lot to you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a photograph that means a lot to you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'experiences', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the photograph shows","when and where it was taken","who took the photograph","and explain why it is meaningful to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['photo', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a book that had an impact on your thinking.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a book that had an impact on your thinking.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the book is","when you read it","what it is about","and explain how it influenced your thinking"]}', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['book', 'influence'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a useful app or website that you often use.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a useful app or website that you often use.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the app or website is","how you discovered it","what you use it for","and explain why you find it useful"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['technology', 'utility'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe something you own that you would like to replace.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe something you own that you would like to replace.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the item is","how long you have had it","what problems it has","and explain why you want to replace it"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['possession', 'upgrade'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a memorable meal you have had.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a memorable meal you have had.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["when and where you had this meal","what you ate","who you were with","and explain why this meal was memorable"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['food', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a restaurant you enjoy going to.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a restaurant you enjoy going to.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where the restaurant is","what kind of food it serves","how often you go there","and explain why you enjoy it"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['restaurant', 'food'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a healthy habit you have or would like to develop.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a healthy habit you have or would like to develop.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the habit is","how you started or plan to start it","what benefits it brings","and explain why this habit is important for health"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['health', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a movie or TV series that you particularly enjoyed.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a movie or TV series that you particularly enjoyed.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the movie or series is","what it is about","when you watched it","and explain why you enjoyed it so much"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['movie', 'entertainment'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a song or piece of music that is meaningful to you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a song or piece of music that is meaningful to you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the song or piece is","when you first heard it","what it makes you think or feel","and explain why it is meaningful to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['music', 'meaning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a news story you found interesting recently.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a news story you found interesting recently.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the story was about","how you heard about it","what your reaction was","and explain why you found it interesting"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['news', 'interest'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a natural place you find beautiful.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a natural place you find beautiful.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["where this place is","what it looks like","when you first went there","and explain why you find it beautiful"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['nature', 'beauty'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe something you do to help protect the environment.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe something you do to help protect the environment.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what you do","how often you do it","why you started doing it","and explain how it helps the environment"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['environment', 'action'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a type of weather that you particularly enjoy.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a type of weather that you particularly enjoy.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what type of weather it is","when you typically experience it","what you like to do in this weather","and explain why you enjoy it"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['weather', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a skill that took you a long time to learn.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a skill that took you a long time to learn.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the skill is","how you learned it","what difficulties you faced","and explain how you felt when you finally mastered it"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['skill', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a language you would like to learn.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a language you would like to learn.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what language it is","why you want to learn it","how you plan to learn it","and explain what challenges you might face"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['language', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe an interesting course or class you have taken.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe an interesting course or class you have taken.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the course was about","when and where you took it","what you learned from it","and explain why you found it interesting"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['course', 'education'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe your dream job.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe your dream job.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the job is","what responsibilities it involves","what skills are needed","and explain why this is your dream job"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['career', 'dream'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a successful businessperson you know or have heard about.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a successful businessperson you know or have heard about.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["who this person is","what they do","how they became successful","and explain what you admire about them"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['business', 'success'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a goal you have set for yourself.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a goal you have set for yourself.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what the goal is","when you set this goal","what steps you are taking to achieve it","and explain why this goal is important to you"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['goal', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe something you would like to achieve in your career.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe something you would like to achieve in your career.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["what you would like to achieve","how long you have had this ambition","what you need to do to achieve it","and explain why it matters to you"]}', 'intermediate', 'seed', 'ielts-academic.com/cue-cards', ARRAY['career', 'ambition'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / emotions / part2
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you felt really happy.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, context, cue_points, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Describe a time when you felt really happy.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'emotions', 'part2', 'You should speak for 1-2 minutes on this topic.', '{"bullets":["when and where it happened","what made you happy","who you were with","and explain why this moment stands out in your memory"]}', 'beginner', 'seed', 'ieltsliz.com/ielts-speaking-part-2-topics', ARRAY['happiness', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has the education system in your country changed in recent years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has the education system in your country changed in recent years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think university education should be free for everyone? Why or why not?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think university education should be free for everyone? Why or why not?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'policy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What skills do you think schools should teach that they currently do not?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What skills do you think schools should teach that they currently do not?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'skills'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is it for children to learn a foreign language?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How important is it for children to learn a foreign language?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['language', 'education'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think online learning can ever fully replace in-person education?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think online learning can ever fully replace in-person education?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'technology'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What role should parents play in their children''s education?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What role should parents play in their children''s education?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'parenting'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you think education will change in the next 20 years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How do you think education will change in the next 20 years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / study_learning / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Is academic success the most important factor for a successful career?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Is academic success the most important factor for a successful career?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'study_learning', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'career'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has technology changed the way people interact with each other?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has technology changed the way people interact with each other?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['technology', 'society'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think artificial intelligence will replace many jobs in the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think artificial intelligence will replace many jobs in the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['ai', 'jobs'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What are the advantages and disadvantages of children using smartphones?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What are the advantages and disadvantages of children using smartphones?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['technology', 'children'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has social media changed society?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has social media changed society?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['social-media', 'society'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do older people and younger people use technology differently?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do older people and younger people use technology differently?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['technology', 'generation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / technology / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kinds of technology do you think will be most important in the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What kinds of technology do you think will be most important in the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'technology', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['technology', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What factors do people consider when choosing a career?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What factors do people consider when choosing a career?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['career', 'choice'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think job satisfaction is more important than a high salary?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think job satisfaction is more important than a high salary?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['work', 'values'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has the nature of work changed in the last few decades?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has the nature of work changed in the last few decades?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['work', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / work_career / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What makes a good leader in the workplace?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What makes a good leader in the workplace?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'work_career', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['leadership', 'work'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What are the most serious environmental problems facing your country?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What are the most serious environmental problems facing your country?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['environment', 'problem'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Whose responsibility is it to protect the environment — individuals or governments?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Whose responsibility is it to protect the environment — individuals or governments?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['environment', 'responsibility'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How can individuals be encouraged to live more sustainably?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How can individuals be encouraged to live more sustainably?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['sustainability', 'behavior'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think eco-tourism has a positive or negative impact on the environment?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think eco-tourism has a positive or negative impact on the environment?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['tourism', 'environment'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How does tourism affect local communities?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How does tourism affect local communities?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['tourism', 'community'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think cultural traditions are being lost because of globalization?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think cultural traditions are being lost because of globalization?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['culture', 'globalization'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What can people learn from visiting other countries?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What can people learn from visiting other countries?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['travel', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / travel_culture / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has international travel changed compared to 30 years ago?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has international travel changed compared to 30 years ago?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'travel_culture', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['travel', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How have family structures changed in recent decades?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How have family structures changed in recent decades?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['family', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think the quality of friendships has changed with the rise of social media?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think the quality of friendships has changed with the rise of social media?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['friendship', 'social-media'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What qualities do you think are most important for maintaining a long-term relationship?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What qualities do you think are most important for maintaining a long-term relationship?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['relationships', 'qualities'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / people_relationships / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is it for elderly people to stay connected with younger generations?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How important is it for elderly people to stay connected with younger generations?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'people_relationships', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['generation', 'connection'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How have eating habits changed in your country over the years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How have eating habits changed in your country over the years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['food', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What are the main causes of unhealthy eating in modern society?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What are the main causes of unhealthy eating in modern society?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['food', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think governments should regulate the fast food industry more strictly?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think governments should regulate the fast food industry more strictly?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['regulation', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / food_health / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How can schools encourage children to develop healthy eating habits?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How can schools encourage children to develop healthy eating habits?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'food_health', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['education', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has the way people consume entertainment changed in the digital age?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How has the way people consume entertainment changed in the digital age?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['entertainment', 'digital'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think violent content in movies and games affects people''s behavior?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think violent content in movies and games affects people''s behavior?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['media', 'behavior'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What role does music play in people''s lives?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What role does music play in people''s lives?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['music', 'society'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / entertainment / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think reading habits are declining? What can be done about it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think reading habits are declining? What can be done about it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'entertainment', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['reading', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / opinions / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Why do some people enjoy taking risks while others prefer security?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Why do some people enjoy taking risks while others prefer security?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'opinions', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['risk', 'psychology'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / opinions / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think failure is a necessary part of success?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think failure is a necessary part of success?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'opinions', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['failure', 'success'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is it for young people to set long-term goals?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'How important is it for young people to set long-term goals?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part3', 'intermediate', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['goals', 'youth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / goals_future / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think are the biggest challenges the next generation will face?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What do you think are the biggest challenges the next generation will face?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'goals_future', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['future', 'challenge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / emotions / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think people are generally happier now than they were in the past?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'Do you think people are generally happier now than they were in the past?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'emotions', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['happiness', 'society'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- ielts / emotions / part3
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What can employers do to support the mental health of their workers?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, part, difficulty, source_type, source_ref, tags)
  VALUES (v_uid, 'What can employers do to support the mental health of their workers?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'ielts', 'emotions', 'part3', 'advanced', 'seed', 'ieltsliz.com/ielts-speaking-part-3-topics', ARRAY['mental-health', 'work'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What time do you usually get up in the morning and why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What time do you usually get up in the morning and why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['routine', 'morning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Tell me about your morning routine. What do you do before you leave home?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Tell me about your morning routine. What do you do before you leave home?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['routine', 'morning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How does your routine change on weekends compared to weekdays?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How does your routine change on weekends compared to weekdays?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['routine', 'weekend'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your favorite part of the day and why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your favorite part of the day and why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['routine', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually relax after a long day?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you usually relax after a long day?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['relaxation', 'routine'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe how you organize your daily tasks and responsibilities.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe how you organize your daily tasks and responsibilities.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['organization', 'productivity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you usually do when you have a free day with no plans?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you usually do when you have a free day with no plans?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['free-time', 'leisure'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Has your daily routine changed much in the past year? How?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Has your daily routine changed much in the past year? How?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['routine', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you usually have for breakfast?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you usually have for breakfast?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['food', 'breakfast'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy cooking? What is your signature dish?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you enjoy cooking? What is your signature dish?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['cooking', 'food'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of restaurants do you like to go to and how often do you eat out?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What kind of restaurants do you like to go to and how often do you eat out?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['restaurant', 'food'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('If you had guests coming for dinner, what would you cook for them?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'If you had guests coming for dinner, what would you cook for them?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'intermediate', 'seed', ARRAY['cooking', 'hospitality'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you decide what groceries to buy each week?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you decide what groceries to buy each week?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['shopping', 'food'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is a food from your childhood that brings back memories?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is a food from your childhood that brings back memories?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'intermediate', 'seed', ARRAY['food', 'memory'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you have any dietary restrictions or preferences? How do they affect your daily life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you have any dietary restrictions or preferences? How do they affect your daily life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'intermediate', 'seed', ARRAY['diet', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think about food delivery apps? Do you use them often?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you think about food delivery apps? Do you use them often?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['food-delivery', 'technology'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy shopping? What do you usually shop for?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you enjoy shopping? What do you usually shop for?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['shopping', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer shopping online or in physical stores? Why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you prefer shopping online or in physical stores? Why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['shopping', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you decide whether something is worth buying?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you decide whether something is worth buying?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['shopping', 'decision'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What was the last thing you bought that you were really happy with?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What was the last thing you bought that you were really happy with?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['shopping', 'satisfaction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you compare prices before making a purchase? How?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you compare prices before making a purchase? How?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['shopping', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you ever regretted buying something? What was it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Have you ever regretted buying something? What was it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['shopping', 'regret'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually get around your city?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you usually get around your city?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['transport', 'daily'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is public transportation like in your area?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is public transportation like in your area?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['transport', 'infrastructure'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you plan a trip? What do you research before you go?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you plan a trip? What do you research before you go?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'intermediate', 'seed', ARRAY['travel', 'planning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the best trip you have ever taken? What made it special?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is the best trip you have ever taken? What made it special?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['travel', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer traveling to big cities or natural landscapes?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you prefer traveling to big cities or natural landscapes?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['travel', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you usually pack when you go on a trip?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you usually pack when you go on a trip?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['travel', 'packing'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you ever had a travel mishap or something go wrong during a trip?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Have you ever had a travel mishap or something go wrong during a trip?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'intermediate', 'seed', ARRAY['travel', 'problem'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something tourists should know before visiting your country?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something tourists should know before visiting your country?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'intermediate', 'seed', ARRAY['travel', 'advice'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you usually spend time with your friends?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you usually spend time with your friends?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'beginner', 'seed', ARRAY['friends', 'social'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you make new friends as an adult?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you make new friends as an adult?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'intermediate', 'seed', ARRAY['friendship', 'social'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you talk about when you meet someone for the first time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you talk about when you meet someone for the first time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'beginner', 'seed', ARRAY['conversation', 'social'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you keep in touch with friends who live far away?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you keep in touch with friends who live far away?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'beginner', 'seed', ARRAY['friendship', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What makes a great party or social gathering in your opinion?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What makes a great party or social gathering in your opinion?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'intermediate', 'seed', ARRAY['social', 'opinion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you find it easy to start conversations with strangers?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you find it easy to start conversations with strangers?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'intermediate', 'seed', ARRAY['conversation', 'social-skill'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle disagreements with friends?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle disagreements with friends?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'intermediate', 'seed', ARRAY['conflict', 'friendship'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What qualities do you look for when meeting new people?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What qualities do you look for when meeting new people?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'intermediate', 'seed', ARRAY['friendship', 'values'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you like to do in your free time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you like to do in your free time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['hobby', 'leisure'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Is there a hobby you have always wanted to try but have not started yet?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Is there a hobby you have always wanted to try but have not started yet?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['hobby', 'aspiration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How much time do you spend watching TV or streaming content each week?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How much time do you spend watching TV or streaming content each week?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['tv', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you prefer indoor or outdoor activities? Why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you prefer indoor or outdoor activities? Why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['activity', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of music do you listen to while doing daily tasks?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What kind of music do you listen to while doing daily tasks?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['music', 'routine'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you enjoy watching sports? Which ones and why?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you enjoy watching sports? Which ones and why?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['sports', 'entertainment'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you recently discovered a new hobby or interest?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Have you recently discovered a new hobby or interest?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'beginner', 'seed', ARRAY['hobby', 'discovery'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you decide how to spend your leisure time when you have multiple options?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you decide how to spend your leisure time when you have multiple options?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'entertainment', 'intermediate', 'seed', ARRAY['leisure', 'decision'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How many hours a day do you think you spend on your phone?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How many hours a day do you think you spend on your phone?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'beginner', 'seed', ARRAY['phone', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Which apps do you use the most in your daily life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Which apps do you use the most in your daily life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'beginner', 'seed', ARRAY['apps', 'daily'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you stay organized — do you use any digital tools or apps?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you stay organized — do you use any digital tools or apps?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'intermediate', 'seed', ARRAY['organization', 'technology'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think you spend too much time online? Why or why not?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you think you spend too much time online? Why or why not?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'intermediate', 'seed', ARRAY['internet', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has the internet changed the way you handle everyday tasks?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has the internet changed the way you handle everyday tasks?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'intermediate', 'seed', ARRAY['internet', 'daily-life'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is one piece of technology you think has made your life significantly better?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is one piece of technology you think has made your life significantly better?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'intermediate', 'seed', ARRAY['technology', 'improvement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you feel when you forget your phone at home?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you feel when you forget your phone at home?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'technology', 'beginner', 'seed', ARRAY['phone', 'emotion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe the neighborhood or area where you live.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe the neighborhood or area where you live.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['home', 'neighborhood'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you like most about your current home?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you like most about your current home?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'beginner', 'seed', ARRAY['home', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('If you could change one thing about your living situation, what would it be?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'If you could change one thing about your living situation, what would it be?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['home', 'improvement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you make your living space feel comfortable and personal?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you make your living space feel comfortable and personal?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['home', 'decoration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your relationship like with your neighbors?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your relationship like with your neighbors?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'people_relationships', 'beginner', 'seed', ARRAY['neighbor', 'community'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the weather usually like where you live at this time of year?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is the weather usually like where you live at this time of year?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['weather', 'climate'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How does the weather affect your mood and daily activities?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How does the weather affect your mood and daily activities?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'intermediate', 'seed', ARRAY['weather', 'mood'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your favorite season and what do you like to do during that time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your favorite season and what do you like to do during that time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'beginner', 'seed', ARRAY['season', 'preference'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / travel_culture
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you ever experienced extreme weather? What happened?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Have you ever experienced extreme weather? What happened?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'travel_culture', 'intermediate', 'seed', ARRAY['weather', 'experience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you usually do when you feel stressed?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you usually do when you feel stressed?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'emotions', 'beginner', 'seed', ARRAY['stress', 'coping'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is sleep to you? Do you have any bedtime routines?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How important is sleep to you? Do you have any bedtime routines?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['sleep', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you pay attention to your mental health? What do you do to take care of it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you pay attention to your mental health? What do you do to take care of it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'emotions', 'intermediate', 'seed', ARRAY['mental-health', 'self-care'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What kind of exercise do you do and how does it make you feel?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What kind of exercise do you do and how does it make you feel?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'beginner', 'seed', ARRAY['exercise', 'health'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you motivate yourself to do things when you are feeling tired or lazy?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you motivate yourself to do things when you are feeling tired or lazy?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'emotions', 'intermediate', 'seed', ARRAY['motivation', 'habit'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / food_health
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does a healthy lifestyle mean to you personally?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does a healthy lifestyle mean to you personally?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'food_health', 'intermediate', 'seed', ARRAY['health', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something in your daily life that you think could be improved?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something in your daily life that you think could be improved?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'opinions', 'beginner', 'seed', ARRAY['improvement', 'daily-life'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think people today are busier than people in the past?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you think people today are busier than people in the past?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'opinions', 'intermediate', 'seed', ARRAY['lifestyle', 'comparison'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is a small thing that can make a big difference to your day?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is a small thing that can make a big difference to your day?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'opinions', 'beginner', 'seed', ARRAY['happiness', 'daily-life'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle it when your plans for the day get disrupted?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle it when your plans for the day get disrupted?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'experiences', 'intermediate', 'seed', ARRAY['adaptability', 'routine'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does a perfect day look like to you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does a perfect day look like to you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'opinions', 'beginner', 'seed', ARRAY['ideal', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think it is better to plan everything in advance or be spontaneous?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you think it is better to plan everything in advance or be spontaneous?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'opinions', 'intermediate', 'seed', ARRAY['planning', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something you have learned from making a mistake?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something you have learned from making a mistake?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'experiences', 'intermediate', 'seed', ARRAY['learning', 'mistake'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- daily / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you balance different areas of your life such as work, relationships, and personal time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you balance different areas of your life such as work, relationships, and personal time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'daily', 'life_routine', 'intermediate', 'seed', ARRAY['balance', 'lifestyle'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe your current job role and your main responsibilities.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe your current job role and your main responsibilities.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'beginner', 'seed', ARRAY['job', 'responsibility'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does a typical day at work look like for you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does a typical day at work look like for you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'beginner', 'seed', ARRAY['work', 'daily'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How did you get into your current field or industry?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How did you get into your current field or industry?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['career', 'background'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you find most rewarding about your work?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you find most rewarding about your work?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['work', 'satisfaction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What are the biggest challenges you face in your current role?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What are the biggest challenges you face in your current role?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['work', 'challenge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you stay updated with developments in your industry?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you stay updated with developments in your industry?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['industry', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What skills have been most valuable in your career so far?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What skills have been most valuable in your career so far?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['skills', 'career'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('If you could change one thing about your current job, what would it be?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'If you could change one thing about your current job, what would it be?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['job', 'improvement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Where do you see your career in five years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Where do you see your career in five years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'goals_future', 'intermediate', 'seed', ARRAY['career', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / study_learning
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is continuing education or professional development in your field?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How important is continuing education or professional development in your field?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'study_learning', 'intermediate', 'seed', ARRAY['education', 'professional'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What advice would you give to someone just starting in your profession?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What advice would you give to someone just starting in your profession?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['advice', 'career'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle career setbacks or disappointments?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle career setbacks or disappointments?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'advanced', 'seed', ARRAY['career', 'resilience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think is more important for career success — technical skills or soft skills?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you think is more important for career success — technical skills or soft skills?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'intermediate', 'seed', ARRAY['skills', 'career'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you evaluate whether a job opportunity is right for you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you evaluate whether a job opportunity is right for you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['career', 'decision'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a successful meeting you organized or contributed to.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a successful meeting you organized or contributed to.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['meeting', 'success'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you prepare for an important meeting or presentation?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you prepare for an important meeting or presentation?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['meeting', 'preparation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What makes an effective presentation? Share some techniques you use.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What makes an effective presentation? Share some techniques you use.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['presentation', 'skills'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle it when you disagree with a colleague during a meeting?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle it when you disagree with a colleague during a meeting?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['conflict', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has remote work changed the way your team communicates?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has remote work changed the way your team communicates?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'intermediate', 'seed', ARRAY['remote-work', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What tools or platforms does your team use to collaborate? Are they effective?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What tools or platforms does your team use to collaborate? Are they effective?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'intermediate', 'seed', ARRAY['tools', 'collaboration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you ensure your written communication at work is clear and professional?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you ensure your written communication at work is clear and professional?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['writing', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Tell me about a time when miscommunication caused a problem at work. How was it resolved?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Tell me about a time when miscommunication caused a problem at work. How was it resolved?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'advanced', 'seed', ARRAY['communication', 'problem-solving'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you worked effectively as part of a team.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a time when you worked effectively as part of a team.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['teamwork', 'success'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think makes a team function well together?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you think makes a team function well together?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'intermediate', 'seed', ARRAY['teamwork', 'dynamics'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle working with someone whose work style is very different from yours?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle working with someone whose work style is very different from yours?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['teamwork', 'adaptability'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Have you ever had to lead a team? What did you learn from the experience?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Have you ever had to lead a team? What did you learn from the experience?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['leadership', 'team'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you motivate team members when morale is low?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you motivate team members when morale is low?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['leadership', 'motivation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your approach to giving constructive feedback to a colleague?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your approach to giving constructive feedback to a colleague?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'people_relationships', 'advanced', 'seed', ARRAY['feedback', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you react when you receive critical feedback about your work?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you react when you receive critical feedback about your work?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'intermediate', 'seed', ARRAY['feedback', 'reaction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a challenging project you worked on and how you managed it.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a challenging project you worked on and how you managed it.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'intermediate', 'seed', ARRAY['project', 'management'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you prioritize tasks when you have multiple deadlines?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you prioritize tasks when you have multiple deadlines?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['prioritization', 'productivity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Tell me about a problem you solved creatively at work.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Tell me about a problem you solved creatively at work.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'advanced', 'seed', ARRAY['problem-solving', 'creativity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle unexpected obstacles or changes in a project?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle unexpected obstacles or changes in a project?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'intermediate', 'seed', ARRAY['adaptability', 'problem-solving'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your process for making an important decision at work?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your process for making an important decision at work?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['decision-making', 'process'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you went above and beyond what was expected of you.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a time when you went above and beyond what was expected of you.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'intermediate', 'seed', ARRAY['initiative', 'achievement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you measure the success of a project you have completed?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you measure the success of a project you have completed?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'intermediate', 'seed', ARRAY['measurement', 'success'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Tell me about yourself and your professional background.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Tell me about yourself and your professional background.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'beginner', 'seed', ARRAY['interview', 'introduction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Why are you interested in this position and what can you bring to the role?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Why are you interested in this position and what can you bring to the role?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['interview', 'motivation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What would you say is your greatest professional strength?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What would you say is your greatest professional strength?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'beginner', 'seed', ARRAY['interview', 'strength'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Can you tell me about a weakness you have and how you are working to improve it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Can you tell me about a weakness you have and how you are working to improve it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['interview', 'weakness'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a difficult situation at work and how you handled it.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a difficult situation at work and how you handled it.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'intermediate', 'seed', ARRAY['interview', 'behavioral'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Where do you see yourself in five years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Where do you see yourself in five years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'goals_future', 'beginner', 'seed', ARRAY['interview', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Why did you leave or why are you considering leaving your current job?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Why did you leave or why are you considering leaving your current job?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['interview', 'transition'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What questions do you have for us about the role or the company?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What questions do you have for us about the role or the company?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['interview', 'questions'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('You need to convince your manager to approve a budget increase for your project. How do you approach this?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'You need to convince your manager to approve a budget increase for your project. How do you approach this?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'persuasion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('A client is unhappy with a deliverable your team provided. How do you handle the situation?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'A client is unhappy with a deliverable your team provided. How do you handle the situation?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'client-relations'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('You have been asked to give a presentation to senior leadership about your team''s quarterly results. How do you prepare?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'You have been asked to give a presentation to senior leadership about your team''s quarterly results. How do you prepare?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'presentation'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Two key team members disagree on the direction of an important project. How do you mediate?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Two key team members disagree on the direction of an important project. How do you mediate?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'conflict-resolution'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Your company is considering expanding into a new market. What factors would you research before making a recommendation?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Your company is considering expanding into a new market. What factors would you research before making a recommendation?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'strategy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('You need to tell your team that the project deadline has been moved up by two weeks. How do you deliver this message?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'You need to tell your team that the project deadline has been moved up by two weeks. How do you deliver this message?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['scenario', 'communication'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has digital transformation affected your industry?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has digital transformation affected your industry?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'advanced', 'seed', ARRAY['digital', 'industry'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What role does data play in decision-making at your organization?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What role does data play in decision-making at your organization?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'intermediate', 'seed', ARRAY['data', 'decision-making'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you think automation will change the way people work in the next decade?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you think automation will change the way people work in the next decade?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'advanced', 'seed', ARRAY['automation', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / technology
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What cybersecurity practices do you think are essential for any business today?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What cybersecurity practices do you think are essential for any business today?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'technology', 'intermediate', 'seed', ARRAY['security', 'business'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What qualities do you think make an effective leader?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What qualities do you think make an effective leader?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'intermediate', 'seed', ARRAY['leadership', 'qualities'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe your management style or the kind of manager you would like to be.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe your management style or the kind of manager you would like to be.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['management', 'style'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you delegate tasks effectively while maintaining accountability?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you delegate tasks effectively while maintaining accountability?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['delegation', 'management'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle an underperforming team member?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle an underperforming team member?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'people_relationships', 'advanced', 'seed', ARRAY['management', 'performance'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the difference between a manager and a leader in your opinion?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is the difference between a manager and a leader in your opinion?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'advanced', 'seed', ARRAY['leadership', 'management'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you create a culture of innovation within a team or organization?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you create a culture of innovation within a team or organization?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['innovation', 'culture'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a time when you had to make an unpopular decision. How did you handle it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a time when you had to make an unpopular decision. How did you handle it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'experiences', 'advanced', 'seed', ARRAY['leadership', 'decision'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you build and maintain professional relationships?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you build and maintain professional relationships?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'people_relationships', 'intermediate', 'seed', ARRAY['networking', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is your approach to networking at professional events?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is your approach to networking at professional events?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'people_relationships', 'intermediate', 'seed', ARRAY['networking', 'events'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / study_learning
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is mentoring in professional development? Have you ever been a mentor or mentee?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How important is mentoring in professional development? Have you ever been a mentor or mentee?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'study_learning', 'intermediate', 'seed', ARRAY['mentoring', 'development'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you handle office politics while staying professional?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you handle office politics while staying professional?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'advanced', 'seed', ARRAY['office-politics', 'professionalism'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you manage work-related stress?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you manage work-related stress?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'emotions', 'intermediate', 'seed', ARRAY['stress', 'management'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What boundaries do you set between work and personal life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What boundaries do you set between work and personal life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'life_routine', 'intermediate', 'seed', ARRAY['work-life-balance', 'boundaries'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / work_career
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has remote or hybrid work affected your productivity and well-being?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has remote or hybrid work affected your productivity and well-being?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'work_career', 'intermediate', 'seed', ARRAY['remote-work', 'well-being'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- professional / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Do you think the traditional 9-to-5 workday is still relevant? Why or why not?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Do you think the traditional 9-to-5 workday is still relevant? Why or why not?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'professional', 'opinions', 'advanced', 'seed', ARRAY['work-culture', 'future'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How would you describe yourself to someone who has never met you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How would you describe yourself to someone who has never met you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'beginner', 'seed', ARRAY['self-description', 'identity'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What values are most important to you in life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What values are most important to you in life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'intermediate', 'seed', ARRAY['values', 'beliefs'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does living a meaningful life mean to you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does living a meaningful life mean to you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['meaning', 'philosophy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How have your priorities changed over the last five years?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How have your priorities changed over the last five years?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['change', 'priorities'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something you used to believe strongly but have since changed your mind about?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something you used to believe strongly but have since changed your mind about?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['beliefs', 'change'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you define personal success for yourself?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you define personal success for yourself?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'intermediate', 'seed', ARRAY['success', 'definition'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What aspects of your personality would you like to develop further?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What aspects of your personality would you like to develop further?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['personality', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What personal goal are you currently working toward?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What personal goal are you currently working toward?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'beginner', 'seed', ARRAY['goal', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is a dream you have had since childhood? Have you pursued it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is a dream you have had since childhood? Have you pursued it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'intermediate', 'seed', ARRAY['dream', 'aspiration'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you stay motivated when working toward long-term goals?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you stay motivated when working toward long-term goals?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'intermediate', 'seed', ARRAY['motivation', 'goals'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something you want to accomplish in the next year?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something you want to accomplish in the next year?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'beginner', 'seed', ARRAY['goal', 'short-term'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you decide which goals are worth pursuing and which to let go of?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you decide which goals are worth pursuing and which to let go of?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'advanced', 'seed', ARRAY['prioritization', 'goals'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / goals_future
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does financial freedom mean to you, and how important is it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does financial freedom mean to you, and how important is it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'goals_future', 'intermediate', 'seed', ARRAY['finance', 'freedom'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('Describe a significant challenge you have overcome in your life.', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'Describe a significant challenge you have overcome in your life.', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['challenge', 'resilience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you typically react when things do not go as planned?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you typically react when things do not go as planned?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['adaptability', 'reaction'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is the most valuable lesson you have learned from a failure?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is the most valuable lesson you have learned from a failure?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['failure', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you maintain a positive mindset during difficult times?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you maintain a positive mindset during difficult times?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['positivity', 'resilience'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What role has adversity played in shaping who you are today?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What role has adversity played in shaping who you are today?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'advanced', 'seed', ARRAY['adversity', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you support others who are going through difficult times?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you support others who are going through difficult times?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'intermediate', 'seed', ARRAY['support', 'empathy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does emotional intelligence mean to you, and how do you practice it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does emotional intelligence mean to you, and how do you practice it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'advanced', 'seed', ARRAY['emotional-intelligence', 'self-awareness'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you recognize when you need a break or a change in your life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you recognize when you need a break or a change in your life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['self-care', 'awareness'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What activities or practices help you feel grounded and centered?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What activities or practices help you feel grounded and centered?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'beginner', 'seed', ARRAY['mindfulness', 'well-being'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has your relationship with yourself changed over time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has your relationship with yourself changed over time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'advanced', 'seed', ARRAY['self-relationship', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you do when you feel overwhelmed by emotions?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you do when you feel overwhelmed by emotions?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['coping', 'emotion'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How important is gratitude in your daily life? How do you practice it?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How important is gratitude in your daily life? How do you practice it?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['gratitude', 'practice'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something that brings you a deep sense of peace?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something that brings you a deep sense of peace?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['peace', 'well-being'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What have you learned about yourself through your relationships with others?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What have you learned about yourself through your relationships with others?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'intermediate', 'seed', ARRAY['relationships', 'self-knowledge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you build trust in a new relationship?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you build trust in a new relationship?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'intermediate', 'seed', ARRAY['trust', 'connection'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What qualities do you most appreciate in the people close to you?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What qualities do you most appreciate in the people close to you?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'beginner', 'seed', ARRAY['appreciation', 'qualities'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you balance your own needs with the needs of others in your life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you balance your own needs with the needs of others in your life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'intermediate', 'seed', ARRAY['balance', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / people_relationships
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What does healthy communication look like to you in close relationships?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What does healthy communication look like to you in close relationships?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'people_relationships', 'intermediate', 'seed', ARRAY['communication', 'relationships'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is something you recently realized about yourself?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is something you recently realized about yourself?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['self-awareness', 'discovery'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you push yourself out of your comfort zone?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you push yourself out of your comfort zone?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['growth', 'challenge'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / study_learning
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What book, podcast, or idea has significantly influenced your personal growth?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What book, podcast, or idea has significantly influenced your personal growth?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'study_learning', 'beginner', 'seed', ARRAY['influence', 'learning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you measure your own personal growth over time?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you measure your own personal growth over time?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['measurement', 'reflection'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / life_routine
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What is a habit you have developed that has positively changed your life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What is a habit you have developed that has positively changed your life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'life_routine', 'beginner', 'seed', ARRAY['habit', 'improvement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you respond to criticism or feedback about your personal behavior?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you respond to criticism or feedback about your personal behavior?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['feedback', 'self-improvement'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What beliefs or principles guide your decisions in life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What beliefs or principles guide your decisions in life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['principles', 'philosophy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How has your perspective on life changed as you have gotten older?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How has your perspective on life changed as you have gotten older?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'intermediate', 'seed', ARRAY['perspective', 'age'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you think is the relationship between happiness and meaning?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you think is the relationship between happiness and meaning?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['happiness', 'philosophy'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / experiences
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('If you could give your younger self one piece of advice, what would it be?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'If you could give your younger self one piece of advice, what would it be?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'experiences', 'intermediate', 'seed', ARRAY['advice', 'reflection'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What do you want to be remembered for?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What do you want to be remembered for?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['legacy', 'meaning'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / emotions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you deal with uncertainty about the future?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you deal with uncertainty about the future?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'emotions', 'intermediate', 'seed', ARRAY['uncertainty', 'coping'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / entertainment
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('What role does creativity play in your personal life?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'What role does creativity play in your personal life?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'entertainment', 'intermediate', 'seed', ARRAY['creativity', 'expression'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  -- personal_growth / opinions
  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('How do you find balance between accepting yourself and striving to improve?', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));
  INSERT INTO speaking_questions (user_id, question, normalized_question, content_hash, mode, topic, difficulty, source_type, tags)
  VALUES (v_uid, 'How do you find balance between accepting yourself and striving to improve?', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), 'personal_growth', 'opinions', 'advanced', 'seed', ARRAY['acceptance', 'growth'])
  ON CONFLICT (user_id, content_hash) DO NOTHING;

  RAISE NOTICE 'Seed questions inserted: %', 350;
END $$;

-- 350 seed questions