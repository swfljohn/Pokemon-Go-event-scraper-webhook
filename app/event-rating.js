// Public event grades describe the published opportunity, not a guaranteed catch.
// Keep this deterministic so list and detail views agree for the same facts.
import { META_RANKINGS, META_RANKINGS_AS_OF } from "./event-meta-rankings.js";
import { gradingEventView } from "./lib/event-grading-data.js";

export const EVENT_RATING_VERSION = 4;
const labels = {
  A: "Top priority",
  B: "Worth planning",
  C: "Good if convenient",
  D: "Limited announced value",
    F: "Few announced reasons to play"
};

const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value || "").toLowerCase();
const namedFlag = (event, key) => rows(event?.details?.[key]).some(row => Boolean(row?.name || row));
const any = (values, pattern) => values.some(value => pattern.test(text(value)));
const metaKey = value => text(value).normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const rewardSpeciesNames = value => rows(value).map(row => typeof row === "string" ? row : row?.name)
  .filter(name => typeof name === "string" && name.trim());

function publishedPokemon(event, details) {
  const names = [
    ...rows(event.species),
    ...rows(details.featuredPokemon),
    ...rows(details.spawns),
    ...rows(details.raidBosses),
    ...rows(details.maxBattleBosses),
    ...rows(details.research),
    ...rows(details.shinies),
    ...rows(details.researchMethods).flatMap(method => rewardSpeciesNames(method?.rewardSpecies))
  ].map(value => value?.name || value).filter(Boolean);
  return [...new Set(names.map(name => String(name).trim()))];
}

function metaMatch(names, kind) {
  return names.map(name => ({ name, ranking: META_RANKINGS[kind][metaKey(name)] }))
    .filter(match => match.ranking)
    .sort((left, right) => right.ranking.points - left.ranking.points || left.ranking.rank - right.ranking.rank)[0];
}

function metaReason(match, kind) {
  const { name, ranking } = match;
  const subject = ranking.via ? `${name} → ${ranking.pokemon}` : ranking.pokemon;
  return kind === "pvp"
    ? `${subject} ranks #${ranking.rank} in ${ranking.league} PvP`
    : `${subject} ranks #${ranking.rank} among ${ranking.type} raid attackers`;
}

const localTypes = /(?:^|[-_ ])(?:local-event|local-partnership|stamp-rally|mall-exploration|city-wild-area|wild-area-city|pokemon-run|pok[eé]xciting|esa)(?:$|[-_ ])/i;
const localCopy = /(?:stamp rally|mall exploration|city\s+wild area|pok[eé]mon run|pok[eé]xciting|\bESA\b|in-person local)/i;

function eventAccess(event) {
  if (["global", "regional", "in-person-local"].includes(event.eventAccess)) return event.eventAccess;
  const type = text(event.eventType);
  const copy = `${event.name || ""} ${event.heading || ""} ${event.summary || ""} ${event.location || ""}`;
  const scope = text(event.scope);
  const wildAreaEdition = /^Pokémon GO Wild Area \d{4}:\s*(.+)$/i.exec(String(event.name || ""))?.[1]?.trim();
  const namedWildArea = wildAreaEdition && !/^(?:global|worldwide)$/i.test(wildAreaEdition.replace(/\s*[•—–-].*$/, "").trim());
  const cityWildArea = type === "wild-area" && ["regional", "citywide", "venue"].includes(scope) && namedWildArea;
  // Wording alone does not make an explicitly global event local: World Space Week (global) mentions the ESA
  // museum tie-in in its summary and was being graded "Local only" (2026-11-10).
  if (localTypes.test(type) || scope === "venue" || cityWildArea || (scope !== "global" && localCopy.test(copy))) return "in-person-local";
  if (scope === "regional" || /regional|country|region/i.test(event.location || "")) return "regional";
  return "global";
}

function excludedWrapper(event) {
  const type = text(event.eventType).replace(/[_ ]/g, "-");
  const title = text(`${event.name || ""} ${event.heading || ""}`);
  return event?.excluded === true || /go-battle-league|battle-league-season|season-wrapper/.test(type) || type === "season"
    || /go battle league.{0,50}\bseason\b/.test(title);
}

