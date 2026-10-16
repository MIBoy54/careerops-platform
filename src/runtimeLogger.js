// QA must not leak payloads, session users, query strings or driver SQL/values.
// Other environments retain their baseline logging behavior.
export function createRuntimeLogger(appEnv, sink = console) {
  return {
    log: (...args) => appEnv === 'qa' ? sink.log('QA application event') : sink.log(...args),
    error: (...args) => appEnv === 'qa' ? sink.error('QA application error') : sink.error(...args)
  };
}
