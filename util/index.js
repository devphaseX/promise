export const status = (state, type, value) => ({
  status: state,
  [type]: value,
});

export const prop = (key) => (obj) => obj[key];
export const unary = (fn) => (arg) => fn(arg);

export const isUndefined = (val) => val == null;
export const length = prop('length');
export const not = (fn) => (v) => !fn(v);
export const removeEmpty = (list) => list.filter(not(isUndefined));

//pipe :: Function -> Function
export function pipe(...fns) {
  return function piped(result) {
    var list = [...fns];
    while (list.length > 0) {
      // take the first function from the list
      // and execute it
      result = list.shift()(result);
    }
    return result;
  };
}

export function enQueue(fn) {
  return function now(v) {
    setTimeout(fn, 0, v);
  };
}

export function defer(fn) {
  return function fixed(v) {
    return function bind() {
      fn(v);
    };
  };
}
