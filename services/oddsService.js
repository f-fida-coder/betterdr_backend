const axios = require('axios');
const Match = require('../models/Match');
const socketIo = require('../socket');
const betController = require('../controllers/betController');

// API Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_URL = 'https://api.the-odds-api.com/v4';
const ODDS_API_REGIONS = process.env.ODDS_API_REGIONS || 'us';
const ODDS_API_MARKETS = process.env.ODDS_API_MARKETS || 'h2h,spreads,totals';
const ODDS_API_ODDS_FORMAT = process.env.ODDS_API_ODDS_FORMAT || 'american';
const ODDS_API_BOOKMAKERS = process.env.ODDS_API_BOOKMAKERS || '';
const ODDS_CACHE_TTL_MINUTES = Math.max(1, parseInt(process.env.ODDS_CACHE_TTL_MINUTES || '10', 10) || 10);
const ODDS_ALLOWED_SPORTS = process.env.ODDS_ALLOWED_SPORTS || 'basketball_nba,americanfootball_nfl,soccer_epl,baseball_mlb,icehockey_nhl';
const SPORTS_API_ENABLED = String(process.env.SPORTS_API_ENABLED || 'true').toLowerCase() === 'true';
const SPORTS_API_MAX_CALLS_PER_DAY = Math.max(0, parseInt(process.env.SPORTS_API_MAX_CALLS_PER_DAY || '1000', 10) || 0);
const ODDS_SCORES_ENABLED = String(process.env.ODDS_SCORES_ENABLED || 'true').toLowerCase() === 'true';
const ODDS_SCORES_DAYS_FROM = Math.max(0, parseInt(process.env.ODDS_SCORES_DAYS_FROM || '0', 10) || 0);

const oddsCache = {
    data: null,
    expiresAt: 0,
    inFlight: null,
    lastFetchedAt: null
};

const parseList = (value) => value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

const callsToday = {
    date: new Date().toISOString().slice(0, 10),
    count: 0
};

const resetDailyCounterIfNeeded = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (callsToday.date !== today) {
        callsToday.date = today;
        callsToday.count = 0;
    }
};

const logExternalCall = ({ endpoint, sport, market, bookmaker }) => {
    console.log(`[SPORTS_API] ${new Date().toISOString()} endpoint=${endpoint} sport=${sport} market=${market} bookmaker=${bookmaker}`);
};

/**
 * Service to fetch odds and update matches in the database.
 */
class OddsService {
    constructor() {
        this._updateInFlight = null;
    }

