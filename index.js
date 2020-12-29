import { enQueue, status, defer, pipe } from './util/index.js';
import {
  resolveAll,
  UncaughtPromiseError,
  _consume,
} from './internal/index.js';

function settle(action, changeState, promise, subscriptions) {
  return function change(value) {
    if (!['fulfilled', 'rejected'].includes(promise.state)) {
      changeState();
      action(subscriptions, value);
    }
  };
}

function onFulfill(subscriptions, v) {
  subscriptions.forEach(function settleFulfil([
    [subscriber],
    resolve,
    reject,
    isPromiseCatchInstance,
  ]) {
    try {
      resolve(isPromiseCatchInstance ? v : subscriber(v));
    } catch (e) {
      reject(e);
    }
  });
}

function onReject(subscriptions, errMsg) {
  if (subscriptions.length) {
    subscriptions.forEach(function settleReject([
      [fn, caughtPromise],
      ,
      reject,
    ]) {
      (caughtPromise ? fn : reject)(errMsg);
    });
  } else {
    throw new UncaughtPromiseError(errMsg.message || errMsg);
  }
}

const instanceMethods = new WeakMap();

export class Promise {
  constructor(executor) {
    let subscriptions = [];
    let currentState = 'pending';

    const setState = defer((type) => (currentState = type));

    const resolve = enQueue(
      settle(onFulfill, setState('fulfilled'), this, subscriptions)
    );
    const reject = enQueue(
      settle(onReject, setState('rejected'), this, subscriptions)
    );

    function _then(cb) {
      return new Promise((resolve, reject) => {
        subscriptions.push([[cb], resolve, reject]);
      });
    }

    function _catch(cb) {
      return new Promise((resolve, reject) => {
        subscriptions.push([[cb, true], resolve, reject, true]);
      });
    }

    instanceMethods.set(this, [_then, _catch]);

    Object.defineProperty(this, 'state', {
      get() {
        return currentState;
      },
    });

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(cb) {
    return instanceMethods.get(this)[0](cb);
  }

  catch(cb) {
    return instanceMethods.get(this)[1](cb);
  }

  static resolve(v) {
    return 'then' in Object(v) ? v : new Promise((res) => res(v));
  }

  static reject(v) {
    return 'then' in Object(v) ? v : new Promise((_, rej) => rej(v));
  }

  static all(promiseIterable) {
    function storeSettleResult(result, _, rej) {
      return function (promiser, i) {
        return promiser((v) => (result[i] = v), rej);
      };
    }

    function resolveConditioner(checker, [allFulfilled, states], res, result) {
      const someFailed = states.some((v) => v === false);
      allFulfilled ? res(result) : !someFailed ? checker(res) : null;
    }
    return resolveAll(promiseIterable)(storeSettleResult, resolveConditioner);
  }

  static allSettled(promises) {
    function storeSettleResult(result) {
      return function (promiser, i) {
        return promiser(
          (v) => (result[i] = status('fulfilled', 'value', v)),
          (v) => (result[i] = status('rejected', 'reason', v))
        );
      };
    }
    function resolveConditioner(checker, [allFulfilled], resolve, result) {
      allFulfilled ? resolve(result) : checker(resolve);
    }
    return resolveAll(promises)(storeSettleResult, resolveConditioner);
  }

  static race(promises) {
    return new Promise((res, rej) => {
      let promiseStates = promises.map(pipe(Promise.resolve, _consume));
      promiseStates.forEach((ps) => ps(res, rej));
    });
  }
}
