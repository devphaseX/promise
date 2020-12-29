import { length, removeEmpty, pipe, enQueue, prop } from '../util/index.js';
import { Promise } from '../index.js';

export class UncaughtPromiseError extends Error {
  constructor(msg) {
    super(msg);
    super.name = '(in promise)';
  }
}

export const _consume = (promise) => {
  let status = null;
  return (res, rej) => {
    promise
      .then(function complete(val) {
        res(val);
        status = true;
      })
      .catch(function terminate(errMsg) {
        rej(errMsg);
        status = false;
      });

    return {
      get status() {
        return status;
      },
    };
  };
};

export function resolveAll(promiseIterable) {
  return resolver;
  function resolver(getSettler, resolveCondition) {
    return new Promise(function resolveExecutor(resolve, reject) {
      let states = Array.from(promiseIterable, pipe(Promise.resolve, _consume));
      let stateLengths = length(states);
      let result = Array(stateLengths);
      states = states.map(getSettler(result, resolve, reject));

      const processResolve = enQueue(function cycle() {
        const stateValues = states.map(prop('status'));
        const isAllSettled = pipe(removeEmpty, length) === stateLengths;

        resolveCondition(
          processResolve,
          [isAllSettled, stateValues],
          resolve,
          result
        );
      });

      processResolve();
    });
  }
}