    /**
     * Fetch odds from external API (single-pass, limited sports/markets/bookmakers).
     * This is the ONLY place that calls the external Sports API.
     */
    async fetchOddsFromApi() {
        if (!SPORTS_API_ENABLED) {
            console.warn('⚠️  SPORTS_API_ENABLED=false. External Sports API calls are blocked.');
            return { events: oddsCache.data || [], apiCalls: 0, blocked: true };
        }

        if (!ODDS_API_KEY) {
            console.warn('⚠️  ODDS_API_KEY is missing in .env. Returning empty data (mock data disabled).');
            return { events: [], apiCalls: 0, blocked: true };
        }

        const allowedSports = parseList(ODDS_ALLOWED_SPORTS);
        if (allowedSports.length === 0) {
            console.warn('⚠️  No allowed sports configured. Returning empty data (mock data disabled).');
            return { events: [], apiCalls: 0, blocked: true };
        }

        // Credits saved:
        // - No /sports catalog call
        // - Only allowlisted sports
        // - Only configured markets (default: h2h)
        console.log(`🌐 External Sports API call (odds) | sports=${allowedSports.length} | markets=${ODDS_API_MARKETS}`);

        try {
            resetDailyCounterIfNeeded();
            if (SPORTS_API_MAX_CALLS_PER_DAY > 0 && callsToday.count >= SPORTS_API_MAX_CALLS_PER_DAY) {
                console.error(`🚨 CRITICAL: SPORTS_API_MAX_CALLS_PER_DAY reached (${SPORTS_API_MAX_CALLS_PER_DAY}). Blocking further external calls.`);
                return { events: oddsCache.data || [], apiCalls: 0, blocked: true };
            }
            const allEventsMap = new Map();
            let apiCalls = 0;

            for (const sportKey of allowedSports) {
                resetDailyCounterIfNeeded();
                if (SPORTS_API_MAX_CALLS_PER_DAY > 0 && callsToday.count >= SPORTS_API_MAX_CALLS_PER_DAY) {
                    console.error(`🚨 CRITICAL: SPORTS_API_MAX_CALLS_PER_DAY reached (${SPORTS_API_MAX_CALLS_PER_DAY}). Blocking further external calls.`);
                    return { events: oddsCache.data || [] };
                }
                try {
                    const params = {
                        apiKey: ODDS_API_KEY,
                        regions: ODDS_API_REGIONS,
                        markets: ODDS_API_MARKETS,
                        oddsFormat: ODDS_API_ODDS_FORMAT
                    };
                    if (ODDS_API_BOOKMAKERS) {
                        params.bookmakers = ODDS_API_BOOKMAKERS;
                    }

                    const endpoint = `${ODDS_API_URL}/sports/${sportKey}/odds`;
                    logExternalCall({
                        endpoint,
                        sport: sportKey,
                        market: ODDS_API_MARKETS,
                        bookmaker: ODDS_API_BOOKMAKERS || 'all'
                    });
                    callsToday.count += 1;
                    apiCalls += 1;

                    const oddsResponse = await axios.get(endpoint, { params });
                    const oddsData = Array.isArray(oddsResponse.data) ? oddsResponse.data : [];

                    oddsData.forEach((event) => {
                        const eventId = event.id || `${sportKey}:${event.commence_time}:${event.home_team}:${event.away_team}`;
                        allEventsMap.set(eventId, {
                            ...event,
                            id: eventId,
                            sport: event.sport || sportKey,
                            sportTitle: event.sport_title || event.sportTitle || event.sport || sportKey
                        });
                    });

                    console.log(`  ✅ ${sportKey}: fetched ${oddsData.length} events`);
                } catch (err) {
                    console.error(`  ❌ ${sportKey}: ${err.message}`);
                }
            }

            return { events: Array.from(allEventsMap.values()), apiCalls };
        } catch (error) {
            console.error('❌ Error in fetchOddsFromApi:', error.message);
            if (error.response) {
                console.error('   API Status:', error.response.status);
            }
            // Do NOT fall back to mock data on error
            return { events: [], apiCalls: 0, error: error.message };
        }
    }

    /**
     * Fetch live scores from external API (per sport).
     */
    async fetchScoresFromApi(sportKeys = []) {
        if (!ODDS_SCORES_ENABLED) {
            console.warn('⚠️  ODDS_SCORES_ENABLED=false. Scores fetch is disabled.');
            return { scoresById: new Map(), apiCalls: 0, blocked: true };
        }

        if (!SPORTS_API_ENABLED) {
            console.warn('⚠️  SPORTS_API_ENABLED=false. External Sports API calls are blocked.');
            return { scoresById: new Map(), apiCalls: 0, blocked: true };
        }

        if (!ODDS_API_KEY) {
            console.warn('⚠️  ODDS_API_KEY is missing in .env. Returning empty score data.');
            return { scoresById: new Map(), apiCalls: 0, blocked: true };
        }

        const allowedSports = Array.isArray(sportKeys) && sportKeys.length
            ? sportKeys
            : parseList(ODDS_ALLOWED_SPORTS);

        if (allowedSports.length === 0) {
            return { scoresById: new Map(), apiCalls: 0, blocked: true };
        }

        const scoresById = new Map();
        let apiCalls = 0;

        for (const sportKey of allowedSports) {
            resetDailyCounterIfNeeded();
            if (SPORTS_API_MAX_CALLS_PER_DAY > 0 && callsToday.count >= SPORTS_API_MAX_CALLS_PER_DAY) {
                console.error(`🚨 CRITICAL: SPORTS_API_MAX_CALLS_PER_DAY reached (${SPORTS_API_MAX_CALLS_PER_DAY}). Blocking further external calls.`);
                return { scoresById, apiCalls, blocked: true };
            }

            try {
                const params = {
                    apiKey: ODDS_API_KEY,
                    dateFormat: 'iso'
                };
                if (ODDS_SCORES_DAYS_FROM > 0) {
                    params.daysFrom = ODDS_SCORES_DAYS_FROM;
                }

                const endpoint = `${ODDS_API_URL}/sports/${sportKey}/scores`;
                logExternalCall({
                    endpoint,
                    sport: sportKey,
                    market: 'scores',
                    bookmaker: 'n/a'
                });
                callsToday.count += 1;
                apiCalls += 1;

                const scoresResponse = await axios.get(endpoint, { params });
                const scoresData = Array.isArray(scoresResponse.data) ? scoresResponse.data : [];
                scoresData.forEach((event) => {
                    if (event?.id) {
                        scoresById.set(event.id, event);
                    }
                });
            } catch (err) {
                console.error(`  ❌ scores ${sportKey}: ${err.message}`);
            }
        }

        return { scoresById, apiCalls };
    }

