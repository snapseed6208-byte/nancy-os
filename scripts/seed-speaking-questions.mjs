import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";

// ── Config ──
const envContent = fs.readFileSync(".env.local", "utf8");
const url = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key);
const USER_ID = "c3afa71b-6994-4028-9df8-8374faa44b3b";

// ── Helpers ──
function normalizeQuestion(q) {
  return q
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentHash(q) {
  return crypto.createHash("sha256").update(normalizeQuestion(q)).digest("hex");
}

// ── Question Data ──
// Each entry: [question, mode, topic, part|null, context|null, cue_points|null, difficulty, source_ref|null, tags[]|null]

/** @type {Array<[string, string, string, string|null, string|null, object|null, string, string|null, string[]|null]>} */
const questions = [
  // ═══════════════════════════════════════════
  // IELTS SPEAKING — Part 1 (~70 questions)
  // ═══════════════════════════════════════════

  // Study & Education
  ["Do you work or are you a student?", "ielts", "study_learning", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["education", "personal"]],
  ["What subject are you studying and why did you choose it?", "ielts", "study_learning", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["education", "motivation"]],
  ["Do you prefer studying alone or in a group?", "ielts", "study_learning", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["education", "preference"]],
  ["What do you find most challenging about your studies?", "ielts", "study_learning", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["education", "challenge"]],
  ["How has your education prepared you for your future career?", "ielts", "study_learning", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["education", "career"]],
  ["What kind of school did you go to as a child?", "ielts", "study_learning", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["education", "childhood"]],
  ["Do you think teachers have an important role in society?", "ielts", "study_learning", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["education", "society"]],
  ["Are there any skills you would like to learn in the future?", "ielts", "study_learning", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["education", "future"]],
  ["How do you usually prepare for exams?", "ielts", "study_learning", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["education", "exam"]],
  ["What do you think makes a good student?", "ielts", "study_learning", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["education", "opinion"]],

  // Work & Career
  ["What is your job and how long have you been doing it?", "ielts", "work_career", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["work", "personal"]],
  ["What do you enjoy most about your work?", "ielts", "work_career", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["work", "satisfaction"]],
  ["Would you like to change your job or career path in the future?", "ielts", "work_career", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["work", "future"]],
  ["What kind of work environment helps you be most productive?", "ielts", "work_career", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["work", "productivity"]],
  ["Do you get along well with your colleagues?", "ielts", "work_career", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["work", "relationships"]],
  ["How important is work-life balance to you?", "ielts", "work_career", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["work", "lifestyle"]],
  ["What was your first job and what did you learn from it?", "ielts", "work_career", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["work", "experience"]],
  ["At what age do you think people should start working?", "ielts", "work_career", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["work", "opinion"]],

  // Daily Life & Routine
  ["What is your typical daily routine like?", "ielts", "life_routine", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["routine", "daily"]],
  ["What do you usually do on weekends?", "ielts", "life_routine", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["weekend", "leisure"]],
  ["How do you usually spend your evenings after work or study?", "ielts", "life_routine", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["evening", "routine"]],
  ["Has your daily routine changed much in the last few years?", "ielts", "life_routine", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["routine", "change"]],
  ["Do you consider yourself an organized person?", "ielts", "life_routine", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["organization", "personality"]],
  ["How do you manage your time between different responsibilities?", "ielts", "life_routine", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["time-management", "productivity"]],
  ["What time of day do you feel most productive?", "ielts", "life_routine", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["productivity", "routine"]],
  ["Do you usually wake up early or stay up late?", "ielts", "life_routine", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["sleep", "habit"]],

  // Travel & Culture
  ["Do you enjoy traveling? What kind of places do you like to visit?", "ielts", "travel_culture", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["travel", "preference"]],
  ["What is the most interesting place you have traveled to?", "ielts", "travel_culture", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["travel", "experience"]],
  ["Do you prefer traveling alone or with others?", "ielts", "travel_culture", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["travel", "preference"]],
  ["How do you usually learn about the culture of a place before visiting?", "ielts", "travel_culture", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["travel", "culture"]],
  ["What forms of transport do you prefer when traveling?", "ielts", "travel_culture", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["transport", "travel"]],
  ["Is there a place you would like to visit again? Why?", "ielts", "travel_culture", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["travel", "reflection"]],

  // Food & Health
  ["What kind of food do you enjoy eating?", "ielts", "food_health", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["food", "preference"]],
  ["How often do you cook at home?", "ielts", "food_health", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["cooking", "food"]],
  ["Do you think your diet is healthy? Why or why not?", "ielts", "food_health", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["diet", "health"]],
  ["What is a traditional dish from your country that you would recommend?", "ielts", "food_health", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["food", "culture"]],
  ["Do you do any sports or regular exercise?", "ielts", "food_health", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["exercise", "health"]],
  ["What do you do to stay healthy?", "ielts", "food_health", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["health", "habit"]],

  // People & Relationships
  ["Tell me about your family. How many people are there in your immediate family?", "ielts", "people_relationships", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["family", "personal"]],
  ["Who are you closest to in your family?", "ielts", "people_relationships", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["family", "relationships"]],
  ["How often do you spend time with your friends?", "ielts", "people_relationships", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["friends", "social"]],
  ["What qualities do you value most in a friend?", "ielts", "people_relationships", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["friendship", "values"]],
  ["Do you think it is better to have a few close friends or many acquaintances?", "ielts", "people_relationships", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["friendship", "opinion"]],
  ["How do you usually keep in touch with friends and family?", "ielts", "people_relationships", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["communication", "relationships"]],

  // Technology
  ["How often do you use your smartphone?", "ielts", "technology", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["technology", "daily"]],
  ["What is your favorite app and why?", "ielts", "technology", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["app", "technology"]],
  ["How has technology changed the way you communicate with others?", "ielts", "technology", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["technology", "communication"]],
  ["Do you think people rely too much on technology these days?", "ielts", "technology", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["technology", "opinion"]],
  ["What piece of technology could you not live without?", "ielts", "technology", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["technology", "necessity"]],
  ["Do you enjoy keeping up with the latest gadgets and technology news?", "ielts", "technology", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["technology", "interest"]],

  // Entertainment
  ["What type of music do you enjoy listening to?", "ielts", "entertainment", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["music", "preference"]],
  ["Do you play any musical instruments or sing?", "ielts", "entertainment", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["music", "skill"]],
  ["What kind of movies or TV shows do you prefer?", "ielts", "entertainment", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["movies", "preference"]],
  ["Do you prefer watching films at home or in the cinema?", "ielts", "entertainment", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["movies", "preference"]],
  ["How often do you read books for pleasure?", "ielts", "entertainment", "part1", null, null, "beginner", "ielts-academic.com/sample-questions", ["reading", "habit"]],
  ["What was the last book you read and did you enjoy it?", "ielts", "entertainment", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["reading", "experience"]],

  // Experiences
  ["What is one of your happiest childhood memories?", "ielts", "experiences", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["childhood", "memory"]],
  ["Have you ever tried a new activity that surprised you?", "ielts", "experiences", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["experience", "discovery"]],
  ["What is the most important decision you have made in your life?", "ielts", "experiences", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["decision", "life"]],
  ["Do you enjoy trying new things or do you prefer familiar experiences?", "ielts", "experiences", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["preference", "experience"]],
  ["Can you describe a time when you helped someone?", "ielts", "experiences", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["help", "experience"]],
  ["What is something you have done that you are proud of?", "ielts", "experiences", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["pride", "achievement"]],

  // Opinions
  ["Do you prefer living in a big city or a small town? Why?", "ielts", "opinions", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["lifestyle", "preference"]],
  ["What do you think makes a person successful?", "ielts", "opinions", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["success", "opinion"]],
  ["What kinds of things make you feel happy?", "ielts", "emotions", "part1", null, null, "beginner", "ieltsliz.com/ielts-speaking-part-1-topics", ["happiness", "emotion"]],
  ["How do you usually deal with stress?", "ielts", "emotions", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["stress", "coping"]],

  // Goals & Future
  ["What are your main goals for the next five years?", "ielts", "goals_future", "part1", null, null, "intermediate", "ielts-academic.com/sample-questions", ["goals", "future"]],
  ["Where do you see yourself living in the future?", "ielts", "goals_future", "part1", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-1-topics", ["future", "lifestyle"]],

  // ═══════════════════════════════════════════
  // IELTS SPEAKING — Part 2 (~70 questions)
  // ═══════════════════════════════════════════

  // People
  ["Describe a person who has had a significant influence on your life.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this person is", "how you know this person", "what influence they have had on you", "and explain why this person is important to you"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["person", "influence"]],
  ["Describe a family member you admire.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this family member is", "what your relationship is like", "what qualities they have", "and explain why you admire them"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["family", "admiration"]],
  ["Describe a good friend you have known for a long time.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this friend is", "how and when you first met", "what you do together", "and explain why your friendship has lasted"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["friend", "relationship"]],
  ["Describe a neighbor you remember well.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this neighbor was", "where you lived at the time", "what kind of person they were", "and explain why you remember them well"] },
    "intermediate", "ielts-academic.com/cue-cards", ["neighbor", "memory"]],
  ["Describe an interesting person you met recently.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this person is", "when and where you met them", "what you talked about", "and explain why you found them interesting"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["person", "encounter"]],
  ["Describe someone who is very good at their job.", "ielts", "work_career", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this person is", "what their job is", "what skills or qualities make them good at their job", "and explain what you can learn from them"] },
    "intermediate", "ielts-academic.com/cue-cards", ["work", "skill"]],
  ["Describe a person you admire for their creativity.", "ielts", "people_relationships", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this person is", "how you know about them", "what creative things they do", "and explain why you admire their creativity"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["creativity", "admiration"]],
  ["Describe a teacher who had a positive impact on you.", "ielts", "study_learning", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this teacher was", "what subject they taught", "what made them special", "and explain how they influenced you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["teacher", "education"]],

  // Places
  ["Describe a place you would like to visit in the future.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where this place is", "what you know about this place", "what you would like to do there", "and explain why you want to visit this place"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["travel", "future"]],
  ["Describe your favorite room in your home.", "ielts", "life_routine", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["which room it is", "what it looks like", "what you usually do in this room", "and explain why it is your favorite"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["home", "comfort"]],
  ["Describe a city you have visited that you really liked.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["which city it was", "when you visited it", "what you did there", "and explain why you liked it so much"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["city", "travel"]],
  ["Describe a quiet place you like to go to.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where this place is", "how you discovered it", "what you do there", "and explain why you find it peaceful"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["place", "peace"]],
  ["Describe a public building you have visited that impressed you.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what building it is", "where it is located", "when you visited it", "and explain why it impressed you"] },
    "intermediate", "ielts-academic.com/cue-cards", ["architecture", "impression"]],
  ["Describe a place near water that you have visited.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where this place is", "when you went there", "what you did there", "and explain how you felt being near the water"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["water", "nature"]],

  // Events & Experiences
  ["Describe a memorable trip you have taken.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where you went", "who you went with", "what you did during the trip", "and explain why this trip was memorable"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["trip", "memory"]],
  ["Describe a special event or celebration you attended.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the event was", "when and where it took place", "who was there", "and explain why it was special to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["event", "celebration"]],
  ["Describe an achievement you are proud of.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what you achieved", "when it happened", "what you did to achieve it", "and explain why you feel proud of it"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["achievement", "pride"]],
  ["Describe a time when you had to make a difficult decision.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the decision was about", "when you had to make it", "what factors you considered", "and explain how you felt after making the decision"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["decision", "challenge"]],
  ["Describe a time when you learned something new.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what you learned", "when and where you learned it", "who taught you or how you learned", "and explain how this new knowledge or skill has been useful"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["learning", "experience"]],
  ["Describe a time when you helped a stranger.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["when and where it happened", "who the stranger was", "what kind of help you gave", "and explain how you felt afterward"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["help", "kindness"]],
  ["Describe an outdoor activity you enjoy doing.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what activity it is", "when and where you usually do it", "who you do it with", "and explain why you enjoy this outdoor activity"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["activity", "outdoor"]],
  ["Describe a difficult challenge you overcame.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the challenge was", "when you faced it", "what steps you took to overcome it", "and explain what you learned from the experience"] },
    "intermediate", "ielts-academic.com/cue-cards", ["challenge", "growth"]],
  ["Describe a time when you received good news.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the news was about", "when you received it", "how you reacted", "and explain why this news was important to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["news", "emotion"]],
  ["Describe a time you gave advice to someone.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who you gave advice to", "what the situation was", "what advice you gave", "and explain whether the advice was helpful"] },
    "intermediate", "ielts-academic.com/cue-cards", ["advice", "help"]],

  // Objects & Possessions
  ["Describe an item of clothing you like wearing.", "ielts", "entertainment", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the item is", "when you got it", "how often you wear it", "and explain why you like it"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["fashion", "personal"]],
  ["Describe a gift you received that was special to you.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the gift was", "who gave it to you", "on what occasion you received it", "and explain why it was special to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["gift", "memory"]],
  ["Describe a piece of technology you use frequently.", "ielts", "technology", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the technology is", "how long you have had it", "how you use it in your daily life", "and explain why it is important to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["technology", "daily-use"]],
  ["Describe a photograph that means a lot to you.", "ielts", "experiences", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the photograph shows", "when and where it was taken", "who took the photograph", "and explain why it is meaningful to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["photo", "memory"]],
  ["Describe a book that had an impact on your thinking.", "ielts", "entertainment", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the book is", "when you read it", "what it is about", "and explain how it influenced your thinking"] },
    "intermediate", "ieltsliz.com/ielts-speaking-part-2-topics", ["book", "influence"]],
  ["Describe a useful app or website that you often use.", "ielts", "technology", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the app or website is", "how you discovered it", "what you use it for", "and explain why you find it useful"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["technology", "utility"]],
  ["Describe something you own that you would like to replace.", "ielts", "technology", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the item is", "how long you have had it", "what problems it has", "and explain why you want to replace it"] },
    "intermediate", "ielts-academic.com/cue-cards", ["possession", "upgrade"]],

  // Food & Health
  ["Describe a memorable meal you have had.", "ielts", "food_health", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["when and where you had this meal", "what you ate", "who you were with", "and explain why this meal was memorable"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["food", "memory"]],
  ["Describe a restaurant you enjoy going to.", "ielts", "food_health", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where the restaurant is", "what kind of food it serves", "how often you go there", "and explain why you enjoy it"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["restaurant", "food"]],
  ["Describe a healthy habit you have or would like to develop.", "ielts", "food_health", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the habit is", "how you started or plan to start it", "what benefits it brings", "and explain why this habit is important for health"] },
    "intermediate", "ielts-academic.com/cue-cards", ["health", "habit"]],

  // Entertainment & Media
  ["Describe a movie or TV series that you particularly enjoyed.", "ielts", "entertainment", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the movie or series is", "what it is about", "when you watched it", "and explain why you enjoyed it so much"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["movie", "entertainment"]],
  ["Describe a song or piece of music that is meaningful to you.", "ielts", "entertainment", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the song or piece is", "when you first heard it", "what it makes you think or feel", "and explain why it is meaningful to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["music", "meaning"]],
  ["Describe a news story you found interesting recently.", "ielts", "entertainment", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the story was about", "how you heard about it", "what your reaction was", "and explain why you found it interesting"] },
    "intermediate", "ielts-academic.com/cue-cards", ["news", "interest"]],

  // Nature & Environment
  ["Describe a natural place you find beautiful.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["where this place is", "what it looks like", "when you first went there", "and explain why you find it beautiful"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["nature", "beauty"]],
  ["Describe something you do to help protect the environment.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what you do", "how often you do it", "why you started doing it", "and explain how it helps the environment"] },
    "intermediate", "ielts-academic.com/cue-cards", ["environment", "action"]],
  ["Describe a type of weather that you particularly enjoy.", "ielts", "travel_culture", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what type of weather it is", "when you typically experience it", "what you like to do in this weather", "and explain why you enjoy it"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["weather", "preference"]],

  // Skills & Learning
  ["Describe a skill that took you a long time to learn.", "ielts", "study_learning", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the skill is", "how you learned it", "what difficulties you faced", "and explain how you felt when you finally mastered it"] },
    "intermediate", "ielts-academic.com/cue-cards", ["skill", "learning"]],
  ["Describe a language you would like to learn.", "ielts", "study_learning", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what language it is", "why you want to learn it", "how you plan to learn it", "and explain what challenges you might face"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["language", "learning"]],
  ["Describe an interesting course or class you have taken.", "ielts", "study_learning", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the course was about", "when and where you took it", "what you learned from it", "and explain why you found it interesting"] },
    "intermediate", "ielts-academic.com/cue-cards", ["course", "education"]],

  // Career & Goals
  ["Describe your dream job.", "ielts", "work_career", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the job is", "what responsibilities it involves", "what skills are needed", "and explain why this is your dream job"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["career", "dream"]],
  ["Describe a successful businessperson you know or have heard about.", "ielts", "work_career", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["who this person is", "what they do", "how they became successful", "and explain what you admire about them"] },
    "intermediate", "ielts-academic.com/cue-cards", ["business", "success"]],
  ["Describe a goal you have set for yourself.", "ielts", "goals_future", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what the goal is", "when you set this goal", "what steps you are taking to achieve it", "and explain why this goal is important to you"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["goal", "future"]],
  ["Describe something you would like to achieve in your career.", "ielts", "goals_future", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["what you would like to achieve", "how long you have had this ambition", "what you need to do to achieve it", "and explain why it matters to you"] },
    "intermediate", "ielts-academic.com/cue-cards", ["career", "ambition"]],

  // Emotions & Feelings
  ["Describe a time when you felt really happy.", "ielts", "emotions", "part2",
    "You should speak for 1-2 minutes on this topic.",
    { bullets: ["when and where it happened", "what made you happy", "who you were with", "and explain why this moment stands out in your memory"] },
    "beginner", "ieltsliz.com/ielts-speaking-part-2-topics", ["happiness", "memory"]],

  // ═══════════════════════════════════════════
  // IELTS SPEAKING — Part 3 (~60 questions)
  // ═══════════════════════════════════════════

  // Education
  ["How has the education system in your country changed in recent years?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "change"]],
  ["Do you think university education should be free for everyone? Why or why not?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "policy"]],
  ["What skills do you think schools should teach that they currently do not?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "skills"]],
  ["How important is it for children to learn a foreign language?", "ielts", "study_learning", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["language", "education"]],
  ["Do you think online learning can ever fully replace in-person education?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "technology"]],
  ["What role should parents play in their children's education?", "ielts", "study_learning", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "parenting"]],
  ["How do you think education will change in the next 20 years?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "future"]],
  ["Is academic success the most important factor for a successful career?", "ielts", "study_learning", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "career"]],

  // Technology
  ["How has technology changed the way people interact with each other?", "ielts", "technology", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["technology", "society"]],
  ["Do you think artificial intelligence will replace many jobs in the future?", "ielts", "technology", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["ai", "jobs"]],
  ["What are the advantages and disadvantages of children using smartphones?", "ielts", "technology", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["technology", "children"]],
  ["How has social media changed society?", "ielts", "technology", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["social-media", "society"]],
  ["Do older people and younger people use technology differently?", "ielts", "technology", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["technology", "generation"]],
  ["What kinds of technology do you think will be most important in the future?", "ielts", "technology", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["technology", "future"]],

  // Work & Career
  ["What factors do people consider when choosing a career?", "ielts", "work_career", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["career", "choice"]],
  ["Do you think job satisfaction is more important than a high salary?", "ielts", "work_career", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["work", "values"]],
  ["How has the nature of work changed in the last few decades?", "ielts", "work_career", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["work", "change"]],
  ["What makes a good leader in the workplace?", "ielts", "work_career", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["leadership", "work"]],

  // Environment
  ["What are the most serious environmental problems facing your country?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["environment", "problem"]],
  ["Whose responsibility is it to protect the environment — individuals or governments?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["environment", "responsibility"]],
  ["How can individuals be encouraged to live more sustainably?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["sustainability", "behavior"]],
  ["Do you think eco-tourism has a positive or negative impact on the environment?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["tourism", "environment"]],

  // Culture & Tourism
  ["How does tourism affect local communities?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["tourism", "community"]],
  ["Do you think cultural traditions are being lost because of globalization?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["culture", "globalization"]],
  ["What can people learn from visiting other countries?", "ielts", "travel_culture", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["travel", "learning"]],
  ["How has international travel changed compared to 30 years ago?", "ielts", "travel_culture", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["travel", "change"]],

  // Relationships & Society
  ["How have family structures changed in recent decades?", "ielts", "people_relationships", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["family", "change"]],
  ["Do you think the quality of friendships has changed with the rise of social media?", "ielts", "people_relationships", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["friendship", "social-media"]],
  ["What qualities do you think are most important for maintaining a long-term relationship?", "ielts", "people_relationships", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["relationships", "qualities"]],
  ["How important is it for elderly people to stay connected with younger generations?", "ielts", "people_relationships", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["generation", "connection"]],

  // Health
  ["How have eating habits changed in your country over the years?", "ielts", "food_health", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["food", "change"]],
  ["What are the main causes of unhealthy eating in modern society?", "ielts", "food_health", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["food", "health"]],
  ["Do you think governments should regulate the fast food industry more strictly?", "ielts", "food_health", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["regulation", "health"]],
  ["How can schools encourage children to develop healthy eating habits?", "ielts", "food_health", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["education", "health"]],

  // Entertainment & Media
  ["How has the way people consume entertainment changed in the digital age?", "ielts", "entertainment", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["entertainment", "digital"]],
  ["Do you think violent content in movies and games affects people's behavior?", "ielts", "entertainment", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["media", "behavior"]],
  ["What role does music play in people's lives?", "ielts", "entertainment", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["music", "society"]],
  ["Do you think reading habits are declining? What can be done about it?", "ielts", "entertainment", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["reading", "habit"]],

  // Life & Society
  ["Why do some people enjoy taking risks while others prefer security?", "ielts", "opinions", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["risk", "psychology"]],
  ["Do you think failure is a necessary part of success?", "ielts", "opinions", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["failure", "success"]],
  ["How important is it for young people to set long-term goals?", "ielts", "goals_future", "part3", null, null, "intermediate", "ieltsliz.com/ielts-speaking-part-3-topics", ["goals", "youth"]],
  ["What do you think are the biggest challenges the next generation will face?", "ielts", "goals_future", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["future", "challenge"]],
  ["Do you think people are generally happier now than they were in the past?", "ielts", "emotions", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["happiness", "society"]],
  ["What can employers do to support the mental health of their workers?", "ielts", "emotions", "part3", null, null, "advanced", "ieltsliz.com/ielts-speaking-part-3-topics", ["mental-health", "work"]],

  // ═══════════════════════════════════════════
  // DAILY CONVERSATION (~100 questions)
  // ═══════════════════════════════════════════

  // Daily Routine
  ["What time do you usually get up in the morning and why?", "daily", "life_routine", null, null, null, "beginner", null, ["routine", "morning"]],
  ["Tell me about your morning routine. What do you do before you leave home?", "daily", "life_routine", null, null, null, "beginner", null, ["routine", "morning"]],
  ["How does your routine change on weekends compared to weekdays?", "daily", "life_routine", null, null, null, "beginner", null, ["routine", "weekend"]],
  ["What is your favorite part of the day and why?", "daily", "life_routine", null, null, null, "beginner", null, ["routine", "preference"]],
  ["How do you usually relax after a long day?", "daily", "life_routine", null, null, null, "beginner", null, ["relaxation", "routine"]],
  ["Describe how you organize your daily tasks and responsibilities.", "daily", "life_routine", null, null, null, "intermediate", null, ["organization", "productivity"]],
  ["What do you usually do when you have a free day with no plans?", "daily", "life_routine", null, null, null, "beginner", null, ["free-time", "leisure"]],
  ["Has your daily routine changed much in the past year? How?", "daily", "life_routine", null, null, null, "intermediate", null, ["routine", "change"]],

  // Food & Cooking
  ["What do you usually have for breakfast?", "daily", "food_health", null, null, null, "beginner", null, ["food", "breakfast"]],
  ["Do you enjoy cooking? What is your signature dish?", "daily", "food_health", null, null, null, "beginner", null, ["cooking", "food"]],
  ["What kind of restaurants do you like to go to and how often do you eat out?", "daily", "food_health", null, null, null, "beginner", null, ["restaurant", "food"]],
  ["If you had guests coming for dinner, what would you cook for them?", "daily", "food_health", null, null, null, "intermediate", null, ["cooking", "hospitality"]],
  ["How do you decide what groceries to buy each week?", "daily", "food_health", null, null, null, "beginner", null, ["shopping", "food"]],
  ["What is a food from your childhood that brings back memories?", "daily", "food_health", null, null, null, "intermediate", null, ["food", "memory"]],
  ["Do you have any dietary restrictions or preferences? How do they affect your daily life?", "daily", "food_health", null, null, null, "intermediate", null, ["diet", "lifestyle"]],
  ["What do you think about food delivery apps? Do you use them often?", "daily", "food_health", null, null, null, "beginner", null, ["food-delivery", "technology"]],

  // Shopping
  ["Do you enjoy shopping? What do you usually shop for?", "daily", "life_routine", null, null, null, "beginner", null, ["shopping", "preference"]],
  ["Do you prefer shopping online or in physical stores? Why?", "daily", "life_routine", null, null, null, "beginner", null, ["shopping", "preference"]],
  ["How do you decide whether something is worth buying?", "daily", "life_routine", null, null, null, "intermediate", null, ["shopping", "decision"]],
  ["What was the last thing you bought that you were really happy with?", "daily", "life_routine", null, null, null, "beginner", null, ["shopping", "satisfaction"]],
  ["Do you compare prices before making a purchase? How?", "daily", "life_routine", null, null, null, "beginner", null, ["shopping", "habit"]],
  ["Have you ever regretted buying something? What was it?", "daily", "life_routine", null, null, null, "intermediate", null, ["shopping", "regret"]],

  // Transportation & Travel
  ["How do you usually get around your city?", "daily", "travel_culture", null, null, null, "beginner", null, ["transport", "daily"]],
  ["What is public transportation like in your area?", "daily", "travel_culture", null, null, null, "beginner", null, ["transport", "infrastructure"]],
  ["How do you plan a trip? What do you research before you go?", "daily", "travel_culture", null, null, null, "intermediate", null, ["travel", "planning"]],
  ["What is the best trip you have ever taken? What made it special?", "daily", "travel_culture", null, null, null, "beginner", null, ["travel", "experience"]],
  ["Do you prefer traveling to big cities or natural landscapes?", "daily", "travel_culture", null, null, null, "beginner", null, ["travel", "preference"]],
  ["What do you usually pack when you go on a trip?", "daily", "travel_culture", null, null, null, "beginner", null, ["travel", "packing"]],
  ["Have you ever had a travel mishap or something go wrong during a trip?", "daily", "travel_culture", null, null, null, "intermediate", null, ["travel", "problem"]],
  ["What is something tourists should know before visiting your country?", "daily", "travel_culture", null, null, null, "intermediate", null, ["travel", "advice"]],

  // Social & Relationships
  ["How do you usually spend time with your friends?", "daily", "people_relationships", null, null, null, "beginner", null, ["friends", "social"]],
  ["How do you make new friends as an adult?", "daily", "people_relationships", null, null, null, "intermediate", null, ["friendship", "social"]],
  ["What do you talk about when you meet someone for the first time?", "daily", "people_relationships", null, null, null, "beginner", null, ["conversation", "social"]],
  ["How do you keep in touch with friends who live far away?", "daily", "people_relationships", null, null, null, "beginner", null, ["friendship", "communication"]],
  ["What makes a great party or social gathering in your opinion?", "daily", "people_relationships", null, null, null, "intermediate", null, ["social", "opinion"]],
  ["Do you find it easy to start conversations with strangers?", "daily", "people_relationships", null, null, null, "intermediate", null, ["conversation", "social-skill"]],
  ["How do you handle disagreements with friends?", "daily", "people_relationships", null, null, null, "intermediate", null, ["conflict", "friendship"]],
  ["What qualities do you look for when meeting new people?", "daily", "people_relationships", null, null, null, "intermediate", null, ["friendship", "values"]],

  // Hobbies & Free Time
  ["What do you like to do in your free time?", "daily", "entertainment", null, null, null, "beginner", null, ["hobby", "leisure"]],
  ["Is there a hobby you have always wanted to try but have not started yet?", "daily", "entertainment", null, null, null, "beginner", null, ["hobby", "aspiration"]],
  ["How much time do you spend watching TV or streaming content each week?", "daily", "entertainment", null, null, null, "beginner", null, ["tv", "habit"]],
  ["Do you prefer indoor or outdoor activities? Why?", "daily", "entertainment", null, null, null, "beginner", null, ["activity", "preference"]],
  ["What kind of music do you listen to while doing daily tasks?", "daily", "entertainment", null, null, null, "beginner", null, ["music", "routine"]],
  ["Do you enjoy watching sports? Which ones and why?", "daily", "entertainment", null, null, null, "beginner", null, ["sports", "entertainment"]],
  ["Have you recently discovered a new hobby or interest?", "daily", "entertainment", null, null, null, "beginner", null, ["hobby", "discovery"]],
  ["How do you decide how to spend your leisure time when you have multiple options?", "daily", "entertainment", null, null, null, "intermediate", null, ["leisure", "decision"]],

  // Technology & Digital Life
  ["How many hours a day do you think you spend on your phone?", "daily", "technology", null, null, null, "beginner", null, ["phone", "habit"]],
  ["Which apps do you use the most in your daily life?", "daily", "technology", null, null, null, "beginner", null, ["apps", "daily"]],
  ["How do you stay organized — do you use any digital tools or apps?", "daily", "technology", null, null, null, "intermediate", null, ["organization", "technology"]],
  ["Do you think you spend too much time online? Why or why not?", "daily", "technology", null, null, null, "intermediate", null, ["internet", "habit"]],
  ["How has the internet changed the way you handle everyday tasks?", "daily", "technology", null, null, null, "intermediate", null, ["internet", "daily-life"]],
  ["What is one piece of technology you think has made your life significantly better?", "daily", "technology", null, null, null, "intermediate", null, ["technology", "improvement"]],
  ["How do you feel when you forget your phone at home?", "daily", "technology", null, null, null, "beginner", null, ["phone", "emotion"]],

  // Home & Living
  ["Describe the neighborhood or area where you live.", "daily", "life_routine", null, null, null, "beginner", null, ["home", "neighborhood"]],
  ["What do you like most about your current home?", "daily", "life_routine", null, null, null, "beginner", null, ["home", "preference"]],
  ["If you could change one thing about your living situation, what would it be?", "daily", "life_routine", null, null, null, "intermediate", null, ["home", "improvement"]],
  ["How do you make your living space feel comfortable and personal?", "daily", "life_routine", null, null, null, "intermediate", null, ["home", "decoration"]],
  ["What is your relationship like with your neighbors?", "daily", "people_relationships", null, null, null, "beginner", null, ["neighbor", "community"]],

  // Weather & Seasons
  ["What is the weather usually like where you live at this time of year?", "daily", "travel_culture", null, null, null, "beginner", null, ["weather", "climate"]],
  ["How does the weather affect your mood and daily activities?", "daily", "travel_culture", null, null, null, "intermediate", null, ["weather", "mood"]],
  ["What is your favorite season and what do you like to do during that time?", "daily", "travel_culture", null, null, null, "beginner", null, ["season", "preference"]],
  ["Have you ever experienced extreme weather? What happened?", "daily", "travel_culture", null, null, null, "intermediate", null, ["weather", "experience"]],

  // Health & Wellness
  ["What do you usually do when you feel stressed?", "daily", "emotions", null, null, null, "beginner", null, ["stress", "coping"]],
  ["How important is sleep to you? Do you have any bedtime routines?", "daily", "food_health", null, null, null, "beginner", null, ["sleep", "health"]],
  ["Do you pay attention to your mental health? What do you do to take care of it?", "daily", "emotions", null, null, null, "intermediate", null, ["mental-health", "self-care"]],
  ["What kind of exercise do you do and how does it make you feel?", "daily", "food_health", null, null, null, "beginner", null, ["exercise", "health"]],
  ["How do you motivate yourself to do things when you are feeling tired or lazy?", "daily", "emotions", null, null, null, "intermediate", null, ["motivation", "habit"]],
  ["What does a healthy lifestyle mean to you personally?", "daily", "food_health", null, null, null, "intermediate", null, ["health", "lifestyle"]],

  // Personal Habits & Thoughts
  ["What is something in your daily life that you think could be improved?", "daily", "opinions", null, null, null, "beginner", null, ["improvement", "daily-life"]],
  ["Do you think people today are busier than people in the past?", "daily", "opinions", null, null, null, "intermediate", null, ["lifestyle", "comparison"]],
  ["What is a small thing that can make a big difference to your day?", "daily", "opinions", null, null, null, "beginner", null, ["happiness", "daily-life"]],
  ["How do you handle it when your plans for the day get disrupted?", "daily", "experiences", null, null, null, "intermediate", null, ["adaptability", "routine"]],
  ["What does a perfect day look like to you?", "daily", "opinions", null, null, null, "beginner", null, ["ideal", "lifestyle"]],
  ["Do you think it is better to plan everything in advance or be spontaneous?", "daily", "opinions", null, null, null, "intermediate", null, ["planning", "lifestyle"]],
  ["What is something you have learned from making a mistake?", "daily", "experiences", null, null, null, "intermediate", null, ["learning", "mistake"]],
  ["How do you balance different areas of your life such as work, relationships, and personal time?", "daily", "life_routine", null, null, null, "intermediate", null, ["balance", "lifestyle"]],

  // ═══════════════════════════════════════════
  // PROFESSIONAL ENGLISH (~100 questions)
  // ═══════════════════════════════════════════

  // Job & Role
  ["Describe your current job role and your main responsibilities.", "professional", "work_career", null, null, null, "beginner", null, ["job", "responsibility"]],
  ["What does a typical day at work look like for you?", "professional", "work_career", null, null, null, "beginner", null, ["work", "daily"]],
  ["How did you get into your current field or industry?", "professional", "work_career", null, null, null, "intermediate", null, ["career", "background"]],
  ["What do you find most rewarding about your work?", "professional", "work_career", null, null, null, "intermediate", null, ["work", "satisfaction"]],
  ["What are the biggest challenges you face in your current role?", "professional", "work_career", null, null, null, "intermediate", null, ["work", "challenge"]],
  ["How do you stay updated with developments in your industry?", "professional", "work_career", null, null, null, "intermediate", null, ["industry", "learning"]],
  ["What skills have been most valuable in your career so far?", "professional", "work_career", null, null, null, "intermediate", null, ["skills", "career"]],
  ["If you could change one thing about your current job, what would it be?", "professional", "work_career", null, null, null, "intermediate", null, ["job", "improvement"]],
  ["Where do you see your career in five years?", "professional", "goals_future", null, null, null, "intermediate", null, ["career", "future"]],
  ["How important is continuing education or professional development in your field?", "professional", "study_learning", null, null, null, "intermediate", null, ["education", "professional"]],
  ["What advice would you give to someone just starting in your profession?", "professional", "work_career", null, null, null, "intermediate", null, ["advice", "career"]],
  ["How do you handle career setbacks or disappointments?", "professional", "experiences", null, null, null, "advanced", null, ["career", "resilience"]],
  ["What do you think is more important for career success — technical skills or soft skills?", "professional", "opinions", null, null, null, "intermediate", null, ["skills", "career"]],
  ["How do you evaluate whether a job opportunity is right for you?", "professional", "work_career", null, null, null, "intermediate", null, ["career", "decision"]],

  // Meetings & Communication
  ["Describe a successful meeting you organized or contributed to.", "professional", "work_career", null, null, null, "intermediate", null, ["meeting", "success"]],
  ["How do you prepare for an important meeting or presentation?", "professional", "work_career", null, null, null, "intermediate", null, ["meeting", "preparation"]],
  ["What makes an effective presentation? Share some techniques you use.", "professional", "work_career", null, null, null, "intermediate", null, ["presentation", "skills"]],
  ["How do you handle it when you disagree with a colleague during a meeting?", "professional", "work_career", null, null, null, "advanced", null, ["conflict", "communication"]],
  ["How has remote work changed the way your team communicates?", "professional", "technology", null, null, null, "intermediate", null, ["remote-work", "communication"]],
  ["What tools or platforms does your team use to collaborate? Are they effective?", "professional", "technology", null, null, null, "intermediate", null, ["tools", "collaboration"]],
  ["How do you ensure your written communication at work is clear and professional?", "professional", "work_career", null, null, null, "intermediate", null, ["writing", "communication"]],
  ["Tell me about a time when miscommunication caused a problem at work. How was it resolved?", "professional", "experiences", null, null, null, "advanced", null, ["communication", "problem-solving"]],

  // Teamwork
  ["Describe a time when you worked effectively as part of a team.", "professional", "work_career", null, null, null, "intermediate", null, ["teamwork", "success"]],
  ["What do you think makes a team function well together?", "professional", "opinions", null, null, null, "intermediate", null, ["teamwork", "dynamics"]],
  ["How do you handle working with someone whose work style is very different from yours?", "professional", "work_career", null, null, null, "advanced", null, ["teamwork", "adaptability"]],
  ["Have you ever had to lead a team? What did you learn from the experience?", "professional", "work_career", null, null, null, "intermediate", null, ["leadership", "team"]],
  ["How do you motivate team members when morale is low?", "professional", "work_career", null, null, null, "advanced", null, ["leadership", "motivation"]],
  ["What is your approach to giving constructive feedback to a colleague?", "professional", "people_relationships", null, null, null, "advanced", null, ["feedback", "communication"]],
  ["How do you react when you receive critical feedback about your work?", "professional", "experiences", null, null, null, "intermediate", null, ["feedback", "reaction"]],

  // Problem Solving & Projects
  ["Describe a challenging project you worked on and how you managed it.", "professional", "experiences", null, null, null, "intermediate", null, ["project", "management"]],
  ["How do you prioritize tasks when you have multiple deadlines?", "professional", "work_career", null, null, null, "intermediate", null, ["prioritization", "productivity"]],
  ["Tell me about a problem you solved creatively at work.", "professional", "experiences", null, null, null, "advanced", null, ["problem-solving", "creativity"]],
  ["How do you handle unexpected obstacles or changes in a project?", "professional", "experiences", null, null, null, "intermediate", null, ["adaptability", "problem-solving"]],
  ["What is your process for making an important decision at work?", "professional", "work_career", null, null, null, "intermediate", null, ["decision-making", "process"]],
  ["Describe a time when you went above and beyond what was expected of you.", "professional", "experiences", null, null, null, "intermediate", null, ["initiative", "achievement"]],
  ["How do you measure the success of a project you have completed?", "professional", "opinions", null, null, null, "intermediate", null, ["measurement", "success"]],

  // Job Interview Practice
  ["Tell me about yourself and your professional background.", "professional", "work_career", null, null, null, "beginner", null, ["interview", "introduction"]],
  ["Why are you interested in this position and what can you bring to the role?", "professional", "work_career", null, null, null, "intermediate", null, ["interview", "motivation"]],
  ["What would you say is your greatest professional strength?", "professional", "work_career", null, null, null, "beginner", null, ["interview", "strength"]],
  ["Can you tell me about a weakness you have and how you are working to improve it?", "professional", "work_career", null, null, null, "intermediate", null, ["interview", "weakness"]],
  ["Describe a difficult situation at work and how you handled it.", "professional", "experiences", null, null, null, "intermediate", null, ["interview", "behavioral"]],
  ["Where do you see yourself in five years?", "professional", "goals_future", null, null, null, "beginner", null, ["interview", "future"]],
  ["Why did you leave or why are you considering leaving your current job?", "professional", "work_career", null, null, null, "intermediate", null, ["interview", "transition"]],
  ["What questions do you have for us about the role or the company?", "professional", "work_career", null, null, null, "intermediate", null, ["interview", "questions"]],

  // Business Scenarios
  ["You need to convince your manager to approve a budget increase for your project. How do you approach this?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "persuasion"]],
  ["A client is unhappy with a deliverable your team provided. How do you handle the situation?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "client-relations"]],
  ["You have been asked to give a presentation to senior leadership about your team's quarterly results. How do you prepare?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "presentation"]],
  ["Two key team members disagree on the direction of an important project. How do you mediate?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "conflict-resolution"]],
  ["Your company is considering expanding into a new market. What factors would you research before making a recommendation?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "strategy"]],
  ["You need to tell your team that the project deadline has been moved up by two weeks. How do you deliver this message?", "professional", "work_career", null, null, null, "advanced", null, ["scenario", "communication"]],

  // Technology in Business
  ["How has digital transformation affected your industry?", "professional", "technology", null, null, null, "advanced", null, ["digital", "industry"]],
  ["What role does data play in decision-making at your organization?", "professional", "technology", null, null, null, "intermediate", null, ["data", "decision-making"]],
  ["How do you think automation will change the way people work in the next decade?", "professional", "technology", null, null, null, "advanced", null, ["automation", "future"]],
  ["What cybersecurity practices do you think are essential for any business today?", "professional", "technology", null, null, null, "intermediate", null, ["security", "business"]],

  // Leadership
  ["What qualities do you think make an effective leader?", "professional", "opinions", null, null, null, "intermediate", null, ["leadership", "qualities"]],
  ["Describe your management style or the kind of manager you would like to be.", "professional", "work_career", null, null, null, "intermediate", null, ["management", "style"]],
  ["How do you delegate tasks effectively while maintaining accountability?", "professional", "work_career", null, null, null, "advanced", null, ["delegation", "management"]],
  ["How do you handle an underperforming team member?", "professional", "people_relationships", null, null, null, "advanced", null, ["management", "performance"]],
  ["What is the difference between a manager and a leader in your opinion?", "professional", "opinions", null, null, null, "advanced", null, ["leadership", "management"]],
  ["How do you create a culture of innovation within a team or organization?", "professional", "work_career", null, null, null, "advanced", null, ["innovation", "culture"]],
  ["Describe a time when you had to make an unpopular decision. How did you handle it?", "professional", "experiences", null, null, null, "advanced", null, ["leadership", "decision"]],

  // Networking & Professional Relationships
  ["How do you build and maintain professional relationships?", "professional", "people_relationships", null, null, null, "intermediate", null, ["networking", "relationships"]],
  ["What is your approach to networking at professional events?", "professional", "people_relationships", null, null, null, "intermediate", null, ["networking", "events"]],
  ["How important is mentoring in professional development? Have you ever been a mentor or mentee?", "professional", "study_learning", null, null, null, "intermediate", null, ["mentoring", "development"]],

  // Work-Life Integration
  ["How do you handle office politics while staying professional?", "professional", "work_career", null, null, null, "advanced", null, ["office-politics", "professionalism"]],
  ["How do you manage work-related stress?", "professional", "emotions", null, null, null, "intermediate", null, ["stress", "management"]],
  ["What boundaries do you set between work and personal life?", "professional", "life_routine", null, null, null, "intermediate", null, ["work-life-balance", "boundaries"]],
  ["How has remote or hybrid work affected your productivity and well-being?", "professional", "work_career", null, null, null, "intermediate", null, ["remote-work", "well-being"]],
  ["Do you think the traditional 9-to-5 workday is still relevant? Why or why not?", "professional", "opinions", null, null, null, "advanced", null, ["work-culture", "future"]],

  // ═══════════════════════════════════════════
  // PERSONAL GROWTH (~60 questions)
  // ═══════════════════════════════════════════

  // Self-Reflection
  ["How would you describe yourself to someone who has never met you?", "personal_growth", "experiences", null, null, null, "beginner", null, ["self-description", "identity"]],
  ["What values are most important to you in life?", "personal_growth", "opinions", null, null, null, "intermediate", null, ["values", "beliefs"]],
  ["What does living a meaningful life mean to you?", "personal_growth", "opinions", null, null, null, "advanced", null, ["meaning", "philosophy"]],
  ["How have your priorities changed over the last five years?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["change", "priorities"]],
  ["What is something you used to believe strongly but have since changed your mind about?", "personal_growth", "opinions", null, null, null, "advanced", null, ["beliefs", "change"]],
  ["How do you define personal success for yourself?", "personal_growth", "opinions", null, null, null, "intermediate", null, ["success", "definition"]],
  ["What aspects of your personality would you like to develop further?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["personality", "growth"]],

  // Goals & Aspirations
  ["What personal goal are you currently working toward?", "personal_growth", "goals_future", null, null, null, "beginner", null, ["goal", "growth"]],
  ["What is a dream you have had since childhood? Have you pursued it?", "personal_growth", "goals_future", null, null, null, "intermediate", null, ["dream", "aspiration"]],
  ["How do you stay motivated when working toward long-term goals?", "personal_growth", "goals_future", null, null, null, "intermediate", null, ["motivation", "goals"]],
  ["What is something you want to accomplish in the next year?", "personal_growth", "goals_future", null, null, null, "beginner", null, ["goal", "short-term"]],
  ["How do you decide which goals are worth pursuing and which to let go of?", "personal_growth", "goals_future", null, null, null, "advanced", null, ["prioritization", "goals"]],
  ["What does financial freedom mean to you, and how important is it?", "personal_growth", "goals_future", null, null, null, "intermediate", null, ["finance", "freedom"]],

  // Challenges & Resilience
  ["Describe a significant challenge you have overcome in your life.", "personal_growth", "experiences", null, null, null, "intermediate", null, ["challenge", "resilience"]],
  ["How do you typically react when things do not go as planned?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["adaptability", "reaction"]],
  ["What is the most valuable lesson you have learned from a failure?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["failure", "learning"]],
  ["How do you maintain a positive mindset during difficult times?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["positivity", "resilience"]],
  ["What role has adversity played in shaping who you are today?", "personal_growth", "experiences", null, null, null, "advanced", null, ["adversity", "growth"]],
  ["How do you support others who are going through difficult times?", "personal_growth", "people_relationships", null, null, null, "intermediate", null, ["support", "empathy"]],

  // Emotions & Well-being
  ["What does emotional intelligence mean to you, and how do you practice it?", "personal_growth", "emotions", null, null, null, "advanced", null, ["emotional-intelligence", "self-awareness"]],
  ["How do you recognize when you need a break or a change in your life?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["self-care", "awareness"]],
  ["What activities or practices help you feel grounded and centered?", "personal_growth", "emotions", null, null, null, "beginner", null, ["mindfulness", "well-being"]],
  ["How has your relationship with yourself changed over time?", "personal_growth", "emotions", null, null, null, "advanced", null, ["self-relationship", "growth"]],
  ["What do you do when you feel overwhelmed by emotions?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["coping", "emotion"]],
  ["How important is gratitude in your daily life? How do you practice it?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["gratitude", "practice"]],
  ["What is something that brings you a deep sense of peace?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["peace", "well-being"]],

  // Relationships & Connection
  ["What have you learned about yourself through your relationships with others?", "personal_growth", "people_relationships", null, null, null, "intermediate", null, ["relationships", "self-knowledge"]],
  ["How do you build trust in a new relationship?", "personal_growth", "people_relationships", null, null, null, "intermediate", null, ["trust", "connection"]],
  ["What qualities do you most appreciate in the people close to you?", "personal_growth", "people_relationships", null, null, null, "beginner", null, ["appreciation", "qualities"]],
  ["How do you balance your own needs with the needs of others in your life?", "personal_growth", "people_relationships", null, null, null, "intermediate", null, ["balance", "relationships"]],
  ["What does healthy communication look like to you in close relationships?", "personal_growth", "people_relationships", null, null, null, "intermediate", null, ["communication", "relationships"]],

  // Learning & Growth Mindset
  ["What is something you recently realized about yourself?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["self-awareness", "discovery"]],
  ["How do you push yourself out of your comfort zone?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["growth", "challenge"]],
  ["What book, podcast, or idea has significantly influenced your personal growth?", "personal_growth", "study_learning", null, null, null, "beginner", null, ["influence", "learning"]],
  ["How do you measure your own personal growth over time?", "personal_growth", "opinions", null, null, null, "advanced", null, ["measurement", "reflection"]],
  ["What is a habit you have developed that has positively changed your life?", "personal_growth", "life_routine", null, null, null, "beginner", null, ["habit", "improvement"]],
  ["How do you respond to criticism or feedback about your personal behavior?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["feedback", "self-improvement"]],

  // Life Philosophy & Perspective
  ["What beliefs or principles guide your decisions in life?", "personal_growth", "opinions", null, null, null, "advanced", null, ["principles", "philosophy"]],
  ["How has your perspective on life changed as you have gotten older?", "personal_growth", "opinions", null, null, null, "intermediate", null, ["perspective", "age"]],
  ["What do you think is the relationship between happiness and meaning?", "personal_growth", "opinions", null, null, null, "advanced", null, ["happiness", "philosophy"]],
  ["If you could give your younger self one piece of advice, what would it be?", "personal_growth", "experiences", null, null, null, "intermediate", null, ["advice", "reflection"]],
  ["What do you want to be remembered for?", "personal_growth", "opinions", null, null, null, "advanced", null, ["legacy", "meaning"]],
  ["How do you deal with uncertainty about the future?", "personal_growth", "emotions", null, null, null, "intermediate", null, ["uncertainty", "coping"]],
  ["What role does creativity play in your personal life?", "personal_growth", "entertainment", null, null, null, "intermediate", null, ["creativity", "expression"]],
  ["How do you find balance between accepting yourself and striving to improve?", "personal_growth", "opinions", null, null, null, "advanced", null, ["acceptance", "growth"]],
];

// ── Insert function ──
async function seedDatabase() {
  console.log(`Preparing to seed ${questions.length} questions...`);
  console.log("Target user:", USER_ID);

  // First, delete existing seed data
  console.log("\nDeleting existing seed data...");
  const { error: deleteError } = await supabase
    .from("speaking_questions")
    .delete()
    .eq("user_id", USER_ID)
    .eq("source_type", "seed");

  if (deleteError) {
    console.error("Delete error:", deleteError);
    process.exit(1);
  }
  console.log("Existing seed data cleared.");

  // Prepare all inserts
  const rows = questions.map(([question, mode, topic, part, context, cuePoints, difficulty, sourceRef, tags]) => {
    const norm = normalizeQuestion(question);
    const hash = contentHash(question);
    return {
      user_id: USER_ID,
      question,
      normalized_question: norm,
      content_hash: hash,
      mode,
      topic,
      part: part || null,
      context: context || null,
      cue_points: cuePoints || null,
      difficulty,
      source_type: "seed",
      source_ref: sourceRef || null,
      tags: tags || null,
    };
  });

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("speaking_questions")
      .upsert(batch, {
        onConflict: "user_id, content_hash",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors += batch.length;
      // Try one by one
      for (const row of batch) {
        const { error: singleError } = await supabase
          .from("speaking_questions")
          .upsert(row, { onConflict: "user_id, content_hash", ignoreDuplicates: true });
        if (singleError) {
          console.error(`  Failed: "${row.question.substring(0, 60)}..." - ${singleError.message}`);
          errors++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} questions`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Duplicates skipped: ${skipped}, Errors: ${errors}`);
  return { inserted, skipped, errors, rows };
}

// ── Generate SQL migration ──
function generateMigration(rows) {
  const lines = [];
  lines.push("-- ============================================");
  lines.push("-- Migration 062: Seed Speaking Question Bank");
  lines.push("-- High-quality seed questions for all 4 modes");
  lines.push("-- Auto-generated from seed script");
  lines.push("-- ============================================");
  lines.push("");
  lines.push("DO $$");
  lines.push("DECLARE");
  lines.push(`  v_uid UUID := '${USER_ID}';`);
  lines.push("  v_norm TEXT;");
  lines.push("BEGIN");
  lines.push("");
  lines.push("  DELETE FROM speaking_questions WHERE user_id = v_uid AND source_type = 'seed';");
  lines.push("");
  lines.push("  RAISE NOTICE 'Seeding speaking questions...';");
  lines.push("");

  for (const row of rows) {
    const escQ = row.question.replace(/'/g, "''");
    lines.push(`  -- ${row.mode} / ${row.topic}${row.part ? " / " + row.part : ""}`);
    lines.push(`  v_norm := trim(both ' ' from regexp_replace(lower(regexp_replace('${escQ}', '[^a-zA-Z0-9[:space:]]', '', 'g')), '[[:space:]]+', ' ', 'g'));`);

    let cols = "user_id, question, normalized_question, content_hash, mode, topic";
    let vals = `v_uid, '${escQ}', v_norm, encode(digest(v_norm, 'sha256'), 'hex'), '${row.mode}', '${row.topic}'`;

    if (row.part) { cols += ", part"; vals += `, '${row.part}'`; }
    if (row.context) { cols += ", context"; vals += `, '${row.context.replace(/'/g, "''")}'`; }
    if (row.cue_points) { cols += ", cue_points"; vals += `, '${JSON.stringify(row.cue_points).replace(/'/g, "''")}'`; }
    cols += ", difficulty, source_type";
    vals += `, '${row.difficulty}', 'seed'`;
    if (row.source_ref) { cols += ", source_ref"; vals += `, '${row.source_ref.replace(/'/g, "''")}'`; }
    if (row.tags && row.tags.length > 0) {
      cols += ", tags";
      vals += `, ARRAY[${row.tags.map(t => `'${t}'`).join(", ")}]`;
    }

    lines.push(`  INSERT INTO speaking_questions (${cols})`);
    lines.push(`  VALUES (${vals})`);
    lines.push("  ON CONFLICT (user_id, content_hash) DO NOTHING;");
    lines.push("");
  }

  lines.push(`  RAISE NOTICE 'Seed questions inserted: %', ${rows.length};`);
  lines.push("END $$;");
  lines.push("");
  lines.push(`-- ${rows.length} seed questions`);

  fs.writeFileSync("supabase/migrations/062_seed_speaking_questions.sql", lines.join("\n"));
  console.log(`Migration file generated: ${rows.length} questions`);
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--generate-sql-only")) {
    // Just generate the SQL file, don't insert
    const rows = questions.map(([question, mode, topic, part, context, cuePoints, difficulty, sourceRef, tags]) => ({
      question,
      mode,
      topic,
      part: part || null,
      context: context || null,
      cue_points: cuePoints || null,
      difficulty,
      source_type: "seed",
      source_ref: sourceRef || null,
      tags: tags || null,
    }));
    generateMigration(rows);
    return;
  }

  console.log("=== Speaking Question Bank Seed Script ===");

  // First generate the migration SQL (always)
  const rows = questions.map(([question, mode, topic, part, context, cuePoints, difficulty, sourceRef, tags]) => ({
    question,
    mode,
    topic,
    part: part || null,
    context: context || null,
    cue_points: cuePoints || null,
    difficulty,
    source_type: "seed",
    source_ref: sourceRef || null,
    tags: tags || null,
  }));
  generateMigration(rows);

  // Then insert into database
  const result = await seedDatabase();

  // Report
  console.log("\n=== SEED REPORT ===");
  console.log(`Total questions in data: ${questions.length}`);
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Errors: ${result.errors}`);

  // Mode distribution
  const modes = {};
  const topics = {};
  const parts = {};
  const difficulties = {};
  const sources = {};

  for (const q of questions) {
    const mode = q[1];
    const topic = q[2];
    const part = q[3];
    const difficulty = q[6];
    const sourceRef = q[7];

    modes[mode] = (modes[mode] || 0) + 1;
    topics[topic] = (topics[topic] || 0) + 1;
    if (part) parts[part] = (parts[part] || 0) + 1;
    difficulties[difficulty] = (difficulties[difficulty] || 0) + 1;
    const src = sourceRef || "original";
    sources[src] = (sources[src] || 0) + 1;
  }

  console.log("\nMode distribution:");
  for (const [k, v] of Object.entries(modes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nTopic distribution:");
  for (const [k, v] of Object.entries(topics).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nIELTS Part distribution:");
  for (const [k, v] of Object.entries(parts).sort()) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nDifficulty distribution:");
  for (const [k, v] of Object.entries(difficulties).sort()) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nSource distribution:");
  for (const [k, v] of Object.entries(sources).sort()) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
