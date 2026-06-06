(function () {
  const DEFAULT_HOSTS = Object.freeze(['localhost', '127.0.0.1']);
  const DEFAULT_PORT = 28443;
  const DEFAULT_TIMEOUT_MS = 3500;
  const DEFAULT_ATTEMPTS = Object.freeze([
    { secure: true, protocol: 'wss' },
    { secure: false, protocol: 'ws' }
  ]);

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      window.clearTimeout(timeoutId);
    });
  }

  function resetConnection(JSPM) {
    try {
      JSPM?.JSPrintManager?.WS?._ws?.close?.();
    } catch {
      // A stale socket should never block the next connection attempt.
    }

    if (JSPM?.JSPrintManager) {
      JSPM.JSPrintManager.WS = null;
    }
  }

  async function start(options = {}) {
    const JSPM = options.jspm || window.JSPM;
    const hosts = options.hosts || DEFAULT_HOSTS;
    const attempts = options.attempts || DEFAULT_ATTEMPTS;
    const port = options.port || DEFAULT_PORT;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const onStatusChanged = options.onStatusChanged;
    let lastError = null;

    if (!JSPM?.JSPrintManager) {
      throw new Error('Biblioteca JSPrintManager nao carregada nesta pagina.');
    }

    for (const host of hosts) {
      for (const attempt of attempts) {
        try {
          resetConnection(JSPM);

          if (typeof JSPM.JSPrintManager.getClientAppInfo === 'function') {
            await withTimeout(
              Promise.resolve(JSPM.JSPrintManager.getClientAppInfo(attempt.secure, host, port)),
              timeoutMs,
              `Tempo esgotado consultando ${attempt.protocol}://${host}:${port}/?getClientAppInfo.`
            );
          }

          const startPromise = Promise.resolve(
            JSPM.JSPrintManager.start(attempt.secure, host, port)
          );

          if (JSPM.JSPrintManager.WS && typeof onStatusChanged === 'function') {
            JSPM.JSPrintManager.WS.onStatusChanged = onStatusChanged;
          }

          await withTimeout(
            startPromise,
            timeoutMs,
            `Tempo esgotado tentando ${attempt.protocol}://${host}:${port}.`
          );

          if (JSPM.JSPrintManager.WS && typeof onStatusChanged === 'function') {
            JSPM.JSPrintManager.WS.onStatusChanged = onStatusChanged;
          }

          return { ...attempt, host, port };
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError || 'Nao foi possivel conectar ao JSPrintManager.'));
  }

  window.SafisaJspmClient = Object.freeze({
    DEFAULT_HOSTS,
    DEFAULT_PORT,
    DEFAULT_TIMEOUT_MS,
    description: `${DEFAULT_HOSTS.join(' / ')}:${DEFAULT_PORT}`,
    resetConnection,
    start,
    withTimeout
  });
}());