    /**
     * TTL-based cache for external API results.
     * - Cache hit: no external call
     * - Cache miss: one external call (single in-flight)
     */
    async getCachedOdds({ force = false } = {}) {
        const now = Date.now();
        if (!SPORTS_API_ENABLED) {
            console.warn('⚠️  SPORTS_API_ENABLED=false. Serving cached/DB data only.');
            return { events: oddsCache.data || [], cache: 'disabled', fetchedAt: oddsCache.lastFetchedAt, apiCalls: 0 };
        }
        if (!force && oddsCache.data && oddsCache.expiresAt > now) {
            console.log('🟢 Odds cache hit');
            return { events: oddsCache.data, cache: 'hit', fetchedAt: oddsCache.lastFetchedAt, apiCalls: 0 };
        }

        if (oddsCache.inFlight) {
            console.log('🟡 Odds cache wait (in-flight)');
            return oddsCache.inFlight;
        }

        console.log('🔴 Odds cache miss - fetching new data');
        oddsCache.inFlight = (async () => {
            const data = await this.fetchOddsFromApi();
            const events = data.events || data;
            oddsCache.data = events;
            oddsCache.lastFetchedAt = new Date();
            oddsCache.expiresAt = Date.now() + ODDS_CACHE_TTL_MINUTES * 60 * 1000;
            return { events, cache: 'miss', fetchedAt: oddsCache.lastFetchedAt, apiCalls: data.apiCalls || 0 };
        })().finally(() => {
            oddsCache.inFlight = null;
        });

        return oddsCache.inFlight;
    }

    clearCache() {
        oddsCache.data = null;
        oddsCache.expiresAt = 0;
        oddsCache.lastFetchedAt = null;
        oddsCache.inFlight = null;
        console.log('🧹 Odds cache cleared');
    }

