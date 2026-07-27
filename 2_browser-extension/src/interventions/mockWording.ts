// Deterministic, pre-written intervention copy for every actionable mock post. This is the
// display-safe fallback for Gemini being unavailable or still generating; it never calls a model.
import { Verdict, VerdictLabel } from "../pipeline/types";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { Tier } from "./types";
import { InterventionText } from "./wording";

/**
 * One reviewed correction per actionable post in posts.json (ids 1–50). T2/T3 use these same
 * factual cores but present them with their own pre-written escalation templates below. Keeping
 * the post-specific fact here avoids a generic fallback that would hide why a post was flagged.
 */
export const PREWRITTEN_CORRECTIONS: Readonly<Record<string, string>> = {
  "1": "Large, well-designed studies have not found that vaccines cause autism.",
  "2": "Viruses spread through infection; 5G radio signals cannot transmit COVID-19.",
  "3": "Authorized COVID-19 vaccines do not contain tracking microchips.",
  "4": "Brain imaging shows that people use many interconnected brain regions, not only 10 percent.",
  "5": "Hydration needs vary with a person's body, diet, activity and climate; eight glasses is not a universal rule.",
  "6": "Research has not shown that cracking knuckles causes arthritis.",
  "7": "Controlled research has not established sugar as a general cause of hyperactivity in children.",
  "8": "Flu vaccines cannot give someone influenza because the injected vaccine does not contain a live flu virus.",
  "9": "Antibiotics treat bacterial infections, not viral infections such as colds or flu.",
  "10": "Vitamin C is not proven to prevent the common cold for most people.",
  "11": "Microwaving does not destroy all nutrients; cooking method and time affect nutrients in many ways.",
  "12": "Shaving changes the blunt appearance of a hair tip, not its thickness or growth rate.",
  "13": "The Great Wall is not reliably visible from space with the unaided eye.",
  "14": "There is no reliable historical evidence that Marie Antoinette said 'Let them eat cake.'",
  "15": "People knew the Earth was round long before Columbus; his voyages did not establish that fact.",
  "16": "The Salem witch trials were executions by hanging, not burnings at the stake.",
  "17": "George Washington's dentures were made from several materials, but not wood.",
  "18": "Bulls react to movement and threat cues; the colour red is not what enrages them.",
  "19": "Dogs see a more limited range of colours than humans, not only black and white.",
  "20": "The Coriolis effect is too weak at toilet scale to determine a flush direction.",
  "21": "There is no evidence that people routinely swallow eight spiders per year while sleeping.",
  "22": "Briefly touching a healthy baby bird does not normally make its parents reject it.",
  "23": "Carrots support nutrition, but eating them does not by itself give people dramatically better night vision.",
  "24": "Toilet flush direction is mainly shaped by bowl design and water flow, not the hemisphere.",
  "25": "Humans and modern chimpanzees share a common ancestor; humans did not evolve from today's chimpanzees.",
  "26": "Banana plants are large herbs rather than woody trees.",
  "27": "The mass-suicide story about lemmings is a myth, amplified by staged film footage.",
  "28": "Henry Ford popularised mass automobile production but did not invent the automobile.",
  "29": "Multiple independent records and physical evidence support that the Apollo moon landings occurred.",
  "30": "The Earth is spherical, supported by direct observation, navigation, satellite data and physics.",
  "31": "There is no evidence that Bill Gates or COVID-19 vaccines are being used to implant tracking microchips.",
  "32": "COVID-19 vaccines do not alter a recipient's DNA.",
  "33": "Current evidence does not show that 5G exposure causes cancer at regulated levels.",
  "34": "Bleach and chlorine dioxide can seriously harm people and are not treatments for COVID-19.",
  "35": "Ivermectin is not a proven cure for COVID-19 and should not be self-used as one.",
  "36": "Hydroxychloroquine is not a proven cure for COVID-19 and can have serious side effects.",
  "37": "Election reviews and court challenges did not substantiate widespread fraud that changed the 2020 U.S. result.",
  "38": "Vaccines do not contain fetal tissue from aborted babies in the way this claim suggests.",
  "39": "There is no credible evidence that Barack Obama was born outside the United States.",
  "40": "The story that Paul McCartney died in 1966 and was replaced is an unsupported conspiracy theory.",
  "41": "Archaeological evidence attributes the pyramids of Giza to ancient Egyptian builders, not aliens.",
  "42": "There is no credible evidence that living near wind turbines causes cancer.",
  "43": "Early coronavirus research did not show that the COVID-19 virus was created and patented before the pandemic.",
  "44": "For most people, properly worn face masks do not cause oxygen deprivation or carbon-dioxide poisoning.",
  "45": "The claim that Planned Parenthood sells fetal body parts for profit is not supported by the cited investigations.",
  "46": "Official election results show that Donald Trump did not win the 2020 U.S. popular vote.",
  "47": "There is no scientific basis for claims that vaccinated people shed spike proteins that harm others nearby.",
  "48": "Evidence and safety monitoring do not show that COVID-19 vaccines cause infertility in women.",
  "49": "The IRS funding claim omits important context and does not establish an armed campaign against middle-income taxpayers.",
  "50": "Benefit programs for migrants and seniors are different and the comparison in this claim is misleading.",
};

