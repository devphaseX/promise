import {
  length,
  removeEmpty,
  pipe,
  enQueue,
  prop,
  identity,
} from '../util/index.js';
import { Promise } from '../index.js';

export class UncaughtPromiseError extends Error {
  name = '(in promise)';
}

export const _consume = (promise) => {
  let status = null;
  return (res, rej) => {
    promise.then(
      function complete(val) {
        res(val);
        status = true;
      },
      function terminate(errMsg) {
        rej(errMsg);
      }
    );

    return {
      get status() {
        return status;
      },
    };
  };
};

const getSettleLengths = pipe(removeEmpty, length);

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
        const isAllSettled = getSettleLengths(stateValues) === stateLengths;
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

export const pick = function (
  settler,
  value,
  compare,
  caseConditions,
  subscriber
) {
  caseConditions.some((_case) => {
    if (!Array.isArray(_case)) {
      const isEq = compare === _case;
      return isEq ? (settler(subscriber(value)), isEq) : isEq;
    } else {
      const [caseValue, passValue, useSubscriber] = _case;
      const isEq = compare === caseValue;
      if (isEq) {
        if (passValue && useSubscriber) {
          settler(subscriber(value));
        } else if (passValue) {
          settler(value);
        } else if (useSubscriber) {
          subscriber(), settler();
        } else {
          settler();
        }
      } else {
        return isEq;
      }
    }
  });
};