    /**
     * Update matches in the database with cached data.
     * Prevents concurrent updates (single in-flight update).
     */
    async updateMatches({ source = 'cron', forceFetch = false } = {}) {
        if (this._updateInFlight) {
            console.log('⏳ Odds update already in progress, reusing in-flight job.');
            return this._updateInFlight;
        }

        this._updateInFlight = (async () => {
            console.log('🔄 Starting Odds Update...');
            try {
                const data = await this.getCachedOdds({ force: forceFetch });
                if (source !== 'cron') {
                    console.log(`✅ Manual fetch completed. source=${source} cache=${data.cache} apiCalls=${data.apiCalls || 0}`);
                }
                const events = Array.isArray(data.events) ? data.events : [];
                const allowedSports = parseList(ODDS_ALLOWED_SPORTS);
                let scoresById = new Map();
                if (ODDS_SCORES_ENABLED) {
                    const scoreData = await this.fetchScoresFromApi(allowedSports);
                    scoresById = scoreData.scoresById || new Map();
                }

                const hashString = (str) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
                    }
                    return hash >>> 0;
                };

                const seededRandom = (seed) => {
                    let t = seed + 0x6D2B79F5;
                    return () => {
                        t = Math.imul(t ^ (t >>> 15), t | 1);
                        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                    };
                };

                let createdCount = 0;
                let updatedCount = 0;

                for (const event of events) {
                    const homeTeam = event.home_team || 'Unknown Home';
                    const awayTeam = event.away_team || 'Unknown Away';
                    const sportName = event.sportTitle || event.sport || 'unknown';

                    let oddsData = {};
                    if (event.bookmakers && event.bookmakers.length > 0) {
                        const mainBookmaker = event.bookmakers[0];
                        oddsData = {
                            bookmaker: mainBookmaker.title,
                            markets: mainBookmaker.markets
                        };
                    } else {
                        // FALLBACK: Generate deterministic mock odds if API returns none
                        const seedKey = `${event.id || ''}|${homeTeam}|${awayTeam}|${event.commence_time || ''}`;
                        const rng = seededRandom(hashString(seedKey));
                        const randIn = (min, max) => min + (max - min) * rng();
                        const roundHalf = (n) => Math.round(n * 2) / 2;

                        const spreadPoint = roundHalf(randIn(1, 7));
                        const totalPoint = roundHalf(randIn(38, 55));
                        const price1 = Number(randIn(1.72, 2.12).toFixed(2));
                        const price2 = Number(randIn(1.72, 2.12).toFixed(2));
                        const money1 = Number(randIn(1.60, 2.40).toFixed(2));
                        const money2 = Number(randIn(1.60, 2.40).toFixed(2));

                        oddsData = {
                            bookmaker: 'DemoOdds',
                            markets: [
                                {
                                    key: 'h2h',
                                    outcomes: [
                                        { name: homeTeam, price: money1 },
                                        { name: awayTeam, price: money2 }
                                    ]
                                },
                                {
                                    key: 'spreads',
                                    outcomes: [
                                        { name: homeTeam, price: price1, point: -spreadPoint },
                                        { name: awayTeam, price: price2, point: spreadPoint }
                                    ]
                                },
                                {
                                    key: 'totals',
                                    outcomes: [
                                        { name: 'Over', price: price1, point: totalPoint },
                                        { name: 'Under', price: price2, point: totalPoint }
                                    ]
                                }
                            ]
                        };
                    }

                    const externalId = event.id || event.externalId;
                    let match = await Match.findOne({ externalId });

                    const extractScoreAndStatus = (ev, home, away) => {
                        const out = { score: {}, status: 'scheduled' };
                        const num = (v) => (v === undefined || v === null) ? undefined : Number(v);
                        const s = ev.score || ev.scores || ev;

                        const score_home = s.score_home ?? s.home_score ?? s.homeScore ?? ev.home_score ?? ev.homeScore;
                        const score_away = s.score_away ?? s.away_score ?? s.awayScore ?? ev.away_score ?? ev.awayScore;
                        const scoresArray = Array.isArray(s.scores) ? s.scores : (Array.isArray(ev.scores) ? ev.scores : null);
                        const period = s.period ?? s.periodName ?? s.period_name ?? ev.period;
                        const event_status = s.event_status ?? s.status ?? ev.status ?? s.eventStatus;

                        if (score_home !== undefined || score_away !== undefined) {
                            out.score.score_home = num(score_home) ?? 0;
                            out.score.score_away = num(score_away) ?? 0;
                        } else if (scoresArray && home && away) {
                            const homeScore = scoresArray.find(item => item?.name === home)?.score;
                            const awayScore = scoresArray.find(item => item?.name === away)?.score;
                            if (homeScore !== undefined || awayScore !== undefined) {
                                out.score.score_home = num(homeScore) ?? 0;
                                out.score.score_away = num(awayScore) ?? 0;
                            }
                        }

                        if (period) out.score.period = period;
                        if (event_status) out.score.event_status = event_status;

                        const st = (event_status || '').toString().toUpperCase();
                        if (st.includes('IN_PROGRESS') || st.includes('LIVE') || st.includes('STATUS_IN_PROGRESS')) {
                            out.status = 'live';
                        } else if (st.includes('FINAL') || st.includes('COMPLETE') || st.includes('STATUS_CLOSED')) {
                            out.status = 'finished';
                        } else if (ev.completed === true) {
                            out.status = 'finished';
                        } else if (ev.completed === false && scoresArray) {
                            out.status = 'live';
                        } else if (ev.status && ev.status.toString().toLowerCase() === 'live') {
                            out.status = 'live';
                        }

                        return out;
                    };

                    const scoreEvent = scoresById.get(externalId);
                    const mergedEvent = scoreEvent ? { ...event, ...scoreEvent } : event;
                    const { score: scorePayload, status: statusPayload } = extractScoreAndStatus(mergedEvent, homeTeam, awayTeam);

                    const matchData = {
                        externalId,
                        homeTeam: homeTeam,
                        awayTeam: awayTeam,
                        startTime: event.commence_time,
                        sport: sportName,
                        status: statusPayload,
                        odds: oddsData,
                        score: Object.keys(scorePayload || {}).length ? scorePayload : undefined,
                        lastUpdated: new Date()
                    };

                    if (match) {
                        const oldStatus = match.status;
                        Object.assign(match, matchData);
                        await match.save();

                        try { socketIo.getIo().emit('matchUpdate', match); } catch (e) { }

                        // New: Trigger automated settlement if match just finished
                        if (match.status === 'finished' && oldStatus !== 'finished') {
                            console.log(`🏁 Match ${match.homeTeam} vs ${match.awayTeam} finished. Triggering automated settlement...`);
                            try {
                                await betController.internalSettleMatch({ matchId: match._id, settledBy: 'system' });
                            } catch (settleErr) {
                                console.error(`❌ Automated settlement failed for match ${match._id}:`, settleErr.message);
                            }
                        }

                        updatedCount++;
                    } else {
                        match = new Match(matchData);
                        await match.save();
                        try { socketIo.getIo().emit('matchUpdate', match); } catch (e) { }

                        // Trigger automated settlement if match is already created as finished
                        if (match.status === 'finished') {
                            console.log(`🏁 Match ${match.homeTeam} vs ${match.awayTeam} created as finished. Triggering automated settlement...`);
                            try {
                                await betController.internalSettleMatch({ matchId: match._id, settledBy: 'system' });
                            } catch (settleErr) {
                                console.error(`❌ Automated settlement failed for match ${match._id}:`, settleErr.message);
                            }
                        }

                        createdCount++;
                    }
                }

                console.log(`✅ Odds Update Complete. Created: ${createdCount}, Updated: ${updatedCount}`);
                return { created: createdCount, updated: updatedCount, cache: data.cache, fetchedAt: data.fetchedAt, apiCalls: data.apiCalls || 0 };
            } catch (error) {
                console.error('❌ Error updating matches:', error.message);
                return { created: 0, updated: 0, error: error.message };
            }
        })().finally(() => {
            this._updateInFlight = null;
        });

        return this._updateInFlight;
    }

    /**
     * Generate realistic mock data for testing
     */
    getMockData() {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        return [
            {
                id: 'mock_1',
                home_team: 'New York Yankees',
                away_team: 'Boston Red Sox',
                commence_time: oneHourLater.toISOString(),
                sport: 'baseball_mlb',
                sportTitle: 'MLB',
                bookmakers: [
                    {
                        title: 'MockBook',
                        markets: [
                            { key: 'h2h', outcomes: [{ name: 'New York Yankees', price: -150 }, { name: 'Boston Red Sox', price: 130 }] }
                        ]
                    }
                ],
                score: {
                    event_status: 'STATUS_SCHEDULED',
                    score_away: 0,
                    score_home: 0
                }
            },
            {
                id: 'mock_2',
                home_team: 'Los Angeles Lakers',
                away_team: 'Golden State Warriors',
                commence_time: now.toISOString(),
                sport: 'basketball_nba',
                sportTitle: 'NBA',
                bookmakers: [
                    {
                        title: 'MockBook',
                        markets: [
                            { key: 'h2h', outcomes: [{ name: 'Lakers', price: -200 }, { name: 'Warriors', price: 170 }] }
                        ]
                    }
                ],
                score: {
                    event_status: 'STATUS_IN_PROGRESS',
                    score_away: 98,
                    score_home: 95,
                    period: 'Q2'
                }
            }
        ];
    }
}

module.exports = new OddsService();
