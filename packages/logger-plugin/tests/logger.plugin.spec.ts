import { ErrorHandler, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Action,
  getActionTypeFromInstance,
  InitState,
  NgxsModule,
  State,
  StateContext,
  Store
} from '@ngxs/store';
import { StateClass } from '@ngxs/store/internals';
import { throwError } from 'rxjs';
import { NgxsLoggerPluginModule, NgxsLoggerPluginOptions } from '../';
import { NoopErrorHandler } from '../../store/tests/helpers/utils';
import { formatActionCallStack, LoggerSpy } from './helpers';

describe('NgxsLoggerPlugin', () => {
  const thrownErrorMessage = 'Error';
  const defaultBarValue = 'baz';

  class UpdateBarAction {
    static type = 'UPDATE_BAR';

    constructor(public bar?: string) {}
  }

  class ErrorAction {
    static type = 'ERROR';
  }

  interface StateModel {
    bar: string;
  }

  const stateModelDefaults: StateModel = {
    bar: ''
  };

  @State<StateModel>({
    name: 'test',
    defaults: stateModelDefaults
  })
  @Injectable()
  class TestState {
    @Action(UpdateBarAction)
    updateBar({ patchState }: StateContext<StateModel>, { bar }: UpdateBarAction) {
      patchState({ bar: bar || defaultBarValue });
    }

    @Action(ErrorAction)
    error() {
      return throwError(new Error(thrownErrorMessage));
    }
  }

  function setup(states: StateClass[], opts?: NgxsLoggerPluginOptions) {
    const logger = new LoggerSpy();

    TestBed.configureTestingModule({
      imports: [
        NgxsModule.forRoot(states),
        NgxsLoggerPluginModule.forRoot({
          ...opts,
          logger
        })
      ],
      providers: [{ provide: ErrorHandler, useClass: NoopErrorHandler }]
    });

    const store: Store = TestBed.inject(Store);

    return {
      store,
      logger
    };
  }

  it('should log success action', () => {
    const { store, logger } = setup([TestState]);

    store.dispatch(new UpdateBarAction());

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({ action: InitState.type, prevState: stateModelDefaults }),

      ...formatActionCallStack({
        action: UpdateBarAction.type,
        prevState: stateModelDefaults,
        nextState: { bar: defaultBarValue }
      })
    ]);

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should log success action with payload', () => {
    const { store, logger } = setup([TestState]);
    const payload = 'qux';

    store.dispatch(new UpdateBarAction(payload));

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({ action: InitState.type, prevState: stateModelDefaults }),

      ...formatActionCallStack({
        action: UpdateBarAction.type,
        prevState: stateModelDefaults,
        nextState: { bar: payload },
        payload: { bar: payload }
      })
    ]);

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should log error action', () => {
    const { store, logger } = setup([TestState]);

    store.dispatch(new ErrorAction());

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({ action: InitState.type, prevState: stateModelDefaults }),

      ...formatActionCallStack({
        action: ErrorAction.type,
        prevState: stateModelDefaults,
        error: thrownErrorMessage,
        snapshot: store.snapshot()
      })
    ]);

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should log collapsed success action', () => {
    const { store, logger } = setup([TestState], { collapsed: true });

    store.dispatch(new UpdateBarAction());

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({
        action: InitState.type,
        prevState: stateModelDefaults,
        collapsed: true
      }),

      ...formatActionCallStack({
        action: UpdateBarAction.type,
        prevState: stateModelDefaults,
        nextState: { bar: defaultBarValue },
        collapsed: true
      })
    ]);

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should not log while disabled', () => {
    const { store, logger } = setup([TestState], { disabled: true });

    store.dispatch(new UpdateBarAction());

    const expectedCallStack = LoggerSpy.createCallStack([]);

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should not log if predicate returns false for an action', () => {
    const { store, logger } = setup([TestState], {
      filter: action => getActionTypeFromInstance(action) !== UpdateBarAction.type
    });

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({ action: InitState.type, prevState: stateModelDefaults })
    ]);

    store.dispatch(new UpdateBarAction());

    expect(logger.callStack).toEqual(expectedCallStack);
  });

  it('should pass state snapshot to filter predicate', () => {
    const { store, logger } = setup([TestState], {
      filter: (_, state) => state.test.bar
    });

    const expectedCallStack = LoggerSpy.createCallStack([
      ...formatActionCallStack({
        action: UpdateBarAction.type,
        prevState: { bar: defaultBarValue },
        payload: { bar: 'bar' },
        nextState: { bar: 'bar' }
      })
    ]);

    store.dispatch(new UpdateBarAction());
    store.dispatch(new UpdateBarAction('bar'));

    expect(logger.callStack).toEqual(expectedCallStack);
  });
});
