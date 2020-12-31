import {
  enQueue,
  status,
  defer,
  pipe,
  length,
  selectArray,
} from './util/index.js';
import {
  pick,
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

function onFulfill(subscriptions, value) {
  const caseConditions = [0, [1, true], [2, false, true]];
  function settleFulfil([[subscriber, promiseType], resolve, reject]) {
    subscriber = Array.isArray(subscriber) ? subscriber[0] : subscriber;
    try {
      pick(resolve, value, promiseType, caseConditions, subscriber);
    } catch (e) {
      reject(e);
    }
  }

  subscriptions.map(selectArray(0, 2)).forEach(settleFulfil);
}

function onReject(subscriptions, reason) {
  const caseConditions = [[0, true], 1, [2, false, true]];
  if (length(subscriptions)) {
    subscriptions.map(selectArray(1, 2)).forEach(settleReject);
  } else {
    throw new UncaughtPromiseError(reason);
  }

  function settleReject([[fn, type], resolve, reject, isCatchInstance]) {
    fn = Array.isArray(fn) ? fn[1] : fn;
    const resolveType = isCatchInstance && type !== 0 ? resolve : reject;
    pick(resolveType, reason, type, caseConditions, fn);
  }
}

const instanceMethods = new WeakMap();
export default class Promise {
  constructor(executor) {
    let subscriptions = [];
    let currentState = 'pending';

    const setState = defer((type) => (currentState = type));

    const resolve = settle(
      enQueue(onFulfill),
      setState('fulfilled'),
      this,
      subscriptions
    );

    const reject = settle(
      enQueue(onReject),
      setState('rejected'),
      this,
      subscriptions
    );

    function _then(...cbs) {
      cbs = [...cbs.slice(0, 2).entries()];
      return new Promise((resolve, reject) => {
        const cbTasks = cbs.map(cbTask).filter(Boolean);
        subscriptions.push(cbTasks.length === 1 ? cbTasks[0] : cbTasks);
        function cbTask([i, cb]) {
          return cb ? [[cb, i], resolve, reject, Boolean(i)] : null;
        }
      });
    }

    function _catch(cb) {
      return new Promise((resolve, reject) => {
        subscriptions.push([[cb, 1], resolve, reject, true]);
      });
    }

    function _finally(cb) {
      return new Promise((resolve, reject) => {
        subscriptions.push([[enQueue(cb), 2], resolve, reject]);
      });
    }

    instanceMethods.set(this, [_then, _catch, _finally]);

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

  then(...cbs) {
    return instanceMethods.get(this)[0](...cbs);
  }

  catch(cb) {
    return instanceMethods.get(this)[1](cb);
  }

  finally(cb) {
    return instanceMethods.get(this)[2](cb);
  }

  static resolve(v) {
    return 'then' in Object(v) ? v : new Promise((res) => res(v));
  }

  static reject(v) {
    return 'then' in Object(v) ? v : new Promise((_, rej) => rej(v));
  }

  static all(promiseIterable) {
    function insert(result, _, rej) {
      return function (promiser, i) {
        return promiser((v) => (result[i] = v), rej);
      };
    }

    function trial(_try, [isFulfil, states], resolve, result) {
      const complete = states.some((v) => v === false);
      if (isFulfil) {
        resolve(result);
      } else if (!complete) {
        _try(resolve);
      }
    }
    return resolveAll(promiseIterable)(insert, trial);
  }

  static allSettled(promises) {
    function insert(result) {
      return function (promiser, i) {
        return promiser(
          (v) => (result[i] = status('fulfilled', 'value', v)),
          (v) => (result[i] = status('rejected', 'reason', v))
        );
      };
    }
    function attempt(checker, [allFulfilled], resolve, result) {
      allFulfilled ? resolve(result) : checker(resolve);
    }
    return resolveAll(promises)(insert, attempt);
  }

  static race(promises) {
    return new Promise((res, rej) => {
      let promiseStates = promises.map(pipe(Promise.resolve, _consume));
      promiseStates.forEach((ps) => ps(res, rej));
    });
  }
}

export { Promise };
