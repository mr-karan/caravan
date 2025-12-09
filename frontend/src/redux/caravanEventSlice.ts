import type { PayloadAction } from '@reduxjs/toolkit';
import { createAction, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import type { RootState } from './reducers/reducers';

/**
 * The types of default events that can be tracked.
 */
export enum CaravanEventType {
  /** Events related to an error boundary. */
  ERROR_BOUNDARY = 'caravan.error-boundary',
}

/**
 * The status of an event.
 */
export enum EventStatus {
  /** The status of the event is unknown. */
  UNKNOWN = 'unknown',
  /** The event has to do with opening a dialog/action. */
  OPENED = 'open',
  /** The event has to do with closing a dialog/action. */
  CLOSED = 'closed',
  /** The event has to do with confirming a dialog/action. */
  CONFIRMED = 'confirmed',
  /** The event has to do with finishing a dialog/action. */
  FINISHED = 'finished',
}

/**
 * Represents a Caravan event. It can be one of the default events or a custom event.
 */
export interface CaravanEvent<EventType = CaravanEventType | string> {
  type: EventType;
  data?: unknown;
}

/**
 * Event fired when an error boundary is triggered.
 */
export interface ErrorBoundaryEvent {
  type: CaravanEventType.ERROR_BOUNDARY;
  /** The error that was thrown. */
  data: Error;
}

export type CaravanEventCallback = (data: CaravanEvent) => void;

const initialState: {
  trackerFuncs: CaravanEventCallback[];
} = {
  trackerFuncs: [],
};

export const eventAction = createAction<CaravanEvent>('caravan/event');

export const listenerMiddleware =
  createListenerMiddleware<Pick<RootState, 'eventCallbackReducer'>>();
listenerMiddleware.startListening({
  actionCreator: eventAction,
  effect: async (action, listernerApi) => {
    const trackerFuncs = listernerApi.getState()?.eventCallbackReducer?.trackerFuncs;
    for (const trackerFunc of trackerFuncs) {
      try {
        trackerFunc(action.payload);
      } catch (e) {
        console.error(
          `Error running tracker func ${trackerFunc} with payload ${action.payload}: ${e}`
        );
      }
    }
  },
});

export const caravanEventSlice = createSlice({
  name: 'caravanEvents',
  initialState,
  reducers: {
    addEventCallback(state, action: PayloadAction<CaravanEventCallback>) {
      state.trackerFuncs.push(action.payload);
    },
  },
});

export const { addEventCallback } = caravanEventSlice.actions;

export default caravanEventSlice.reducer;

export function useEventCallback(): (eventInfo: CaravanEvent | CaravanEvent['type']) => void;
export function useEventCallback(
  eventType: CaravanEventType.ERROR_BOUNDARY
): (error: Error) => void;
export function useEventCallback(eventType?: CaravanEventType | string) {
  const dispatch = useDispatch();

  switch (eventType) {
    case CaravanEventType.ERROR_BOUNDARY:
      return (error: Error) => {
        dispatch(
          eventAction({
            type: CaravanEventType.ERROR_BOUNDARY,
            data: error,
          })
        );
      };
    default:
      break;
  }

  return (eventInfo: CaravanEvent | CaravanEvent['type']) => {
    let event: CaravanEvent;
    if (typeof eventInfo === 'string') {
      event = { type: eventInfo };
    } else {
      event = eventInfo;
    }

    dispatch(eventAction(event));
  };
}
