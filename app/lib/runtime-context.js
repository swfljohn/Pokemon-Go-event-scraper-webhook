import { AsyncLocalStorage } from "node:async_hooks";

const runtimeContext = new AsyncLocalStorage();

export function runWithRuntime(bindings, executionContext, callback) {
  const db = bindings?.DB;
  const state = {
    bindings: bindings || {},
    executionContext: executionContext || null,
    d1: db?.withSession ? db.withSession("first-primary") : null
  };
  return runtimeContext.run(state, callback);
}

export function currentRuntime() {
  return runtimeContext.getStore() || null;
}

export function runtimeBinding(name) {
  return currentRuntime()?.bindings?.[name];
}

export function runtimeExecutionContext() {
  return currentRuntime()?.executionContext || null;
}