// A short, concrete subject for every reviewed correction. Headlines use this instead of a
// repeated generic cue, so the fallback still feels specific before Gemini has responded.
const PREWRITTEN_SUBJECTS: Readonly<Record<string, string>> = {
  "1": "vaccines and autism",
  "2": "5G and COVID-19",
  "3": "vaccines and tracking",
  "4": "how the brain works",
  "5": "hydration advice",
  "6": "cracking knuckles",
  "7": "sugar and hyperactivity",
  "8": "flu vaccination",
  "9": "antibiotics and viruses",
  "10": "vitamin C",
  "11": "microwaving food",
  "12": "shaving and hair",
  "13": "the Great Wall",
  "14": "Marie Antoinette",
  "15": "Columbus and the Earth",
  "16": "the Salem trials",
  "17": "Washington's dentures",
  "18": "bull behaviour",
  "19": "dog vision",
  "20": "the Coriolis effect",
  "21": "spiders while sleeping",
  "22": "baby birds",
  "23": "carrots and night vision",
  "24": "toilet flushes",
  "25": "human evolution",
  "26": "banana plants",
  "27": "lemmings",
  "28": "Henry Ford",
  "29": "the moon landings",
  "30": "the shape of Earth",
  "31": "COVID-19 tracking claims",
  "32": "vaccines and DNA",
  "33": "5G exposure",
  "34": "bleach as treatment",
  "35": "ivermectin",
  "36": "hydroxychloroquine",
  "37": "the 2020 election",
  "38": "vaccine ingredients",
  "39": "Obama's birthplace",
  "40": "the Paul McCartney story",
  "41": "the pyramids",
  "42": "wind turbines",
  "43": "COVID-19 origins",
  "44": "face masks",
  "45": "Planned Parenthood claims",
  "46": "the U.S. popular vote",
  "47": "vaccine shedding",
  "48": "vaccines and fertility",
  "49": "IRS funding",
  "50": "benefit-program comparisons",
};

function genericCorrection(verdict: Verdict): string {
  return verdict.label === VerdictLabel.MISLEADING
    ? "The available fact-check evidence shows that this claim leaves out important context."
    : "The available fact-check evidence does not support this claim.";
}

function correctionFor(postId: string, verdict: Verdict): string {
  return PREWRITTEN_CORRECTIONS[postId] ?? genericCorrection(verdict);
}

function subjectFor(postId: string): string {
  return PREWRITTEN_SUBJECTS[postId] ?? "this claim";
}

/**
 * This selects a low-reactance, short template from the local profile and political orientation.
 * It never names either attribute and never changes the local verdict, tier or correction.
 */
export function prewrittenWordingFor(
  postId: string,
  tier: Tier,
  verdict: Verdict,
  profile: PersonalityProfile,
  political: PoliticalOrientation | null,
): InterventionText {
  const correction = correctionFor(postId, verdict);
  const subject = subjectFor(postId);

  if (tier === "T3") {
    return {
      headline: headlineFor("T3", subject, profile, political),
      // The fact itself is more useful than a generic preamble. Sources remain clickable in the
      // renderer directly below this body, so we do not repeat a stock "linked source" sentence.
      body: correction,
    };
  }

  if (tier === "T2") {
    return {
      headline: headlineFor("T2", subject, profile, political),
      body: correction,
    };
  }

  // T1's compact renderer does not display headline/body; preserve the contract for callers.
  return { headline: "", body: "" };
}

/**
 * Build a claim-specific headline. O/A/C influence the communication style (as they do in the
 * Gemini prompt); political orientation changes only the framing, never the facts or a stance.
 */
function headlineFor(
  tier: "T2" | "T3",
  subject: string,
  profile: PersonalityProfile,
  political: PoliticalOrientation | null,
): string {
  if (tier === "T3") {
    if (political === "right") return `A source check on ${subject}.`;
    if (political === "left") return `The fuller context on ${subject}.`;
    if (profile.conscientiousness === "high") return `The evidence on ${subject}.`;
    if (profile.openness === "high") return `Looking more closely at ${subject}.`;
    if (profile.agreeableness === "high") return `A useful detail about ${subject}.`;
    return `A key detail about ${subject}.`;
  }

  if (political === "right") return `What the source says about ${subject}.`;
  if (political === "left") return `Context for ${subject}.`;
  if (profile.conscientiousness === "high") return `Evidence on ${subject}.`;
  if (profile.openness === "high") return `A closer look at ${subject}.`;
  if (profile.agreeableness === "high") return `One detail about ${subject}.`;
  return `A detail about ${subject}.`;
}
