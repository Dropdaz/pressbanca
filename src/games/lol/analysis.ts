import { mean } from '@/core/math';
import type { Advice, CompareRow, DeathView, Insight, KillView, PostGameView } from '@/core/types';
import type { DD } from './ddragon';
import type { MatchDto, ParticipantDto, TimelineDto, TimelineEventDto } from './dto';
import { dist, zoneOf, type Zone } from './map';
import { metricsFor, opponentOf, ROLE_NAMES, scoreFor } from './metrics';

/**
 * Post-game analysis: what went well, what went wrong and what to practise, for one player in one game.
 * Built from the match, its timeline (minute-by-minute positions, kills, items, objectives) and the
 * player's own averages from their stored history ("usual"), so feedback is personal, not generic.
 */

/** Player's own averages over their history, computed from match data only (no timelines needed). */
export interface Baseline {
  games: number;
  cs10: number;
  csPerMin: number;
  deaths: number;
  visionPerMin: number;
  killParticipation: number;
  damageShare: number;
  goldPerMin: number;
  controlWards: number;
}

export function baselineOf(matches: MatchDto[], puuid: string): Baseline | null {
  const rows = matches.map((m) => ({ m, p: m.info.participants.find((x) => x.puuid === puuid) })).filter((r): r is { m: MatchDto; p: ParticipantDto } => !!r.p && r.m.info.gameDuration >= 900);
  if (rows.length < 3) return null;
  const met = rows.map((r) => metricsFor(r.m, r.p));
  return {
    games: rows.length,
    cs10: mean(rows.map((r) => (r.p.challenges?.laneMinionsFirst10Minutes ?? 0) + (r.p.challenges?.jungleCsBefore10Minutes ?? 0))),
    csPerMin: mean(met.map((x) => x.csPerMin)),
    deaths: mean(met.map((x) => x.deaths)),
    visionPerMin: mean(met.map((x) => x.visionPerMin)),
    killParticipation: mean(met.map((x) => x.killParticipation)),
    damageShare: mean(met.map((x) => x.damageShare)),
    goldPerMin: mean(met.map((x) => x.goldPerMin)),
    controlWards: mean(rows.map((r) => (r.p as ParticipantDto & { detectorWardsPlaced?: number }).detectorWardsPlaced ?? 0)),
  };
}

/** Role expectations used when the player has no history yet (deliberately rough). */
const ROLE_NORMS: Record<string, { cs10: number; visionPerMin: number; kp: number; dmg: number }> = {
  TOP: { cs10: 70, visionPerMin: 0.65, kp: 0.42, dmg: 0.22 },
  JUNGLE: { cs10: 55, visionPerMin: 0.95, kp: 0.6, dmg: 0.17 },
  MIDDLE: { cs10: 76, visionPerMin: 0.7, kp: 0.55, dmg: 0.26 },
  BOTTOM: { cs10: 76, visionPerMin: 0.6, kp: 0.58, dmg: 0.27 },
  UTILITY: { cs10: 8, visionPerMin: 2.0, kp: 0.62, dmg: 0.11 },
};

/** Spanish names for map zones (internal keys stay English). */
const ZONE_ES: Record<Zone, string> = { base: 'la base', 'top lane': 'la calle superior', 'mid lane': 'la calle central', 'bot lane': 'la calle inferior', river: 'el río', 'own jungle': 'tu jungla', 'enemy jungle': 'la jungla enemiga' };
const es = (n: number) => n.toLocaleString('es-ES');

const fmtMin = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const toneOf = (diff: number, eps: number, higherIsBetter = true): CompareRow['tone'] => {
  const d = higherIsBetter ? diff : -diff;
  return d > eps ? 'up' : d < -eps ? 'dn' : 'eq';
};

type Ext = ParticipantDto & Record<string, number | boolean | string | undefined | object>;
const num = (p: ParticipantDto, k: string) => Number((p as Ext)[k] ?? 0);
const ch = (p: ParticipantDto, k: string) => Number((p.challenges as Record<string, number> | undefined)?.[k] ?? 0);

