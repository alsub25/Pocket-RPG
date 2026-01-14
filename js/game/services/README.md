# Game Services

This directory contains engine-integrated game services that ensure all state management goes through the Locus Engine properly with immutable updates and event emissions.

## Overview

Services in this directory follow the engine integration pattern:

1. **Immutable State Updates**: All state changes use `engine.setState()` with spread operators
2. **Event Emissions**: All significant changes emit events via `engine.emit()`
3. **Service Registration**: Services are registered with the engine for dependency injection
4. **Clean APIs**: Services expose focused, well-documented public APIs

## Current Services

### Village Economy Service (`villageEconomyService.js`)

Manages village economy state including prosperity, trade, and security metrics.

**Key Features:**
- Immutable state updates for all economy changes
- Event emissions for economy ticks, battle impacts, and purchases
- Integration with Town Hall decrees and government effects
- RNG integration for deterministic prosperity drift

**Events Emitted:**
- `village:economyTick` - Daily economy updates
- `village:economyAfterBattle` - Economy boost after defeating monsters
- `village:economyAfterPurchase` - Economy boost from player purchases

**Public API:**
```javascript
const economyService = engine.get('village.economy');

// Read-only accessors
economyService.getSummary()           // Get current economy state
economyService.getMerchantPrice(base, context)  // Calculate merchant prices
economyService.getRestCost()          // Get tavern rest cost
economyService.getTiers()             // Get economy tier definitions

// State-modifying operations
economyService.handleDayTick(day)     // Process daily economy changes
economyService.handleAfterBattle(enemy, area)  // Apply post-battle bonuses
economyService.handleAfterPurchase(gold, context)  // Apply purchase effects
```

### Village Population Service (`villagePopulationService.js`)

Manages village population size and mood dynamics.

**Key Features:**
- Immutable state updates for population changes
- Event emissions for size and mood changes
- Daily mood drift toward neutral
- Integration with Town Hall decree effects

**Events Emitted:**
- `village:populationTick` - Daily population updates
- `village:populationMoodChanged` - Mood adjustments
- `village:populationSizeChanged` - Population size changes

**Public API:**
```javascript
const populationService = engine.get('village.population');

// Read-only accessors
populationService.getPopulation()     // Get current population state

// State-modifying operations
populationService.adjustSize(delta)   // Change population size
populationService.adjustMood(delta, reason)  // Change mood
populationService.handleDayTick(day)  // Process daily mood drift
```

### Time Service (`timeService.js`)

Manages game time progression with day parts (Morning, Evening, Night) and calendar system.

**Key Features:**
- Immutable state updates for all time changes
- Event emissions for time advancement
- Support for partial day advancement and morning jumps
- Fantasy calendar with custom weekdays

**Events Emitted:**
- `time:advanced` - Time moved forward
- `time:partChanged` - Moved to different day part
- `time:dayChanged` - New day started
- `time:yearChanged` - New year started
- `time:jumpedToMorning` - Skipped to next morning

**Public API:**
```javascript
const timeService = engine.get('time');

// Constants
timeService.DAY_PARTS              // ['Morning', 'Evening', 'Night']
timeService.FANTASY_WEEKDAYS        // Custom week day names

// Read-only accessors
timeService.getCurrentTime()        // Get full time breakdown
timeService.formatTimeLong()        // Format: "Year X, Weekday – Day Y (Part)"
timeService.formatTimeShort()       // Format: "Weekday (Part)"

// State-modifying operations
timeService.advanceTime(steps)      // Advance by N day parts
timeService.jumpToNextMorning()     // Skip to next morning
```

## Creating a New Service

See [ENGINE_INTEGRATION_GUIDE.md](../../../../ENGINE_INTEGRATION_GUIDE.md) for comprehensive instructions.

### Quick Template

```javascript
// js/game/services/myService.js

export function createMyService(engine) {
  if (!engine) throw new Error('MyService requires engine instance');

  // Get dependencies
  const rng = engine.get('rng');

  function initState(state) {
    if (!state.myData) {
      return {
        ...state,
        myData: { /* defaults */ }
      };
    }
    return state;
  }

  function updateValue(newValue) {
    const state = engine.getState();
    const stateWithData = initState(state);
    
    const newState = {
      ...stateWithData,
      myData: {
        ...stateWithData.myData,
        value: newValue
      }
    };
    
    engine.setState(newState);
    engine.emit('mySystem:valueChanged', { newValue });
  }

  return {
    initState: () => {
      const state = engine.getState();
      const newState = initState(state);
      if (newState !== state) {
        engine.setState(newState);
      }
    },
    getValue: () => {
      const state = engine.getState();
      return initState(state).myData.value;
    },
    updateValue
  };
}
```

Then create a plugin in `js/game/plugins/` to register your service with the engine.

## Best Practices

1. **Always use immutable updates**: Never mutate state directly
2. **Emit events for significant changes**: Let other systems react
3. **Initialize state defensively**: Handle missing data gracefully
4. **Document your events**: Include payload structure in comments
5. **Keep APIs focused**: Each service should do one thing well
6. **Test immutability**: Verify state objects are not mutated
7. **Use engine dependencies**: Get RNG, logging, etc. from engine

## Testing

Services should be testable by:
1. Creating a mock engine
2. Calling service methods
3. Verifying state was not mutated (object identity checks)
4. Checking event emissions
5. Validating new state structure

Example:
```javascript
test('service does not mutate state', () => {
  const mockEngine = createMockEngine();
  const service = createMyService(mockEngine);
  
  const originalState = mockEngine.getState();
  service.updateValue(10);
  
  // Original unchanged
  expect(originalState.myData.value).toBe(0);
  
  // New state is different object
  const newState = mockEngine.getState();
  expect(newState).not.toBe(originalState);
  expect(newState.myData.value).toBe(10);
});
```

## Related Documentation

- [Engine README](../../engine/README.md) - Complete engine documentation
- [Engine Integration Guide](../../../../ENGINE_INTEGRATION_GUIDE.md) - Patterns and examples
- [Plugin Directory](../plugins/) - See how services are registered

## Questions?

See the [Engine Integration Guide](../../../../ENGINE_INTEGRATION_GUIDE.md) for detailed patterns, migration examples, and testing guidelines.
