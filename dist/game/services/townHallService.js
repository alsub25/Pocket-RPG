// js/game/services/townHallService.js
// Town Hall service - handles town hall operations through the engine
//
// This service provides town hall operations (quest board, government interactions)
// through the engine's event system.
export function createTownHallService(engine) {
    const getState = () => engine.getState();
    const setState = (newState, reason) => engine.commit(newState, reason);
    const emit = (event, payload) => engine.emit(event, payload);
    const log = engine.log;
    // Helper to ensure town hall state exists
    function ensureTownHallState(state) {
        if (!state.townHall) {
            state.townHall = {
                lastVisitDay: state.time?.day || 1,
                announcementsRead: [],
                proposalsSubmitted: 0
            };
        }
        return state;
    }
    // Initialize town hall state
    function initTownHall() {
        const state = getState();
        if (!state.townHall) {
            const newState = { ...state };
            ensureTownHallState(newState);
            setState(newState, 'townHall:init');
            log?.info?.('townHall', 'Town Hall state initialized');
        }
    }
    // Read an announcement
    function readAnnouncement(announcementId) {
        const state = getState();
        if (!announcementId) {
            return { success: false, error: 'No announcement ID provided' };
        }
        const newState = { ...state };
        ensureTownHallState(newState);
        const announcement = {
            id: announcementId,
            readOn: state.time?.day || 1,
            timestamp: Date.now()
        };
        // Avoid duplicates
        const alreadyRead = newState.townHall.announcementsRead?.find(a => a.id === announcementId);
        if (!alreadyRead) {
            newState.townHall = {
                ...newState.townHall,
                announcementsRead: [...(newState.townHall.announcementsRead || []), announcement]
            };
            setState(newState, 'townHall:readAnnouncement');
            emit('townHall:announcementRead', { announcement });
            log?.info?.('townHall', `Announcement ${announcementId} read`);
        }
        return { success: true, announcement };
    }
    // Submit a proposal
    function submitProposal(proposalData) {
        const state = getState();
        const player = state.player;
        if (!proposalData || !proposalData.title) {
            return { success: false, error: 'Invalid proposal data' };
        }
        // Check if player has sufficient influence/reputation (if that system exists)
        const requiredInfluence = 50;
        if (player.influence !== undefined && player.influence < requiredInfluence) {
            return { success: false, error: 'Insufficient influence', required: requiredInfluence };
        }
        const newState = { ...state };
        ensureTownHallState(newState);
        const proposal = {
            ...proposalData,
            submittedBy: player.name || 'Player',
            submittedOn: state.time?.day || 1,
            status: 'pending'
        };
        newState.townHall = {
            ...newState.townHall,
            lastVisitDay: state.time?.day || 1,
            proposalsSubmitted: (newState.townHall.proposalsSubmitted || 0) + 1
        };
        setState(newState, 'townHall:submitProposal');
        emit('townHall:proposalSubmitted', { proposal });
        log?.info?.('townHall', `Proposal "${proposal.title}" submitted`);
        return { success: true, proposal };
    }
    // Handle daily tick (process pending proposals, etc.)
    function handleDayTick(newDay) {
        const state = getState();
        if (!state.townHall || state.townHall.lastProcessedDay === newDay) {
            return; // Already processed today
        }
        const newState = { ...state };
        ensureTownHallState(newState);
        // Update last processed day
        newState.townHall = { ...newState.townHall, lastProcessedDay: newDay };
        setState(newState, 'townHall:dayTick');
        emit('townHall:dayProcessed', { day: newDay });
        log?.info?.('townHall', `Town Hall processed day ${newDay}`);
    }
    // Get town hall summary
    function getSummary() {
        const state = getState();
        const townHall = state.townHall || {};
        return {
            lastVisitDay: townHall.lastVisitDay || 1,
            announcementsRead: townHall.announcementsRead?.length || 0,
            proposalsSubmitted: townHall.proposalsSubmitted || 0
        };
    }
    return {
        initTownHall,
        readAnnouncement,
        submitProposal,
        handleDayTick,
        getSummary
    };
}
//# sourceMappingURL=townHallService.js.map