function explicitEndTime(event) {
  const value = event.end;
  if (typeof value !== "string") return null;
  // Floating event times are only meaningful when their timezone is explicitly known.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    if (!event.timeZone) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
    if (!match) return null;
    try {
      const parts = match.slice(1, 7).map(part => Number(part || 0));
      const millis = Number((match[7] || "0").padEnd(3, "0"));
      const desired = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], millis);
      const valid = new Date(desired);
      if (valid.getUTCFullYear() !== parts[0] || valid.getUTCMonth() !== parts[1] - 1 || valid.getUTCDate() !== parts[2]
        || valid.getUTCHours() !== parts[3] || valid.getUTCMinutes() !== parts[4] || valid.getUTCSeconds() !== parts[5]) return null;
      let instant = desired;
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: event.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
      for (let i = 0; i < 2; i++) {
        const zoned = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
        instant += desired - Date.UTC(Number(zoned.year), Number(zoned.month) - 1, Number(zoned.day), Number(zoned.hour), Number(zoned.minute), Number(zoned.second), millis);
      }
      const finalParts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
      if (Number(finalParts.year) !== parts[0] || Number(finalParts.month) !== parts[1] || Number(finalParts.day) !== parts[2]
        || Number(finalParts.hour) !== parts[3] || Number(finalParts.minute) !== parts[4] || Number(finalParts.second) !== parts[5]) return null;
      return instant;
    }
    catch { return null; }
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rateEvent(input = {}, now = Date.now(), seen = new Set(), depth = 0) {
  const event = gradingEventView(input) || input || {};
  if (excludedWrapper(event)) {
    return { version: EVENT_RATING_VERSION, grade: "", score: null, label: "", provisional: false, excluded: true, eventAccess: eventAccess(event), reasons: [], metaAsOf: META_RANKINGS_AS_OF };
  }
  const parent = event?.details?.ratingParentEvent;
  if (/^raid-hour$/.test(text(event.eventType)) && parent && depth < 1 && parent !== input && /^raid-hour$/.test(text(parent.eventType)) === false && !seen.has(input)) {
    const nextSeen = new Set(seen); nextSeen.add(input);
    const base = rateEvent(parent, now, nextSeen, depth + 1);
    if (!base.excluded && base.grade !== "—" && base.grade !== "Local only") {
      const score = Math.max(0, base.score - 5);
      const rawGrade = gradeFor(score);
      const access = eventAccess(event);
      const grade = access === "in-person-local" ? "Local only" : access === "regional" && rawGrade === "A" ? "B" : rawGrade;
      const ownEnd = explicitEndTime(event);
      const ownEndingSoon = /raid/.test(text(event.eventType)) && ownEnd !== null && ownEnd > now && ownEnd - now <= 36 * 60 * 60 * 1000;
      const applyEndPenalty = ownEndingSoon && !base.endingSoonPenalty && !base.hasDebutOrBoostedShiny
        && !namedFlag(event, "debutPokemon") && !namedFlag(event, "boostedShinyPokemon");
      const adjusted = applyEndPenalty ? Math.max(0, score - 8) : score;
      const adjustedRaw = gradeFor(adjusted);
      const adjustedGrade = access === "in-person-local" ? "Local only" : access === "regional" && adjustedRaw === "A" ? "B" : adjustedRaw;
      const reasons = ["Raid Hour inherits its published parent rotation (−5 points)", ...(applyEndPenalty ? ["Raid ending within 36 hours (−8 points)"] : []), ...base.reasons.slice(0, 2)];
      return { ...base, grade: adjustedGrade, score: adjusted, label: adjustedGrade === "Local only" ? "Local only" : labels[adjustedGrade], reasons, eventAccess: access, endingSoonPenalty: Boolean(base.endingSoonPenalty || applyEndPenalty) };
    }
  }
  const details = event.details || {};
  const bonuses = [...new Set([...rows(event.bonuses), ...rows(details.bonuses)]
    .filter(value => !(value && typeof value === "object" && value.paid === true))
    .map(value => value?.text || value).filter(value => typeof value === "string" && value.trim()))];
  const named = value => rows(value).filter(row => typeof row === "string" ? Boolean(row.trim()) : typeof row?.name === "string" && Boolean(row.name.trim()));
  const spawns = named(details.spawns);
  const raids = named(details.raidBosses);
  const maxes = named(details.maxBattleBosses);
  const shinies = named(details.shinies);
  const shinyNames = new Set(shinies.map(row => metaKey(row?.name || row)));
  const research = named(details.research);
  const researchMethods = rows(details.researchMethods);
  const backgroundRows = named(details.backgroundPokemon);
  const title = text(`${event.name || ""} ${event.heading || ""} ${event.eventType || ""}`);
  const publishedCopy = text(`${event.name || ""} ${event.summary || ""}`);
  const reasons = [];
  let score = 15;
  let evidence = 0;
  const add = (points, reason) => {
    score += points;
    evidence += 1;
    reasons.push({ points, text: reason });
  };

  if (event.specialBackground || backgroundRows.length) {
    add(25, "Event background opportunity listed");
    if (backgroundRows.length) score += 10;
  }
  if (event.costumePokemon || /(?:wearing|costume|costumed|pikachu \([^)]*\))/.test(publishedCopy)) {
    add(12, "Costume Pokémon listed");
  }
  if (shinies.length || details.spotlight?.canBeShiny === true) {
    add(12, "Shiny-eligible Pokémon listed");
  }
  if (named(details.boostedShinyPokemon).length) {
    add(10, "Boosted Shiny chance published");
  }
  if (named(details.debutPokemon).length) {
    add(14, "New Pokémon, form, or Shiny debut published");
  }
  if (named(details.debutPokemon).some(row => {
    const name = String(row?.name || row);
    const target = String(row?.target || name.replace(/^Shiny\s+/i, ""));
    return /^Shiny\s+/i.test(name) && shinyNames.has(metaKey(target));
  })) {
    add(16, "First Shiny release of a featured target");
  }
  const exclusiveIncense = named(details.incenseExclusivePokemon)
    .map(row => String(row?.name || row)).filter(name => shinyNames.has(metaKey(name)));
  if (exclusiveIncense.length) {
    const label = exclusiveIncense.length <= 3 ? exclusiveIncense.join(", ") : `${exclusiveIncense.length} Pokémon`;
    add(22, `Shiny ${label} limited to event Incense`);
  }
  if (raids.length && (details.raidTier === 5 || /\b(?:five.star|5.star|legendary|mythical|ultra beast)\b/.test(title))) {
    add(20, "High-tier raid or rare Pokémon listed");
  } else if ((raids.length || maxes.length) && /\b(?:gigantamax|shadow raids?)\b/.test(title)) {
    add(20, "Gigantamax or Shadow raid encounter listed");
  } else if (raids.length && /\bmega\b/.test(title)) {
    add(11, "Mega encounter listed");
  }
  if (/\b(?:debut|first time|first-ever|new pokemon|new pokémon|exclusive (?:pokemon|pokémon|encounter|form|costume)|pok[eé]mon go debut|makes? its (?:.* )?debut|new costume|super max)\b/.test(publishedCopy)) {
    add(10, "New or exclusive encounter announced");
  }
  const structuredMegaDebut = named(details.debutPokemon).some(row => /^mega\s+/i.test(String(row?.name || row)));
  const publishedMegaDebut = /(?:mega[- ]evolved|mega\s+[\w'’.-]+).{0,50}\bdebuts?\b/i.test(publishedCopy);
  if (/raid.day/.test(title) && (structuredMegaDebut || publishedMegaDebut)) {
    add(20, "New Mega species debut published");
  }

  const bonusGroups = [
    [/\b(?:\d+(?:\.\d+)?\s*[×x]\s*)?(?:catch|raid|battle|hatch|evolution|evolve)?\s*xp\b|experience points/i, 8, "XP bonus"],
    [/\b(?:\d+(?:\.\d+)?\s*[×x]\s*|bonus\s+|extra\s+|increased\s+)(?:catch|raid|battle|hatch)?\s*stardust\b/i, 8, "Stardust bonus"],
    [/\b(?:candy xl|catch candy|bonus candy|extra candy|additional candy|more candy)\b/i, 8, "Candy bonus"],
    [/\b(?:hatch distance|hatching distance|incubator|egg hatch)\b/i, 7, "Hatching bonus"],
    [/\b(?:raid pass|raid damage|remote raid|free raid)\b/i, 7, "Raid bonus"],
    [/\b(?:increased spawns|increased wild|boosted spawns|spawn more frequently)\b/i, 5, "Increased encounters"],
    [/\b(?:incense|lure module|longer lures|extended lures)\b/i, 4, "Longer lure or Incense duration"]
  ];
  let bonusPoints = 0;
  for (const [pattern, points, reason] of bonusGroups) {
    if (!any(bonuses, pattern) || bonusPoints + points > 24) continue;
    bonusPoints += points;
    add(points, reason);
  }
  if (any(bonuses, /\b(?:3|4|5)\s*[×x]\s*(?:catch\s*)?(?:xp|stardust|candy)\b/i)) {
    add(6, "Strong multiplier announced");
  }
  if (spawns.length || raids.length || maxes.length || event.hasSpawns) add(5, "Featured encounters published");
  if (spawns.length >= 8) add(5, "Broad featured spawn pool");
  if (research.length || researchMethods.some(method => rewardSpeciesNames(method?.rewardSpecies).length)) {
    add(5, "Research rewards published");
  }
  if (/\b(?:raid.hour|spotlight.hour)\b/.test(title) && evidence === 0) {
    add(9, "Published short event window");
  }
  if (/\b(?:community.day|raid.day|max.battle.day)\b/.test(title) && evidence > 0) {
    add(7, "Focused event day");
  }
  const pokemon = publishedPokemon(event, details);
  const pvpMeta = metaMatch(pokemon, "pvp");
  const raidMeta = metaMatch(pokemon, "raid");
  if (pvpMeta) add(pvpMeta.ranking.points, metaReason(pvpMeta, "pvp"));
  if (raidMeta) add(raidMeta.ranking.points, metaReason(raidMeta, "raid"));
  const paidBenefits = rows(details.paidBenefits).map(value => value?.text || value).filter(Boolean);
  const freeBenefits = rows(details.freeBenefits).map(value => value?.text || value).filter(Boolean);
  const ticketPrice = event.ticketPrice ?? details.ticketPrice ?? null;
  const ticketReason = event.mainValueRequiresTicket === false ? false : Boolean(event.mainValueRequiresTicket ?? event.ticketRequired);
  if (ticketReason) { score -= 12; reasons.push({ points: -12, text: ticketPrice ? `Main event value requires a paid ticket (${ticketPrice})` : "Main event value requires a paid ticket" }); evidence++; }
  else if (ticketPrice) reasons.push({ points: 0, text: `Optional paid upgrade (${ticketPrice}); paid benefits are excluded from the free score` });

  score = Math.max(0, Math.min(100, score));
  const substantive = spawns.length || raids.length || maxes.length || named(details.debutPokemon).length || shinies.length || bonuses.length || research.length || researchMethods.some(method => rewardSpeciesNames(method?.rewardSpecies).length) || named(details.boostedShinyPokemon).length || backgroundRows.length || freeBenefits.length;
  const access = eventAccess(event);
  const grade = !substantive ? "—" : score >= 70 ? "A" : score >= 52 ? "B" : score >= 38 ? "C" : score >= 24 ? "D" : "F";
  const ending = explicitEndTime(event);
  const raid = /raid/.test(title);
  const debut = named(details.debutPokemon).length > 0;
  const boostedShiny = named(details.boostedShinyPokemon).length > 0;
  if (raid && ending !== null && ending > now && ending - now <= 36 * 60 * 60 * 1000 && !debut && !boostedShiny) {
    score = Math.max(0, score - 8);
    reasons.push({ points: -8, text: "Raid ending within 36 hours (−8 points)" });
  }
  const finalGrade = !substantive ? "—" : score >= 70 ? "A" : score >= 52 ? "B" : score >= 38 ? "C" : score >= 24 ? "D" : "F";
  const accessGrade = access === "in-person-local" ? "Local only" : access === "regional" && ["A"].includes(finalGrade) ? "B" : finalGrade;
  const provisional = evidence < 2;
  const keyReasons = reasons.filter(row => row.points < 0 || row.text === "New Mega species debut published" || row.text.startsWith("Optional paid upgrade ("));
  const topReasons = [...new Set([...keyReasons, ...reasons.sort((left, right) => right.points - left.points).slice(0, 3)].map(row => row.text))].slice(0, 4);
  if (!topReasons.length) topReasons.push("Published rewards and encounters are still limited");
  return {
    version: EVENT_RATING_VERSION,
    grade: accessGrade,
    score,
    label: !substantive ? "Not graded yet — details pending" : accessGrade === "Local only" ? "Local only" : labels[accessGrade],
    provisional: !substantive || provisional,
    eventAccess: access,
    freeBenefits,
    paidBenefits,
    ticketPrice,
    timezoneUncertain: Boolean(event.end && ending === null),
    endingSoonPenalty: raid && ending !== null && ending > now && ending - now <= 36 * 60 * 60 * 1000 && !debut && !boostedShiny,
    hasDebutOrBoostedShiny: debut || boostedShiny,
    excluded: false,
    freePaidBreakdown: { free: freeBenefits, paid: paidBenefits },
    reasons: topReasons,
    metaAsOf: META_RANKINGS_AS_OF
  };
}

function gradeFor(score) { return score >= 70 ? "A" : score >= 52 ? "B" : score >= 38 ? "C" : score >= 24 ? "D" : "F"; }