export function analyse(m: MatchDto, tl: TimelineDto | null, puuid: string, dd: DD, base: Baseline | null): PostGameView {
  const me = m.info.participants.find((p) => p.puuid === puuid)!;
  const opp = opponentOf(m, me) ?? null;
  const role = me.teamPosition || 'MIDDLE';
  const norm = ROLE_NORMS[role] ?? ROLE_NORMS.MIDDLE;
  const isSupport = role === 'UTILITY';
  const isJungle = role === 'JUNGLE';
  const minutes = m.info.gameDuration / 60;
  const met = metricsFor(m, me);
  const oppMet = opp ? metricsFor(m, opp) : null;
  const pid = (p: ParticipantDto) => (tl ? tl.metadata.participants.indexOf(p.puuid) + 1 : 0);
  const myId = pid(me);
  const oppId = opp ? pid(opp) : 0;
  const byId = (id: number) => m.info.participants.find((p) => p.puuid === tl?.metadata.participants[id - 1]);
  const champImg = (p?: ParticipantDto) => (p ? dd.championImg(p.championName) : null);
  const champName = (p?: ParticipantDto) => (p ? dd.championName(p.championName) : 'Desconocido');

  const frames = tl?.info.frames ?? [];
  const frameAt = (min: number) => frames[Math.min(frames.length - 1, min)];
  const pf = (min: number, id: number) => frameAt(min)?.participantFrames[String(id)];
  const events: TimelineEventDto[] = frames.flatMap((f) => f.events);

  const strengths: Insight[] = [];
  const mistakes: Insight[] = [];
  const advice = new Map<string, Advice>();
  const addAdvice = (a: Advice) => advice.set(a.id, a);

  // ───── Laning: CS / gold / XP at 10 and 15 vs lane opponent
  const laning: CompareRow[] = [];
  const series: PostGameView['series'] = { cs: [], gold: [], xp: [] };
  if (tl && myId) {
    for (let i = 0; i < frames.length; i++) {
      const a = pf(i, myId), b = oppId ? pf(i, oppId) : undefined;
      if (!a) continue;
      series.cs.push([a.minionsKilled + a.jungleMinionsKilled, b ? b.minionsKilled + b.jungleMinionsKilled : 0]);
      series.gold.push([a.totalGold, b?.totalGold ?? 0]);
      series.xp.push([a.xp, b?.xp ?? 0]);
    }
    for (const t of [10, 15]) {
      if (frames.length <= t) continue;
      const [cs, ocs] = series.cs[t];
      const [g, og] = series.gold[t];
      const [x, ox] = series.xp[t];
      laning.push({ label: `CS @${t}`, you: `${cs}`, other: opp ? `${ocs}` : null, usual: t === 10 && base ? base.cs10.toFixed(0) : null, tone: toneOf(cs - ocs, 4) });
      laning.push({ label: `Oro @${t}`, you: es(g), other: opp ? es(og) : null, usual: null, tone: toneOf(g - og, 250) });
      laning.push({ label: `XP @${t}`, you: es(x), other: opp ? es(ox) : null, usual: null, tone: toneOf(x - ox, 200) });
    }
  }
  const at = (t: number) => (series.cs[t] ? { cs: series.cs[t][0] - series.cs[t][1], gold: series.gold[t][0] - series.gold[t][1], xp: series.xp[t][0] - series.xp[t][1] } : null);
  const d10 = at(10), d15 = at(15);
  const cs10 = series.cs[10]?.[0] ?? (me.challenges?.laneMinionsFirst10Minutes ?? 0) + (me.challenges?.jungleCsBefore10Minutes ?? 0);

  // Plates lost / taken in my lane
  const laneType = role === 'TOP' ? 'TOP_LANE' : role === 'MIDDLE' ? 'MID_LANE' : role === 'BOTTOM' || role === 'UTILITY' ? 'BOT_LANE' : null;
  // Inner turrets have plates too in the current game; the laning phase is about the outer ones (< 14:00).
  const plates = events.filter((e) => e.type === 'TURRET_PLATE_DESTROYED' && e.laneType === laneType && e.timestamp < 14 * 60_000);
  const platesLost = plates.filter((e) => e.teamId === me.teamId).length;
  const platesTaken = plates.filter((e) => e.teamId !== me.teamId).length;
  if (laneType && tl) laning.push({ label: 'Placas (ganadas / perdidas)', you: `${platesTaken} / ${platesLost}`, other: null, usual: null, tone: toneOf(platesTaken - platesLost, 0) });

  if (!isSupport && !isJungle && d10) {
    if (d10.cs <= -10)
      mistakes.push({ id: 'cs10', category: 'Laning', severity: d10.cs <= -20 ? 3 : 2, minute: 10, title: `${-d10.cs} CS por detrás al minuto 10`, detail: `${cs10} CS contra ${cs10 - d10.cs} de ${champName(opp!)}${base ? ` (lo normal en ti: ${base.cs10.toFixed(0)})` : ''}. Son ~${Math.round(-d10.cs * 21)} de oro perdidos solo en farmeo.` });
    else if (d10.cs >= 10) strengths.push({ id: 'cs10', category: 'Laning', severity: d10.cs >= 20 ? 3 : 2, minute: 10, title: `+${d10.cs} CS de ventaja al 10`, detail: `Farmeaste más que ${champName(opp!)}: ${cs10} contra ${cs10 - d10.cs}.` });
    if (base && cs10 < base.cs10 - 10)
      mistakes.push({ id: 'cs10-usual', category: 'Farming', severity: 1, minute: 10, title: 'Farmeo por debajo de tu nivel', detail: `${cs10} CS al 10 frente a tus ${base.cs10.toFixed(0)} habituales.` });
  }
  if (d15 && Math.abs(d15.gold) >= 800) {
    const ahead = d15.gold > 0;
    (ahead ? strengths : mistakes).push({ id: 'gold15', category: 'Laning', severity: Math.abs(d15.gold) >= 1500 ? 3 : 2, minute: 15, title: `${ahead ? '+' : '−'}${es(Math.abs(d15.gold))} de oro ${ahead ? 'por delante de' : 'por detrás de'} tu rival al 15`, detail: ahead ? 'Ganaste tu calle: usa esa ventaja para presionar objetivos.' : 'Perdiste la calle en economía. Mira de dónde vino: CS, muertes o placas.' });
  }
  if (platesLost >= 3) mistakes.push({ id: 'plates', category: 'Laning', severity: platesLost >= 5 ? 2 : 1, title: `${platesLost} placas de torre perdidas en tu calle`, detail: 'Cada placa son 125 de oro para el rival. Caen cuando estás muerto, vuelves a base en mal momento o rotas sin empujar antes la oleada.' });

  // ───── Deaths, with context
  const deaths: DeathView[] = [];
  const kills = events.filter((e) => e.type === 'CHAMPION_KILL');
  const elite = events.filter((e) => e.type === 'ELITE_MONSTER_KILL');
  for (const e of kills.filter((k) => k.victimId === myId && myId)) {
    const minute = e.timestamp / 60000;
    const pos = e.position ?? pf(Math.floor(minute), myId)?.position ?? { x: 7400, y: 7400 };
    const zoneKey = zoneOf(pos, me.teamId);
    const zone = ZONE_ES[zoneKey];
    const killerIds = [e.killerId ?? 0, ...(e.assistingParticipantIds ?? [])].filter((id) => id > 0);
    const killers = killerIds.map((id) => byId(id)).filter((p): p is ParticipantDto => !!p && p.teamId !== me.teamId);
    const fr = pf(Math.floor(minute), myId) ? Math.floor(minute) : Math.max(0, frames.length - 1);
    const alliesNear = m.info.participants.filter((p) => p.teamId === me.teamId && p.puuid !== puuid).filter((p) => {
      const ap = pf(fr, pid(p))?.position;
      return ap && dist(ap, pos) < 2200;
    }).length;
    const enemyJungler = killers.some((k) => k.teamPosition === 'JUNGLE');
    let kind: DeathView['kind'];
    if (killers.length <= 1) kind = 'solo';
    else if (minute < 14 && zoneKey.endsWith('lane') && enemyJungler) kind = 'gank';
    else if (killers.length >= 3 && alliesNear >= 2) kind = 'teamfight';
    else if (alliesNear === 0 && (zoneKey === 'river' || zoneKey === 'enemy jungle' || (minute >= 14 && zoneKey.endsWith('lane')))) kind = 'caught';
    else if (zoneKey === 'base' || (minute < 14 && killers.length >= 2 && !enemyJungler)) kind = 'dive';
    else kind = 'skirmish';
    // Objective the enemy took within 90 s of this death.
    const lost = elite.find((o) => o.killerTeamId !== me.teamId && o.timestamp > e.timestamp && o.timestamp - e.timestamp < 90_000);
    const objectiveLost = lost ? objName(lost) : null;
    const bounty = (e.bounty ?? 0) + (e.shutdownBounty ?? 0);
    const notes: Record<DeathView['kind'], string> = {
      solo: `Perdiste un 1v1 contra ${champName(killers[0])}.`,
      gank: `Gankeado por ${killers.map(champName).join(' + ')}: participó el jungla.`,
      caught: `Pillado solo en ${zone}, sin aliados cerca.`,
      teamfight: `Moriste en una pelea de ${killers.length} con ${alliesNear} aliados cerca.`,
      dive: `Te divearon ${killers.map(champName).join(' + ')}.`,
      skirmish: `Muerte en escaramuza contra ${killers.map(champName).join(' + ')}.`,
    };
    deaths.push({
      minute,
      x: pos.x,
      y: pos.y,
      zone,
      kind,
      killers: killers.map((k) => ({ champion: champName(k), image: champImg(k) })),
      alliesNear,
      bounty,
      objectiveLost,
      note: notes[kind] + (objectiveLost ? ` Justo después el rival se llevó ${objectiveLost}.` : '') + (bounty >= 500 ? ` Diste una recompensa de ${bounty} de oro.` : ''),
    });
  }
  // ───── Kills you took part in (for the kill map)
  const myKills: KillView[] = [];
  for (const e of kills.filter((k) => myId && (k.killerId === myId || (k.assistingParticipantIds ?? []).includes(myId)))) {
    const minute = e.timestamp / 60000;
    const victim = byId(e.victimId ?? 0);
    const pos = e.position ?? (victim ? pf(Math.floor(minute), pid(victim))?.position : undefined) ?? { x: 7400, y: 7400 };
    const role: KillView['role'] = e.killerId === myId ? 'kill' : 'assist';
    const helpers = [e.killerId ?? 0, ...(e.assistingParticipantIds ?? [])].filter((id) => id > 0 && id !== myId).map((id) => byId(id)).filter((p): p is ParticipantDto => !!p && p.teamId === me.teamId);
    const bounty = (e.bounty ?? 0) + (e.shutdownBounty ?? 0);
    const zone = ZONE_ES[zoneOf(pos, me.teamId)];
    const vName = champName(victim);
    myKills.push({
      minute,
      x: pos.x,
      y: pos.y,
      zone,
      role,
      victim: { champion: vName, image: champImg(victim) },
      with: helpers.map((h) => ({ champion: champName(h), image: champImg(h) })),
      bounty,
      note: (role === 'kill' ? (helpers.length ? `Mataste a ${vName} con ayuda de ${helpers.map(champName).join(' + ')}` : `Mataste a ${vName} en solitario`) : `Asistencia en la muerte de ${vName}`) + ` en ${zone}.` + (bounty >= 500 ? ` Cobraste ${bounty} de oro de recompensa.` : ''),
    });
  }

  const early = deaths.filter((d) => d.minute < 14);
  const ganks = deaths.filter((d) => d.kind === 'gank');
  const solos = deaths.filter((d) => d.kind === 'solo');
  const caught = deaths.filter((d) => d.kind === 'caught');
  const costly = deaths.filter((d) => d.objectiveLost);
  const list = (ds: DeathView[]) => ds.map((d) => fmtMin(d.minute * 60000)).join(', ');
  if (early.length >= 2) mistakes.push({ id: 'early-deaths', category: 'Deaths', severity: early.length >= 3 ? 3 : 2, minute: early[0].minute, title: `${early.length} muertes antes del minuto 14`, detail: `En ${list(early)}. Morir pronto cuesta CS, experiencia y placas, además del oro de la kill.` });
  if (ganks.length >= 2) {
    mistakes.push({ id: 'ganked', category: 'Deaths', severity: 2, minute: ganks[0].minute, title: `Gankeado ${ganks.length} veces`, detail: `En ${list(ganks)}. El jungla enemigo te encontró una y otra vez en la calle.` });
    addAdvice({ id: 'track-jungler', category: 'Deaths', title: 'Controla al jungla enemigo', why: `${ganks.length} de tus muertes fueron ganks.`, how: ['Fíjate en su primer campamento y calcula su ruta: llega a la primera calle hacia el 3:15–3:45.', 'Pon un ward en el río o en el tri-bush antes del 3:00 y otra vez tras tu primera vuelta a base.', 'Si tu oleada está empujada hacia el rival y no ves al jungla, juega como si estuviera en el arbusto.'] });
  }
  if (solos.length >= 2) {
    mistakes.push({ id: 'solo-deaths', category: 'Deaths', severity: 2, minute: solos[0].minute, title: `${solos.length} muertes en 1v1`, detail: `En ${list(solos)}, contra ${[...new Set(solos.flatMap((d) => d.killers.map((k) => k.champion)))].join(', ')}.` });
    addAdvice({ id: 'trading', category: 'Fighting', title: 'Elige tus duelos', why: `Perdiste ${solos.length} uno contra uno.`, how: ['Mira el nivel, los objetos y los hechizos de invocador del rival antes de entrar.', 'Tradea cuando su habilidad clave esté en enfriamiento y retírate cuando la tenga.', 'Aprende los picos de poder del enfrentamiento (nivel 2/3/6, primer objeto) y no pelees contra ellos.'] });
  }
  if (caught.length >= 2) {
    mistakes.push({ id: 'caught', category: 'Deaths', severity: caught.length >= 3 ? 3 : 2, minute: caught[0].minute, title: `Pillado ${caught.length} veces`, detail: `Solo en ${[...new Set(caught.map((d) => d.zone))].join(' / ')} en ${list(caught)}.` });
    addAdvice({ id: 'mid-game-positioning', category: 'Deaths', title: 'No entres a ciegas tras la fase de líneas', why: `${caught.length} muertes vinieron de ir solo por zonas sin visión.`, how: ['A partir del minuto 14, muévete por la jungla con al menos un compañero o detrás de tus wards.', 'Antes de ir a una calle lateral, cuenta cuántos rivales faltan en el mapa: si faltan 3 o más, retírate.', 'Usa el barredor o un ward de control para limpiar el camino en vez de entrar tú primero.'] });
  }
  if (costly.length) {
    mistakes.push({ id: 'death-objective', category: 'Objectives', severity: costly.length >= 2 ? 3 : 2, minute: costly[0].minute, title: `Muertes que regalaron ${costly.map((d) => d.objectiveLost).join(', ')}`, detail: `Moriste en ${list(costly)} y el rival aseguró un objetivo en menos de 90 segundos.` });
    addAdvice({ id: 'objective-setup', category: 'Objectives', title: 'Juega seguro antes de que salgan los objetivos', why: 'Tus muertes le dieron objetivos gratis al rival.', how: ['Desde ~60 s antes de que salga un dragón o el Barón, evita jugadas arriesgadas y deja tu oleada empujada.', 'Vuelve a base con tiempo para regresar con la vida llena y un ward de control.', 'Si mueres en esa ventana, avisa a tu equipo para ceder el objetivo en vez de pelearlo 4 contra 5.'] });
  }
  if (deaths.length <= 2 && minutes >= 20) strengths.push({ id: 'survival', category: 'Deaths', severity: deaths.length === 0 ? 3 : 2, title: deaths.length === 0 ? 'Partida sin morir' : `Solo ${deaths.length} muertes`, detail: `Seguiste vivo en una partida de ${Math.round(minutes)} minutos${base ? ` (lo normal: ${base.deaths.toFixed(1)} muertes)` : ''}.` });
  const timeDead = num(me, 'totalTimeSpentDead') / (minutes * 60);
  if (timeDead >= 0.15) mistakes.push({ id: 'time-dead', category: 'Deaths', severity: timeDead >= 0.22 ? 3 : 2, title: `Muerto el ${pct(timeDead)} de la partida`, detail: `${Math.round(num(me, 'totalTimeSpentDead') / 60)} minutos con la pantalla en gris: el mapa se juega sin ti.` });
  const bountyGiven = deaths.reduce((s, d) => s + d.bounty, 0);
  if (deaths.some((d) => d.bounty >= 600)) mistakes.push({ id: 'shutdown', category: 'Economy', severity: 2, title: 'Regalaste un shutdown', detail: `Tus muertes dieron ${es(bountyGiven)} de oro en recompensas. Juega más seguro cuando tengas recompensa.` });

  // ───── Objectives
  const objectives = elite.map((o) => {
    const involved = o.killerId === myId || (o.assistingParticipantIds ?? []).includes(myId);
    const youDead = deaths.some((d) => o.timestamp / 60000 - d.minute >= 0 && o.timestamp / 60000 - d.minute < 0.5 + Math.min(1, d.minute / 30));
    return { minute: o.timestamp / 60000, label: objLabel(objName(o)) ?? 'Objetivo', good: o.killerTeamId === me.teamId, involved, youDead };
  });
  const ours = objectives.filter((o) => o.good);
  const share = ours.length ? ours.filter((o) => o.involved).length / ours.length : null;
  if (share != null && ours.length >= 3) {
    if (share >= 0.7) strengths.push({ id: 'objectives', category: 'Objectives', severity: 2, title: `Presente en el ${pct(share)} de los objetivos de tu equipo`, detail: `Participaste en ${ours.filter((o) => o.involved).length} de ${ours.length} monstruos épicos.` });
    else if (share < 0.35 && !isSupport) mistakes.push({ id: 'objectives', category: 'Objectives', severity: isJungle ? 3 : 1, title: `Solo participaste en el ${pct(share)} de los objetivos de tu equipo`, detail: isJungle ? 'Como jungla, los objetivos son cosa tuya: planifica tus rutas según cuándo salen.' : 'Rota al dragón o al Barón cuando tengas tu calle empujada.' });
  }

  // ───── Farming after laning
  if (!isSupport && series.cs.length > 20 && minutes >= 24) {
    const early14 = series.cs[14]?.[0] ?? 0;
    const mid = (series.cs[Math.min(series.cs.length - 1, 25)][0] - early14) / Math.max(1, Math.min(series.cs.length - 1, 25) - 14);
    const laneRate = early14 / 14;
    if (mid < laneRate * 0.75) {
      mistakes.push({ id: 'midgame-farm', category: 'Farming', severity: 2, minute: 14, title: 'El farmeo cayó tras la fase de líneas', detail: `${laneRate.toFixed(1)} CS/min hasta el 14:00 y ${mid.toFixed(1)} CS/min del 14 al 25.` });
      addAdvice({ id: 'mid-game-farm', category: 'Farming', title: 'Sigue farmeando entre peleas', why: 'Tu ritmo de CS bajó tras la fase de líneas.', how: ['Cuando no pase nada en el mapa, recoge la oleada de la calle lateral más cercana al siguiente objetivo.', 'Llévate los campamentos de tu lado cuando pases por ellos.', 'Con carries, apunta a 7 CS/min como mínimo en el medio juego; revisa del minuto 14 al 25 en las repeticiones.'] });
    }
  }
  if (!isSupport && met.csPerMin >= (base ? base.csPerMin + 0.6 : norm.cs10 / 10 + 0.8)) strengths.push({ id: 'farm', category: 'Farming', severity: 1, title: `${met.csPerMin.toFixed(1)} CS/min`, detail: base ? `Por encima de tus ${base.csPerMin.toFixed(1)} habituales.` : 'Muy buen farmeo para tu rol.' });

  // ───── Gold sitting unspent
  if (tl && myId) {
    for (let i = 8; i < frames.length - 1; i++) {
      const g = pf(i, myId)?.currentGold ?? 0, g2 = pf(i + 1, myId)?.currentGold ?? 0;
      if (g >= 2200 && g2 >= 2200) {
        mistakes.push({ id: 'unspent', category: 'Build', severity: 1, minute: i, title: `${es(g)} de oro sin gastar en el ${i}:00`, detail: 'Más de 2.000 de oro sin gastar durante más de un minuto: volver a base a tiempo te habría completado un objeto.' });
        break;
      }
    }
  }

  // ───── Build: completed legendaries and boots
  const build: PostGameView['build'] = [];
  for (const e of events.filter((x) => x.type === 'ITEM_PURCHASED' && x.participantId === myId && x.itemId)) {
    const it = dd.item(e.itemId!);
    if (!it || (!it.legendary && !it.boots)) continue;
    if (it.boots && build.some((b) => b.kind === 'boots')) continue;
    build.push({ minute: e.timestamp / 60000, name: it.name, image: dd.itemImg(e.itemId!), kind: it.legendary ? 'legendary' : 'boots' });
  }
  const firstLeg = build.find((b) => b.kind === 'legendary');
  if (firstLeg && !isSupport) {
    if (firstLeg.minute > (isJungle ? 15 : 14.5)) mistakes.push({ id: 'first-item', category: 'Build', severity: firstLeg.minute > 17 ? 2 : 1, minute: firstLeg.minute, title: `Primer objeto en el ${fmtMin(firstLeg.minute * 60000)}`, detail: `${firstLeg.name} llegó tarde; la mayoría lo completa hacia el minuto 12–13. Los objetos tardíos vienen de poco farmeo, muertes o malas vueltas a base.` });
    else if (firstLeg.minute <= 11.5) strengths.push({ id: 'first-item', category: 'Build', severity: 1, minute: firstLeg.minute, title: `${firstLeg.name} rápido`, detail: `Completado en el ${fmtMin(firstLeg.minute * 60000)}.` });
  }

  // ───── Vision
  const vpm = met.visionPerMin;
  const vNorm = base ? Math.max(base.visionPerMin, norm.visionPerMin * 0.8) : norm.visionPerMin;
  const control = num(me, 'detectorWardsPlaced');
  if (vpm < vNorm * 0.7) {
    mistakes.push({ id: 'vision', category: 'Vision', severity: isSupport || isJungle ? 3 : 2, title: `Poca visión: ${vpm.toFixed(2)} por minuto`, detail: `Se espera ~${vNorm.toFixed(2)}${base ? ' (lo normal en ti)' : ` para ${ROLE_NAMES[role]}`}. ${num(me, 'wardsPlaced')} wards colocados, ${control} de control y ${num(me, 'wardsKilled')} destruidos.` });
    addAdvice({ id: 'vision', category: 'Vision', title: 'Compra un ward de control en cada vuelta a base', why: `Visión ${vpm.toFixed(2)}/min, ${control} wards de control.`, how: ['Que el ward de control forme parte de cada vuelta a base; lleva siempre uno en el inventario.', 'Usa el abalorio cada vez que esté disponible en la calle (arbusto del río o tri-bush).', 'Antes de cada objetivo, pon 2 wards alrededor del foso 60 s antes.'] });
  } else if (vpm >= vNorm * 1.25) strengths.push({ id: 'vision', category: 'Vision', severity: 1, title: `Gran visión: ${vpm.toFixed(2)}/min`, detail: `${num(me, 'wardsPlaced')} wards colocados y ${num(me, 'wardsKilled')} destruidos.` });
  if (control === 0 && minutes >= 20 && !advice.has('vision')) mistakes.push({ id: 'no-control', category: 'Vision', severity: 1, title: 'Ningún ward de control', detail: '75 de oro que quitan visión y protegen objetivos: compra uno en cada vuelta a base.' });

  // ───── Fighting
  const kp = met.killParticipation;
  if (kp >= Math.max(0.65, norm.kp + 0.1)) strengths.push({ id: 'kp', category: 'Fighting', severity: 2, title: `${pct(kp)} de participación en kills`, detail: 'Estuviste en casi todas las peleas importantes.' });
  else if (kp < norm.kp - 0.15 && minutes >= 18) {
    mistakes.push({ id: 'kp', category: 'Fighting', severity: 2, title: `Poca participación en kills: ${pct(kp)}`, detail: `Tu equipo peleó sin ti (${role === 'TOP' ? 'es normal en top, pero únete a las grandes' : `se espera ~${pct(norm.kp)}`}).` });
    addAdvice({ id: 'join-fights', category: 'Fighting', title: 'Llega a las peleas', why: `Solo participaste en el ${pct(kp)} de las kills de tu equipo.`, how: ['Mira el minimapa cada pocos segundos; cuando tu equipo se agrupe, empuja tu oleada y rota.', 'Usa Teleportar o rota a los objetivos en vez de farmear solo mientras 4 pelean.'] });
  }
  const dmgTaken = ch(me, 'damageTakenOnTeamPercentage');
  if (!isSupport && (role === 'MIDDLE' || role === 'BOTTOM')) {
    if (met.damageShare >= 0.3) strengths.push({ id: 'damage', category: 'Fighting', severity: 2, title: `${pct(met.damageShare)} del daño de tu equipo`, detail: 'Cargaste con el daño del equipo.' });
    else if (met.damageShare < norm.dmg - 0.07) mistakes.push({ id: 'damage', category: 'Fighting', severity: 2, title: `Poco daño: ${pct(met.damageShare)} del equipo`, detail: `Como carry en ${ROLE_NAMES[role]} se espera ~${pct(norm.dmg)}. Pega a más objetivos en las peleas o farmea hasta tus picos de objetos.` });
    if (dmgTaken >= 0.27 && met.damageShare < dmgTaken) {
      mistakes.push({ id: 'positioning', category: 'Fighting', severity: 2, title: 'Recibiste más daño del que hiciste', detail: `Recibiste el ${pct(dmgTaken)} del daño de tu equipo e hiciste el ${pct(met.damageShare)}: un carry haciendo de primera línea.` });
      addAdvice({ id: 'positioning', category: 'Fighting', title: 'Pelea desde tu rango máximo', why: 'Absorbiste daño que debería recibir tu primera línea.', how: ['Deja que la primera línea inicie; entra cuando el rival haya gastado sus habilidades clave.', 'Pega al objetivo seguro más cercano en vez de avanzar hacia su carry.', 'Practica el kiteo: ataca, retrocede, ataca.'] });
    }
  }
  const soloKills = ch(me, 'soloKills');
  if (soloKills >= 2) strengths.push({ id: 'solo-kills', category: 'Fighting', severity: soloKills >= 4 ? 3 : 2, title: `${soloKills} solo kills`, detail: 'Ganaste tus 1v1.' });
  if (me.largestMultiKill >= 3) strengths.push({ id: 'multi', category: 'Fighting', severity: me.largestMultiKill >= 4 ? 3 : 2, title: me.largestMultiKill >= 5 ? 'Pentakill' : me.largestMultiKill === 4 ? 'Quadrakill' : 'Triple kill', detail: 'Le diste la vuelta a una pelea tú solo.' });
  const hit = ch(me, 'skillshotsHit'), dodged = ch(me, 'skillshotsDodged');
  if (dodged >= 25) strengths.push({ id: 'dodge', category: 'Fighting', severity: 1, title: `${dodged} habilidades esquivadas`, detail: 'Muy buen movimiento en las peleas.' });

  // ───── Advice derived from the most severe mistakes that don't have their own block yet
  if (mistakes.some((x) => x.id === 'cs10' || x.id === 'cs10-usual'))
    addAdvice({ id: 'cs-drill', category: 'Farming', title: 'Practica el último golpe', why: `${cs10} CS al minuto 10.`, how: ['10 minutos en la Herramienta de práctica, sin objetos ni runas: apunta a 80+ CS en el 10:00.', 'En la calle, prioriza los súbditos de asedio y aprende a rematar bajo torre: dos ataques básicos a los cuerpo a cuerpo, habilidad + básico a los casters.', 'Si el enfrentamiento es difícil, renuncia a tradear, no al CS.'] });
  if (mistakes.some((x) => x.id === 'early-deaths') && !advice.has('track-jungler') && !advice.has('trading'))
    addAdvice({ id: 'early-safety', category: 'Deaths', title: 'Respeta el early game', why: `${early.length} muertes antes del minuto 14.`, how: ['Controla los hechizos de invocador del rival: juega más seguro mientras tenga Destello o Prender.', 'Vuelve a base con tu oleada empujada contra la torre enemiga.', 'Con poca vida, vuelve a base en vez de quedarte "una oleada más".'] });
  if (mistakes.some((x) => x.id === 'first-item' || x.id === 'unspent'))
    addAdvice({ id: 'recalls', category: 'Build', title: 'Elige bien cuándo volver a base', why: 'Tus objetos llegaron tarde.', how: ['Vuelve justo después de empujar una oleada o tirar una placa, a ser posible con oro para un componente.', 'Planifica tu primera vuelta hacia los 1.100–1.300 de oro en la mayoría de builds.', 'No te quedes en el mapa con más de 2.000 de oro sin gastar.'] });

  // ───── Grade & headline
  const score = scoreFor(m, puuid);
  const grade: PostGameView['grade'] = score >= 8.5 ? 'S' : score >= 7.2 ? 'A' : score >= 5.8 ? 'B' : score >= 4.5 ? 'C' : 'D';
  const sev = (xs: Insight[]) => [...xs].sort((a, b) => b.severity - a.severity);
  const topBad = sev(mistakes)[0];
  const topGood = sev(strengths)[0];
  const headline = topGood && topBad ? `${topGood.title}, pero ${topBad.title.charAt(0).toLowerCase()}${topBad.title.slice(1)}.` : topGood ? `${topGood.title}.` : topBad ? `${topBad.title}.` : 'Una partida regular y equilibrada.';

  // ───── Stat groups
  const row = (label: string, you: number, other: number | null, usual: number | null, f: (v: number) => string, eps: number, higher = true): CompareRow => ({
    label,
    you: f(you),
    other: other != null ? f(other) : null,
    usual: usual != null ? f(usual) : null,
    tone: toneOf(you - (other ?? usual ?? you), eps, higher),
  });
  const o = opp;
  const stats: PostGameView['stats'] = [
    {
      group: 'Combate',
      rows: [
        row('KDA', met.kda, oppMet?.kda ?? null, null, (v) => v.toFixed(2), 0.3),
        row('Participación en kills', kp, oppMet?.killParticipation ?? null, base?.killParticipation ?? null, pct, 0.04),
        row('Daño del equipo', met.damageShare, oppMet?.damageShare ?? null, base?.damageShare ?? null, pct, 0.02),
        row('Daño recibido del equipo', dmgTaken, o ? ch(o, 'damageTakenOnTeamPercentage') : null, null, pct, 0.03, false),
        row('Solo kills', soloKills, o ? ch(o, 'soloKills') : null, null, (v) => v.toFixed(0), 0.5),
        row('Habilidades acertadas / esquivadas', hit, null, null, (v) => `${v.toFixed(0)} / ${dodged}`, 999),
        row('Tiempo de control aplicado', num(me, 'timeCCingOthers'), o ? num(o, 'timeCCingOthers') : null, null, (v) => `${v.toFixed(0)} s`, 4),
      ],
    },
    {
      group: 'Economía',
      rows: [
        row('CS / min', met.csPerMin, oppMet?.csPerMin ?? null, base?.csPerMin ?? null, (v) => v.toFixed(1), 0.3),
        row('Oro / min', met.goldPerMin, oppMet?.goldPerMin ?? null, base?.goldPerMin ?? null, (v) => v.toFixed(0), 15),
        row('Máx. ventaja de CS sobre el rival', ch(me, 'maxCsAdvantageOnLaneOpponent'), null, null, (v) => v.toFixed(0), 999),
        row('Placas de torre ganadas', ch(me, 'turretPlatesTaken'), o ? ch(o, 'turretPlatesTaken') : null, null, (v) => v.toFixed(0), 0.5),
      ],
    },
    {
      group: 'Visión',
      rows: [
        row('Visión / min', vpm, oppMet?.visionPerMin ?? null, base?.visionPerMin ?? null, (v) => v.toFixed(2), 0.08),
        row('Wards colocados', num(me, 'wardsPlaced'), o ? num(o, 'wardsPlaced') : null, null, (v) => v.toFixed(0), 2),
        row('Wards de control', control, o ? num(o, 'detectorWardsPlaced') : null, base?.controlWards ?? null, (v) => v.toFixed(0), 0.5),
        row('Wards destruidos', num(me, 'wardsKilled'), o ? num(o, 'wardsKilled') : null, null, (v) => v.toFixed(0), 1),
      ],
    },
    {
      group: 'Supervivencia',
      rows: [
        row('Muertes', me.deaths, o?.deaths ?? null, base?.deaths ?? null, (v) => v.toFixed(0), 0.5, false),
        row('Tiempo muerto', timeDead, null, null, pct, 0.02, false),
        row('Vida más larga', num(me, 'longestTimeSpentLiving') / 60, null, null, (v) => `${v.toFixed(1)} min`, 999),
      ],
    },
  ];

  return {
    grade,
    headline,
    role: ROLE_NAMES[role] ?? role,
    opponent: o ? { name: o.riotIdGameName ?? '', champion: champName(o), image: champImg(o) } : null,
    laning,
    series,
    deaths,
    kills: myKills,
    mapImage: `https://ddragon.leagueoflegends.com/cdn/${dd.version}/img/map/map11.png`,
    objectives,
    build,
    stats,
    strengths: sev(strengths),
    mistakes: sev(mistakes),
    advice: [...advice.values()],
    baselineGames: base?.games ?? 0,
  };
}

/** "el Barón" -> "Barón", for chips and timeline labels. */
const objLabel = (n: string | null) => (n ? n.replace(/^(el|la|las|los|un|una) /, '').replace(/^./, (c) => c.toUpperCase()) : null);

function objName(e: TimelineEventDto): string | null {
  switch (e.monsterType) {
    case 'DRAGON':
      return e.monsterSubType === 'ELDER_DRAGON' ? 'el Dragón Ancestral' : 'un dragón';
    case 'BARON_NASHOR':
      return 'el Barón';
    case 'RIFTHERALD':
      return 'el Heraldo';
    case 'HORDE':
      return 'las Larvas del Vacío';
    case 'ATAKHAN':
      return 'Atakhan';
    default:
      return null;
  }
}

